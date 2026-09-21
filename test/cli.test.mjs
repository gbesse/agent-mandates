// Purpose: Exercise the installed-style CLI workflow, invalid commands and non-overwriting output files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const bin = join(root, 'bin/agent-mandates.mjs');
const env = { ...process.env, MANDATE_SIGNING_KEY: 'fictional-cli-test-secret-at-least-32-bytes' };
delete env.TYPESAFE_API_KEY;
function run(...args) { return execFileSync(process.execPath, [bin, ...args], { cwd: root, env, timeout: 10_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function fixtures(t) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-mandates-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  execFileSync(process.execPath, [join(root, 'examples/write-fixtures.mjs'), dir], { env, timeout: 10_000, stdio: 'pipe' });
  return name => join(dir, name);
}
const read = path => JSON.parse(readFileSync(path, 'utf8'));
test('help works and unknown commands fail visibly', () => {
  assert.match(run('--help'), /agent-mandates/);
  assert.throws(() => run('unknown'), error => error.status === 1 && error.stderr.includes('Invalid'));
});
test('CLI persists charges and duplicate execution decisions in signed snapshots', t => {
  const f = fixtures(t);
  run('issue', f('grant.json'), f('authority0.json'));
  run('reserve', f('authority0.json'), f('action.json'), f('authority1.json'));
  assert.equal(read(f('authority1.json')).result.execute, true);
  run('reserve', f('authority1.json'), f('action.json'), f('authority2.json'));
  assert.equal(read(f('authority2.json')).result.execute, false);
  assert.equal(JSON.parse(run('inspect', f('authority2.json'))).usage.budgetMinor, 200);
  assert.throws(() => run('issue', f('grant.json'), f('authority0.json')), error => error.stderr.includes('EEXIST'));
});
