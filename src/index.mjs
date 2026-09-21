// Purpose: Issue signed, attenuable mandates and reserve bounded actions in an auditable ledger.
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { fingerprint } from '@gbesse/decisionpacks';
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const integer = value => Number.isSafeInteger(value) && value >= 0;
function time(value) { ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), 'Expected a timezone-qualified time'); return Date.parse(value); }
const scopeKey = scope => JSON.stringify([scope.operation, scope.resource]);
// Reject values that JSON would erase or transform, so request digests survive persistence exactly.
function validateJSON(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  ensure(value && typeof value === 'object' && !seen.has(value) && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype), 'Inputs must be finite, acyclic JSON values');
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) { ensure(Object.hasOwn(value, i), 'Sparse arrays are not JSON input'); validateJSON(value[i], seen); }
  } else for (const item of Object.values(value)) validateJSON(item, seen);
  seen.delete(value);
}
function validateGrant(grant) {
  for (const key of ['subject', 'audience', 'purpose', 'approvedBy']) ensure(text(grant[key]), `Grant requires ${key}`);
  ensure(/^[A-Z]{3}$/.test(grant.currency), 'Currency must be a three-letter code');
  ensure(integer(grant.budgetMinor) && integer(grant.maxCalls) && grant.maxCalls > 0, 'Invalid budget or call limit');
  ensure(Array.isArray(grant.scopes) && grant.scopes.length > 0 && grant.scopes.length <= 100, 'Provide 1 to 100 exact scopes');
  for (const scope of grant.scopes) ensure(text(scope.operation) && text(scope.resource) && !scope.operation.includes('*') && !scope.resource.includes('*'), 'Scopes must use exact operation/resource pairs; no wildcards');
  ensure(new Set(grant.scopes.map(scopeKey)).size === grant.scopes.length, 'Duplicate scope');
  ensure(time(grant.notBefore) < time(grant.expiresAt), 'Invalid validity interval');
}
export function createAuthority({ secret, snapshot, now = Date.now, persist, persistTimeoutMs = 10_000 } = {}) {
  ensure((typeof secret === 'string' || secret instanceof Uint8Array) && Buffer.byteLength(secret) >= 32, 'Provide a secret of at least 32 bytes');
  ensure(Number.isInteger(persistTimeoutMs) && persistTimeoutMs > 0 && persistTimeoutMs <= 300_000, 'Invalid persistence deadline');
  const key = Buffer.from(secret);
  function seal(body, kind) {
    const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
    const signature = createHmac('sha256', key).update(`${kind}.${encoded}`).digest('base64url');
    return `${kind}.${encoded}.${signature}`;
  }
  function unseal(token, kind) {
    ensure(typeof token === 'string' && token.length <= 20_000_000, 'Invalid signed payload');
    const parts = token.split('.'); ensure(parts.length === 3 && parts[0] === kind, 'Invalid token kind');
    const expected = createHmac('sha256', key).update(`${kind}.${parts[1]}`).digest();
    const actual = Buffer.from(parts[2], 'base64url');
    ensure(actual.length === expected.length && timingSafeEqual(actual, expected), 'Invalid signature');
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  }
  let ledger = snapshot ? unseal(snapshot, 'ams1') : { schemaVersion: 1, revision: 0, grants: [], reservations: [], revoked: [], audit: [] };
  ensure(ledger.schemaVersion === 1 && integer(ledger.revision) && ['grants', 'reservations', 'revoked', 'audit'].every(k => Array.isArray(ledger[k])), 'Invalid ledger');
  let tail = Promise.resolve(), fatal = false;
  function queued(action) {
    const task = tail.then(() => { ensure(!fatal, 'Persistence failed; reload the last durable snapshot before continuing'); return action(); });
    // The caller receives the rejection. The internal queue remains available for later valid work.
    tail = task.then(() => undefined, () => undefined); return task;
  }
  function append(next, type, details) { next.audit.push({ sequence: next.audit.length + 1, at: new Date(now()).toISOString(), type, details }); }
  async function commit(next) {
    ensure(ledger.revision < Number.MAX_SAFE_INTEGER, 'Ledger revision exhausted');
    next.revision = ledger.revision + 1;
    if (persist) {
      let timer;
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Snapshot persistence timed out')), persistTimeoutMs); });
      try { await Promise.race([persist(seal(next, 'ams1'), { previousRevision: ledger.revision, revision: next.revision }), deadline]); }
      catch (cause) { fatal = true; throw new Error('Mandate persistence failed; no action may execute', { cause }); }
      finally { clearTimeout(timer); }
    }
    ledger = next;
  }
  function chain(token) {
    const grant = unseal(token, 'am1'); validateGrant(grant);
    const found = ledger.grants.find(g => g.id === grant.id);
    ensure(found && fingerprint(found) === fingerprint(grant), 'Grant is not registered in this ledger');
    const result = [found], seen = new Set([found.id]);
    while (result.at(-1).parentId) {
      const parent = ledger.grants.find(g => g.id === result.at(-1).parentId);
      ensure(parent && !seen.has(parent.id), 'Broken delegation chain'); result.push(parent); seen.add(parent.id);
    }
    for (const item of result) {
      ensure(!ledger.revoked.includes(item.id), 'Mandate or ancestor was revoked');
      ensure(now() >= time(item.notBefore) && now() < time(item.expiresAt), 'Mandate is outside its validity interval');
    }
    return result;
  }
  function usage(id) {
    const rows = ledger.reservations.filter(r => r.ancestorIds.includes(id));
    return { calls: rows.length, budgetMinor: rows.reduce((sum, r) => sum + r.costMinor, 0) };
  }
  return {
    issue(input) {
      input = structuredClone(input);
      return queued(async () => {
        validateJSON(input); validateGrant(input);
        const grant = { schemaVersion: 1, id: randomUUID(), parentId: null, ...Object.fromEntries(['subject', 'audience', 'purpose', 'approvedBy', 'currency', 'budgetMinor', 'maxCalls', 'scopes', 'notBefore', 'expiresAt'].map(k => [k, input[k]])) };
        const next = structuredClone(ledger); next.grants.push(grant); append(next, 'mandate.issued', { id: grant.id, approvedBy: grant.approvedBy }); await commit(next);
        return seal(grant, 'am1');
      });
    },
    delegate(parentToken, input) {
      input = structuredClone(input);
      return queued(async () => {
        validateJSON(input);
        const ancestors = chain(parentToken), parent = ancestors[0];
        ensure(ancestors.length < 16, 'Maximum delegation depth reached');
        const child = { ...parent, ...Object.fromEntries(['subject', 'budgetMinor', 'maxCalls', 'scopes', 'notBefore', 'expiresAt'].map(k => [k, input[k]])), id: randomUUID(), parentId: parent.id };
        validateGrant(child);
        ensure(child.budgetMinor <= parent.budgetMinor && child.maxCalls <= parent.maxCalls, 'Delegation cannot expand limits');
        ensure(time(child.notBefore) >= time(parent.notBefore) && time(child.expiresAt) <= time(parent.expiresAt), 'Delegation cannot expand validity');
        ensure(child.scopes.every(scope => parent.scopes.some(p => scopeKey(p) === scopeKey(scope))), 'Delegation cannot expand scopes');
        const next = structuredClone(ledger); next.grants.push(child); append(next, 'mandate.delegated', { parentId: parent.id, id: child.id, subject: child.subject }); await commit(next); return seal(child, 'am1');
      });
    },
    inspect(token) { const ancestors = chain(token); return { grant: structuredClone(ancestors[0]), usage: usage(ancestors[0].id) }; },
    reserve(token, request) {
      request = structuredClone(request);
      return queued(async () => {
        validateJSON(request);
        const ancestors = chain(token), grant = ancestors[0];
        for (const k of ['requestId', 'actor', 'audience', 'operation', 'resource']) ensure(text(request[k]), `Action requires ${k}`);
        ensure(integer(request.costMinor), 'costMinor must be a nonnegative safe integer');
        ensure(request.actor === grant.subject && request.audience === grant.audience, 'Subject or audience mismatch');
        ensure(request.currency === grant.currency, 'Currency mismatch');
        ensure(grant.scopes.some(s => scopeKey(s) === scopeKey(request)), 'Action outside mandate scope');
        const digest = fingerprint(request);
        const previous = ledger.reservations.find(r => r.requestId === request.requestId);
        if (previous) {
          ensure(previous.grantId === grant.id && previous.digest === digest, 'Request id reused with different content');
          return { status: 'duplicate', receipt: structuredClone(previous), execute: false };
        }
        for (const ancestor of ancestors) {
          const used = usage(ancestor.id);
          ensure(used.calls < ancestor.maxCalls && request.costMinor <= ancestor.budgetMinor - used.budgetMinor, 'Mandate or ancestor limit exceeded');
        }
        const receipt = { id: randomUUID(), requestId: request.requestId, grantId: grant.id, ancestorIds: ancestors.map(a => a.id), costMinor: request.costMinor, digest, reservedAt: new Date(now()).toISOString() };
        const next = structuredClone(ledger); next.reservations.push(receipt); append(next, 'action.reserved', { receiptId: receipt.id, requestId: receipt.requestId });
        // Charge before the host executes. Reservations are not automatically refunded after ambiguity.
        await commit(next); return { status: 'reserved', receipt: structuredClone(receipt), execute: true };
      });
    },
    revoke(token, reason) {
      return queued(async () => {
        ensure(text(reason), 'Revocation reason is required');
        const grant = unseal(token, 'am1'); ensure(ledger.grants.some(g => g.id === grant.id), 'Unknown mandate');
        const next = structuredClone(ledger);
        if (!next.revoked.includes(grant.id)) { next.revoked.push(grant.id); append(next, 'mandate.revoked', { id: grant.id, reason }); await commit(next); }
      });
    },
    snapshot() { return seal(ledger, 'ams1'); },
    audit() { return structuredClone(ledger.audit); },
  };
}
