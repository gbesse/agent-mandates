// Purpose: Supply a fictional purchase-drafting mandate without permission to buy or pay.
export function exampleGrant(now = Date.now()) {
  return { subject: 'assistant-1', audience: 'demo-procurement', purpose: 'Prepare supplier renewal drafts.', approvedBy: 'demo-human', currency: 'EUR', budgetMinor: 1000, maxCalls: 3, scopes: [{ operation: 'draft', resource: 'supplier/42' }], notBefore: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60_000).toISOString() };
}
export const exampleAction = { requestId: 'draft-1', actor: 'assistant-1', audience: 'demo-procurement', operation: 'draft', resource: 'supplier/42', currency: 'EUR', costMinor: 200 };
