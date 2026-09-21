// Purpose: Compile public imports and reject representative invalid calls without executing them.
import { createAuthority, type GrantInput, type ActionRequest } from '@gbesse/agent-mandates';
import { reviewIntent } from '@gbesse/agent-mandates/jev';
const authority = createAuthority({ secret: 'test-secret', persist: async (snapshot, revisions) => { const revision: number = revisions.previousRevision; void revision; void snapshot; } });
async function example(grant: GrantInput, action: ActionRequest) { const token = await authority.issue(grant); const result = await authority.reserve(token, action); if (result.status === 'duplicate') { const execute: false = result.execute; void execute; } }
void example; void reviewIntent;
// @ts-expect-error Signing secret is mandatory.
createAuthority({});
