# AI changelog

Implementation decisions and validation for this project.

## 2026-09-25 — Effective remaining limits

- Add `remaining` to mandate inspection results without changing reservation behavior.
- Calculate effective calls and budget as the tightest remaining limit across the full delegation chain.
- Demonstrate the new result offline and cover shared sibling consumption in the test suite.
- Revalidate declarations, syntax, 17 tests and the offline demo on the maintenance branch.

## 2026-09-21 — First public alpha

- Purpose: Bound agent actions with signed mandates, attenuated delegation and an idempotent budget ledger.
- Reuse the pinned DecisionPacks provider for model calls, deadlines and response validation.
- Native Node.js modules and public TypeScript declarations; no build.
- Provide working immutable JSON CLI workflows, offline fixtures and optional typed Jev adapters.
- Validate SDK declarations, syntax, 17 tests, actual HTTP serialization against a local server, and the offline demo.
- Configure Node.js 22/24 CI; publish as a GitHub alpha with explicit trust and integration boundaries.
