// Purpose: Declare mandate issuance, bounded reservation and signed snapshot persistence.
import type { JSONValue } from '@gbesse/decisionpacks';
export interface Scope { operation: string; resource: string }
export interface GrantInput { subject: string; audience: string; purpose: string; approvedBy: string; currency: string; budgetMinor: number; maxCalls: number; scopes: Scope[]; notBefore: string; expiresAt: string }
export interface Grant extends GrantInput { schemaVersion: 1; id: string; parentId: string | null }
export type Delegation = Pick<GrantInput, 'subject' | 'budgetMinor' | 'maxCalls' | 'scopes' | 'notBefore' | 'expiresAt'>;
export interface ActionRequest { requestId: string; actor: string; audience: string; operation: string; resource: string; currency: string; costMinor: number; parameters?: JSONValue }
export interface Receipt { id: string; requestId: string; grantId: string; ancestorIds: string[]; costMinor: number; digest: string; reservedAt: string }
export type Reservation = { status: 'reserved'; execute: true; receipt: Receipt } | { status: 'duplicate'; execute: false; receipt: Receipt };
export interface AuditEvent { sequence: number; at: string; type: string; details: Record<string, string> }
export interface Authority { issue(input: GrantInput): Promise<string>; delegate(parentToken: string, input: Delegation): Promise<string>; inspect(token: string): { grant: Grant; usage: { calls: number; budgetMinor: number } }; reserve(token: string, request: ActionRequest): Promise<Reservation>; revoke(token: string, reason: string): Promise<void>; snapshot(): string; audit(): AuditEvent[] }
export interface AuthorityOptions { secret: string | Uint8Array; snapshot?: string; now?: () => number; persist?: (signedSnapshot: string, revisions: { previousRevision: number; revision: number }) => Promise<void>; persistTimeoutMs?: number }
export function createAuthority(options: AuthorityOptions): Authority;
