# Contributing

This guide explains how to contribute code and examples.

Use Node.js 22 or newer. Install dependencies with `npm ci --ignore-scripts`.
Run `npm run typecheck` to validate public TypeScript declarations. No build is required.
Run `npm run check`, `npm test`, and `npm run demo` before submitting a pull request.
Add a regression case when fixing nontrivial behavior. Keep sample data synthetic,
mark fixture-based demonstrations explicitly, and never commit credentials or customer records.
Describe the problem, resulting behavior, and validation in your pull request.
