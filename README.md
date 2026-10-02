# Agent Mandates

Signed, limited permissions for agent actions, with shared delegation budgets and durable reservation hooks.

**Public alpha · Node.js 22+ · MIT · JavaScript SDK + CLI.** An authority issues a mandate with exact operation/resource pairs, audience, subject, validity interval, currency, call limit and budget. Delegates can narrow those rights. A reservation checks every ancestor before the host may execute an action.

## Try it offline

```sh
git clone https://github.com/gbesse/agent-mandates.git
cd agent-mandates
npm ci --ignore-scripts
npm run demo
node examples/write-fixtures.mjs
export MANDATE_SIGNING_KEY="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"
node bin/agent-mandates.mjs issue local-data/grant.json local-data/authority0.json
node bin/agent-mandates.mjs reserve local-data/authority0.json local-data/action.json local-data/authority1.json
node bin/agent-mandates.mjs reserve local-data/authority1.json local-data/action.json local-data/authority2.json
node bin/agent-mandates.mjs inspect local-data/authority2.json
```

The repeated request returns `execute: false` and the charge remains 200 minor units. Example grants expire one hour after fixture generation. Preserve the signing key for the session; do not commit it or the signed authority files.

**The file CLI is a sequential demonstration.** Always use its newest snapshot. Copying an old file or using two authority processes can reuse a budget. Use an authoritative durable store with compare-and-swap revisions for real gateways; see [the persistence contract](docs/persistence.md).

## Watch the budget stop a second action

`npm run demo:budget` issues a synthetic mandate with 300 minor units, reserves one 200-unit draft and rejects a different 200-unit draft. The report shows the remaining budget without executing any tool. This example uses an in-memory authority; a real gateway still needs the durable compare-and-swap store described below.

## Embed it at a trusted tool gateway

```sh
npm install github:gbesse/agent-mandates#v0.1.1
```

```js
import { createAuthority } from '@gbesse/agent-mandates';
const authority = createAuthority({
  secret: signingSecret,
  snapshot: latestSignedSnapshot,
  persist: async (snapshot, { previousRevision, revision }) => {
    // Your store must atomically reject stale revisions and acknowledge durable storage.
    await store.compareAndSwap(previousRevision, revision, snapshot);
  },
  persistTimeoutMs: 10_000,
});
const token = await authority.issue(humanApprovedGrant);
const reservation = await authority.reserve(token, trustedActionRequest);
if (reservation.execute) {
  // Your adapter needs its own deadline and idempotency on reservation.receipt.id.
  await executeApprovedTool(trustedActionRequest, reservation.receipt.id);
}
```

`store` and `executeApprovedTool` are host integration points, not bundled implementations. [Public types](src/index.d.mts) define the required grant and request fields. `delegate`, `inspect`, `revoke`, `snapshot` and `audit` complete the API. Revoking a parent invalidates descendants. `parameters` can bind JSON tool arguments into the request digest.

## Enforcement contract

- The host authenticates the approver, caller and audience. `approvedBy` and `actor` are claims supplied by the host; passing strings does not authenticate anyone.
- The trusted gateway determines costs and canonical resource IDs. An agent must not choose its own charge. Amounts are integer minor currency units; no exchange rates or wildcard scopes are implemented.
- All descendants spend the ancestor's remaining limits. Reservations consume the budget before returning permission, and are not automatically refunded after failures.
- Duplicate request IDs with identical content return `execute: false`. Changed content or another grant reusing the ID fails.
- Signing uses HMAC-SHA256 with a secret of at least 32 bytes. Anyone with that secret can issue mandates. Keep it outside agent prompts and processes.
- This is a library, not a proxy that intercepts every tool. The host must route all protected actions through it.

## Optional Jev intent review

`reviewIntent({ purpose, proposedAction }, { provider?, signal? })` from `@gbesse/agent-mandates/jev` flags possible intent drift. The default provider uses `TYPESAFE_API_KEY` and sends those two strings to TypeSafe. The result always has `authorizationGranted: false`, even when no drift is flagged. No model response grants authority or expands budgets.

The potential adoption advantage is a common mandate format embedded in tool adapters and approval workflows. This alpha has neither an adapter marketplace nor independent security certification, and its budget guarantees depend on the persistence and execution contract above.

## Validation and Jev integration

```sh
npm run typecheck
npm run check
npm test
npm run demo
```

CI runs these checks on Node.js 22 and 24 without a build step. Tests use fictional fixtures and injected model responses. **No live Jev call or model-quality benchmark was performed for this release.** The default adapter targets `jev-1.13.0` through the pinned [DecisionPacks](https://github.com/gbesse/decisionpacks) dependency, with response validation and explicit timeouts. Live requests require your TypeSafe account and may incur charges. See [TypeSafe's API documentation](https://docs.typesafe.ai/api) and [model documentation](https://docs.typesafe.ai/models).

Library errors propagate; CLI failures print to stderr and exit nonzero. Embedding applications own error reporting and administrator alerts. There is no telemetry or configured email service. See [SECURITY.md](SECURITY.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Related projects

[DecisionPacks](https://github.com/gbesse/decisionpacks) · [Autonomy Meter](https://github.com/gbesse/autonomy-meter) · [IntentBus](https://github.com/gbesse/intentbus) · [ExceptionOS](https://github.com/gbesse/exceptionos) · [Agent Mandates](https://github.com/gbesse/agent-mandates) · [MatchGraph](https://github.com/gbesse/matchgraph) · [WorldKit](https://github.com/gbesse/worldkit)

Independent projects; no affiliation with TypeSafe. MIT licensed.
