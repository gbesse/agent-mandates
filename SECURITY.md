# Security boundary

This file explains the trust boundary of this alpha.

Model responses and imported data are untrusted. The host application owns authentication, authorization, retention and administrator alerts. Exceptions propagate; the CLI exits unsuccessfully. No silent error fallback or automatic email is configured. Use private vulnerability reporting if available, and do not include secrets in public issues.
