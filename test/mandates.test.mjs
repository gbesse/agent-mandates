// Purpose: Test signed mandate attenuation, ancestor budgets, idempotency, persistence and intent advice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthority } from '../src/index.mjs';
import { reviewIntent } from '../src/jev.mjs';
import { exampleGrant, exampleAction } from '../examples/fixtures.mjs';
const secret = 'synthetic-test-secret-with-32-bytes-minimum';
const now = Date.UTC(2026, 8, 21, 12);
const setup = async options => { const authority = createAuthority({ secret, now: () => now, ...options }); return { authority, token: await authority.issue(exampleGrant(now)) }; };
test('signed tokens reject tampering, wrong keys and unregistered grants', async () => {
  const { authority, token } = await setup();
  assert.throws(() => authority.inspect(token.slice(0, -4) + 'AAAA'), /signature/);
  assert.throws(() => createAuthority({ secret: 'other-secret-which-is-at-least-32-bytes' }).inspect(token), /signature/);
  assert.throws(() => createAuthority({ secret, now: () => now }).inspect(token), /registered/);
});
test('exact operation/resource tuples avoid unintended scope cross-products', async () => {
  const authority = createAuthority({ secret, now: () => now });
  const token = await authority.issue({ ...exampleGrant(now), scopes: [{ operation: 'draft', resource: 'supplier/42' }, { operation: 'read', resource: 'supplier/43' }] });
  await assert.rejects(authority.reserve(token, { ...exampleAction, resource: 'supplier/43' }), /scope/);
  for (const change of [{ actor: 'other' }, { audience: 'other' }, { currency: 'USD' }, { costMinor: -1 }]) await assert.rejects(authority.reserve(token, { ...exampleAction, ...change }));
});
test('same request id is not charged or executable twice', async () => {
  const { authority, token } = await setup();
  assert.equal((await authority.reserve(token, exampleAction)).execute, true);
  assert.equal((await authority.reserve(token, exampleAction)).execute, false);
  assert.deepEqual(authority.inspect(token).usage, { calls: 1, budgetMinor: 200 });
  await assert.rejects(authority.reserve(token, { ...exampleAction, costMinor: 201 }), /different content/);
});
test('delegation cannot widen scope, budget or validity', async () => {
  const { authority, token } = await setup(), parent = exampleGrant(now);
  const child = { ...parent, subject: 'child', budgetMinor: 500, maxCalls: 2 };
  for (const change of [{ budgetMinor: 1001 }, { maxCalls: 4 }, { expiresAt: new Date(now + 120_000).toISOString() }, { scopes: [{ operation: 'pay', resource: 'supplier/42' }] }]) await assert.rejects(authority.delegate(token, { ...child, ...change }), /expand/);
  const childToken = await authority.delegate(token, child);
  assert.equal(authority.inspect(childToken).grant.subject, 'child');
});
test('sibling delegates share the parent budget and call limit', async () => {
  const { authority, token } = await setup();
  const children = await Promise.all(['child-a', 'child-b'].map(subject => authority.delegate(token, { ...exampleGrant(now), subject })));
  await authority.reserve(children[0], { ...exampleAction, actor: 'child-a', costMinor: 600 });
  await assert.rejects(authority.reserve(children[1], { ...exampleAction, requestId: 'b', actor: 'child-b', costMinor: 600 }), /limit/);
  assert.equal(authority.inspect(token).usage.budgetMinor, 600);
});
test('concurrent reservations cannot overspend within an authority', async () => {
  const { authority, token } = await setup();
  const results = await Promise.allSettled(['a', 'b'].map(requestId => authority.reserve(token, { ...exampleAction, requestId, costMinor: 600 })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('revoking a parent also invalidates descendants', async () => {
  const { authority, token } = await setup();
  const child = await authority.delegate(token, { ...exampleGrant(now), subject: 'child' });
  await authority.revoke(token, 'Approval withdrawn');
  await assert.rejects(authority.reserve(child, { ...exampleAction, actor: 'child' }), /revoked/);
});
test('expiry is exclusive and future notBefore blocks use', async () => {
  let clock = now;
  const { authority, token } = await setup({ now: () => clock }); clock = now + 60_000;
  assert.throws(() => authority.inspect(token), /validity/);
  clock = now - 2000; assert.throws(() => authority.inspect(token), /validity/);
});
test('signed snapshots preserve reservation idempotency after restart', async () => {
  const { authority, token } = await setup(); await authority.reserve(token, exampleAction);
  const restored = createAuthority({ secret, snapshot: authority.snapshot(), now: () => now });
  assert.equal((await restored.reserve(token, exampleAction)).execute, false);
  assert.equal(restored.inspect(token).usage.budgetMinor, 200);
});
test('persistence is acknowledged before returning and exposes CAS revisions', async () => {
  const revisions = [];
  const { authority, token } = await setup({ persist: async (_, revision) => { revisions.push(revision); } });
  await authority.reserve(token, exampleAction);
  assert.deepEqual(revisions, [{ previousRevision: 0, revision: 1 }, { previousRevision: 1, revision: 2 }]);
});
test('failed persistence poisons authority and never returns execution permission', async () => {
  let fail = false;
  const { authority, token } = await setup({ persist: async () => { if (fail) throw new Error('disk full'); } });
  fail = true; await assert.rejects(authority.reserve(token, exampleAction), /persistence failed/);
  await assert.rejects(authority.reserve(token, { ...exampleAction, requestId: 'next' }), /reload/);
});
test('a Jev intent signal never grants authority', async () => {
  const result = await reviewIntent({ purpose: 'Draft a renewal', proposedAction: 'Draft a renewal' }, { provider: async ({ model }) => ({ model, answers: { withinPurpose: { type: 'noul', noul: 0.999 } } }) });
  assert.equal(result.status, 'no_drift_flag'); assert.equal(result.authorizationGranted, false);
});

test('persistence timeout blocks subsequent work even if the adapter never settles', async () => {
  let stalled = false;
  const { authority, token } = await setup({ persistTimeoutMs: 15, persist: async () => { if (stalled) await new Promise(() => {}); } });
  stalled = true;
  await assert.rejects(authority.reserve(token, exampleAction), error => error.cause?.message.includes('timed out'));
  await assert.rejects(authority.reserve(token, { ...exampleAction, requestId: 'retry' }), /reload/);
});
test('request fingerprints reject values that cannot survive JSON serialization', async () => {
  const { authority, token } = await setup();
  for (const parameters of [undefined, NaN, Infinity, new Date(), [undefined], { missing: undefined }]) {
    await assert.rejects(authority.reserve(token, { ...exampleAction, parameters }), /JSON/);
  }
  const first = await authority.reserve(token, { ...exampleAction, parameters: { lines: [1, 'paper', null] } });
  assert.equal(first.execute, true);
  assert.equal((await authority.reserve(token, JSON.parse(JSON.stringify({ ...exampleAction, parameters: { lines: [1, 'paper', null] } })))).execute, false);
});
