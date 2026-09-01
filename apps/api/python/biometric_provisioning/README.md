# G3 Pro provisioning worker

This private worker polls `biometric_provisioning_jobs` and reaches registered terminals directly on TCP port 4370. It must run on the facility LAN and must not be exposed through an ingress or public service.

The pyzk dependency is pinned to commit `f29709c17bb8f1bbb5382d2670b493207cb35ff1`. Treat that revision as compatibility-gate material: audit and test it against the enrollment source and one authorized target before enabling production apply jobs.

Only sanitized IDs, counts, conflicts, status, and errors are persisted. Fingerprint template objects remain in worker memory, are never serialized, and are released after each job.

Environment:

- `DATABASE_URL` (required)
- `PROVISIONING_POLL_SECONDS` (default `3`)
- `PROVISIONING_WRITES_ENABLED` (default `false`; set to `true` only after the documented compatibility gate passes)
- `LOG_LEVEL` (default `INFO`)

Keep writes disabled for the source/one-target read test. Enable them in the controlled compatibility environment for an authorized test user, then verify reboot authentication, targeted replacement/deletion, idempotency, attendance preservation, and lock release. Production should progress through target selections of one, two, and finally all nine devices.
