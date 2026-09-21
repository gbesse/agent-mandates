#!/usr/bin/env node
// Purpose: Inspect and evolve signed authority snapshots with explicit operator-controlled files.
import { readFile, writeFile } from 'node:fs/promises';
import { createAuthority } from '../src/index.mjs';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') { console.log('agent-mandates issue GRANT.json OUTPUT.json\nagent-mandates inspect AUTHORITY.json\nagent-mandates reserve AUTHORITY.json ACTION.json OUTPUT.json\nagent-mandates delegate AUTHORITY.json CHILD.json OUTPUT.json\nagent-mandates revoke AUTHORITY.json REASON OUTPUT.json\nSet MANDATE_SIGNING_KEY to a strong secret of at least 32 bytes. Outputs never overwrite files.'); return; }
  const counts = { issue: 2, inspect: 1, reserve: 3, delegate: 3, revoke: 3 };
  if (!Object.hasOwn(counts, command) || args.length !== counts[command]) throw new Error('Invalid arguments; use --help');
  const existing = command === 'issue' ? null : await read(args[0]);
  const authority = createAuthority({ secret: process.env.MANDATE_SIGNING_KEY, snapshot: existing?.snapshot });
  let token = existing?.token, result;
  if (command === 'issue') token = await authority.issue(await read(args[0]));
  if (command === 'inspect') { console.log(JSON.stringify(authority.inspect(token), null, 2)); return; }
  if (command === 'reserve') result = await authority.reserve(token, await read(args[1]));
  if (command === 'delegate') token = await authority.delegate(token, await read(args[1]));
  if (command === 'revoke') { await authority.revoke(token, args[1]); result = { revoked: true }; }
  await writeFile(args.at(-1), JSON.stringify({ description: 'Sensitive signed mandate and ledger. Keep this file private and use the newest snapshot.', token, snapshot: authority.snapshot(), ...(result ? { result } : {}) }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
main().catch(error => { console.error(`agent-mandates: ${error.message}`); process.exitCode = 1; });
