# Persistence and execution contract

This document explains the guarantees the host must supply before Agent Mandates can gate real external actions.

## One authoritative ledger

An authority serializes its own mutations. With no `persist` adapter it is an in-memory authority only. Signed snapshots prevent undetected alteration without the secret, but do not prevent rollback, copying, or concurrent forks. A valid old snapshot can authorize previously spent budget again if it becomes authoritative.

Keep the latest snapshot in one durable, access-controlled store. The adapter receives `(signedSnapshot, { previousRevision, revision })`. Atomically compare the current stored revision against `previousRevision`, replace it with the new snapshot and `revision`, and acknowledge durable completion. Reject a stale revision, even if its signature is valid. Initialize a new ledger at revision zero only when the ledger does not already exist. Serialize initial creation too. The authority's signing key must identify the intended ledger; do not share one key between independent environments.

Two authorities racing from the same snapshot must not both commit. A losing or failed authority becomes unusable for mutations and must reload the latest durable snapshot. The default persistence deadline is ten seconds. Timeout does not cancel an adapter that is still running: treat the outcome as ambiguous and consult the store before proceeding. Do not immediately retry from an old snapshot. `inspect` and `snapshot` can still expose the last local state after failure; they are not permission to execute.

A host must implement this adapter; no database driver is bundled. Production deployments also need key rotation, backup/restore rules that preserve monotonicity, access control, monitoring and failure handling appropriate to the protected tools. This alpha does not claim distributed consensus or externally audited security.

## Reserve before an effect

The trusted gateway authenticates identity and determines canonical operation/resource pairs, currency, cost and tool parameters. It obtains a reservation and waits for durable acknowledgement before execution. The declared `costMinor` is the amount charged; there is no way to infer or verify provider billing here. Use a conservative upper bound where costs vary, or refuse actions whose costs cannot be bounded.

`execute: false` on a duplicate means do not execute again. If a process crashes between reservation and effect, the reservation remains spent. Use the receipt ID as the external tool's idempotency key and maintain a durable outbox/effect status to recover that gap. The library does not supply that outbox. Never retry effects blindly, refund ambiguous outcomes, or interpret a duplicate as fresh permission.

A reservation is a point-in-time decision. Revocation prevents later reservations but cannot cancel an already authorized or running effect. Gate execution and revocation through the host's transaction/queue if stricter semantics are needed. Caller-supplied approval names and model alignment scores are not authentication or consent.

## Administrator alerts

Catch failures at the application boundary, stop the affected action, and call the host's configured administrator reporter with a project/environment tag. Do not include signing keys or complete tokens in reports. This repository has no email credentials and never silently sends mail.
