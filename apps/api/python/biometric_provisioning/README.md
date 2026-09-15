# G3 Pro provisioning worker

This private worker polls `biometric_provisioning_jobs` and reaches registered terminals directly on TCP port 4370. It must run on the facility LAN and must not be exposed through an ingress or public service.

The pyzk dependency is pinned to commit `f29709c17bb8f1bbb5382d2670b493207cb35ff1`. Treat that revision as compatibility-gate material: audit and test it against the enrollment source and one authorized target before enabling production apply jobs.

Only sanitized IDs, counts, conflicts, status, and errors are persisted. Face and fingerprint template objects remain in worker memory, are never serialized to the database/API or files, and are released after each job.

New previews include `summary.source` with downloaded user/template counts,
device-reported inventory counts and user record size. Employee IDs absent from
downloaded users are reported separately from matched users without downloaded
fingerprints. Numeric IDs that differ only by padding are diagnostic candidates;
they are not automatically merged. These summaries contain counts and IDs only.
Compare downloaded counts with reported counts before re-enrolling employees.
Eligibility requires an exact matching user with a readable face **or** fingerprint
enrollment. Card/PIN-only users are not eligible. Diagnostics retain fingerprint
counts and add downloaded face counts and IDs without either enrollment type.

Environment:

- `DATABASE_URL` (required)
- `PROVISIONING_DEVICE_BACKEND`: `pyzk` (default, fingerprint-only) or `zkteco-sdk` (Windows, face and fingerprint)
- `PROVISIONING_POLL_SECONDS` (default `3`)
- `PROVISIONING_WRITES_ENABLED` (default `false`; set to `true` only after the documented compatibility gate passes)
- `LOG_LEVEL` (default `INFO`)

Keep writes disabled for the source/one-target read test. Enable them in the controlled compatibility environment for an authorized test user, then verify reboot authentication, targeted replacement/deletion, idempotency, attendance preservation, and lock release. Select the currently available registered targets; later targets can receive a new full-sync preview independently.

## Face provisioning setup

The current Linux Docker image remains fingerprint-only. Rebuilding it cannot add
the Windows COM SDK. Run **one** provisioning worker on a Windows host on the device
LAN to provision the G3 Pro's face enrollments. Stop the previous provisioning
worker first so it cannot claim face jobs with the wrong backend. Attendance pull
workers can continue running separately.

1. Install Python 3.12, Git, and ZKTeco's Standalone SDK (6.3.1.54 or later, from the vendor). Register
   `zkemkeeper.dll` using the SDK's supplied installer/registration script. Python
   and the registered SDK must have matching architecture (32-bit or 64-bit).
2. Copy the `biometric_provisioning` directory to the host. From that directory:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   $env:PROVISIONING_DEVICE_BACKEND = 'zkteco-sdk'
   $env:PROVISIONING_WRITES_ENABLED = 'false'
   # Set DATABASE_URL securely in this process/service environment.
   .\.venv\Scripts\python.exe worker.py
   ```

3. Create a **new** preview for the source and one selected target. Old previews
   retain their original fingerprint-only diagnostics. Check that faces are
   downloaded and the missing source IDs are accurate. The five genuinely absent
   IDs still need correction/enrollment; full sync does not silently skip them.
4. When the existing compatibility gate passes, restart the worker with
   `PROVISIONING_WRITES_ENABLED=true`, then apply a fresh preview.

The SDK adapter uses `GetUserFaceStr` / `SetUserFaceStr` with face index **50**
(all samples), exact string IDs, and the native length returned by the SDK.
It closes the pyzk TCP session before opening an SDK session, then restores it.
Source and target face algorithm versions are read from the devices and must be
known and equal before target writes. SDK errors -102/-103 indicate incompatible
face versions; -8 is a receive timeout, not a missing enrollment. Errors 0/-100
can indicate absent data; a reported nonzero face inventory with no downloaded
faces fails explicitly as a reader/SDK problem.

Previews only read. Apply copies face and fingerprint enrollments, replaces stale
faces for changed users, and verifies the downloaded payloads. Departure removes
the selected user's faces and user enrollment without clearing attendance logs.
No public face API, template database table, or SDK DLL redistribution is added.

## Research and validation

- [ZKTeco iFace SDK handbook](https://soporte.tvc.mx/Ingenieria/ZK/MANUALES/Manuales%20SDK/Equipos%20iFace/iFace%20Series%20Communication%20Protocol%20SDK%20Development%20Handbook-V6.14.pdf): documented face template read/write functions and index 50.
- [ZKTeco Standalone SDK manual](https://studylib.net/doc/25367562/zkteco-standalone-sdk-development-manual-v2.1-a.2-en): native template length and SDK error meanings.
- [Upstream pyzk implementation](https://github.com/fananimi/pyzk/blob/f29709c17bb8f1bbb5382d2670b493207cb35ff1/zk/base.py): user/fingerprint support, face version query, no face-writing API.
- [Upstream face-transfer experiment](https://github.com/fananimi/pyzk/issues/259): speculative TCP writes were unsuccessful; those guessed packets are not used here.
- [ZKTeco protocol update](https://zktecouk.co.uk/standalone-protocol-update/): SDK 6.3.1.54 or later and `SetCommPasswordEx` for newer firmware. The adapter prefers this method when available. User/fingerprint operations still use pyzk, so this worker requires firmware that also permits its legacy TCP connection; it does not claim support for newer SDK-only terminals.

Run `python -B -m unittest discover -s . -p 'test_*.py' -v` from this directory.
Tests use SDK/device/database doubles. Actual Windows COM registration, G3 Pro
firmware compatibility, and authentication after transfer require the LAN test
above; they have not been verified by these unit tests.
