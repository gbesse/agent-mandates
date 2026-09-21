# Release validation

Checks performed locally on 2026-09-21 with Node.js 24.11.1 for v0.1.0.

- `npm run typecheck`: passed; public SDK and Jev adapter imports compile, with negative API examples.
- `npm run check`: passed; all JavaScript sources parse.
- `npm test`: 17 tests passed, zero failures, zero skipped.
- `npm run demo`: passed using fictional local fixtures.
- CLI tests cover a full file workflow, visible argument failures and refusal to overwrite snapshots.
- The Jev HTTP test uses the real DecisionPacks provider against a loopback server, validates the request and consumes a synthetic typed response.

The committed CI workflow repeats type, syntax, test and demo checks on Node.js 22 and 24. GitHub Actions supplies its own run history. No build command was run or configured.

No live TypeSafe inference, customer-data evaluation, independent security audit or production deployment was performed. The tests establish implementation behavior, not model accuracy or customer demand.
