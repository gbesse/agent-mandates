// Purpose: Type the optional Jev adapter and injected provider contract.
import type { Provider, DecisionRecord } from '@gbesse/decisionpacks';
export interface JevOptions { provider?: Provider; signal?: AbortSignal }
export function reviewIntent(input: { purpose: string; proposedAction: string }, options?: JevOptions): Promise<{ advisory: true; authorizationGranted: false; status: string; record: DecisionRecord }>;
