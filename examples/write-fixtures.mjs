// Purpose: Write fictional CLI input documents without overwriting any existing file.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exampleGrant, exampleAction } from './fixtures.mjs';
const destination = resolve(process.argv[2] ?? 'local-data');
await mkdir(destination, { recursive: true });
const fixtures = { 'grant.json': { ...exampleGrant(), expiresAt: new Date(Date.now() + 3_600_000).toISOString() }, 'action.json': exampleAction };
for (const [name, value] of Object.entries(fixtures)) await writeFile(resolve(destination, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Fictional fixtures written to ${destination}`);
