// Demonstrate budget denial with synthetic mandates and no external action.
import {randomBytes} from 'node:crypto';
import {createAuthority} from '../src/index.mjs';
import {exampleGrant, exampleAction} from './fixtures.mjs';

const authority = createAuthority({secret: randomBytes(32)});
const token = await authority.issue({...exampleGrant(), budgetMinor: 300});
const first = await authority.reserve(token, exampleAction);
let secondDenied = false;
try {
  await authority.reserve(token, {...exampleAction, requestId: 'draft-2'});
} catch (error) {
  secondDenied = /limit exceeded/.test(error.message);
}
if (!first.execute || !secondDenied) throw new Error('Synthetic budget guard did not hold');
const usage = authority.inspect(token).usage;
console.log(JSON.stringify({source: 'synthetic in-memory mandate; no tool execution', firstExecute: first.execute, secondDenied, spentMinor: usage.budgetMinor, remainingMinor: 300 - usage.budgetMinor}, null, 2));
