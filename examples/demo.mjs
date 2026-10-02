// Purpose: Demonstrate bounded reservation and replay rejection with an ephemeral demo signing key.
import { randomBytes } from 'node:crypto';
import { createAuthority } from '../src/index.mjs';
import { exampleGrant, exampleAction } from './fixtures.mjs';
const authority = createAuthority({ secret: randomBytes(32) });
const token = await authority.issue(exampleGrant());
const first = await authority.reserve(token, exampleAction);
const replay = await authority.reserve(token, exampleAction);
const inspection = authority.inspect(token);
console.log(JSON.stringify({ source: 'local synthetic demonstration; no external action', first: { status: first.status, execute: first.execute }, replay: { status: replay.status, execute: replay.execute }, usage: inspection.usage, remaining: inspection.remaining }, null, 2));
