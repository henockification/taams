"""Database-backed, sequential G3 Pro provisioning worker.

Logs are deliberately limited to job/device identifiers and sanitized errors.
Template objects are retained only in process memory for the duration of one job.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import time
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from device_adapter import DeviceAdapter, DeviceConfig, DeviceUser, FingerTemplate, PyzkDeviceAdapter


logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("biometric-provisioning")
STOP = False


def _stop(*_: Any) -> None:
    global STOP
    STOP = True


signal.signal(signal.SIGTERM, _stop)
signal.signal(signal.SIGINT, _stop)


class ProvisioningWorker:
    def __init__(self, database_url: str, adapter_factory=PyzkDeviceAdapter):
        self.database_url = database_url
        self.adapter_factory = adapter_factory

    def run_forever(self) -> None:
        interval = max(float(os.getenv("PROVISIONING_POLL_SECONDS", "3")), 0.5)
        LOGGER.info("Biometric provisioning worker started")
        while not STOP:
            try:
                if not self.run_once():
                    time.sleep(interval)
            except Exception as error:
                LOGGER.error("Worker poll failed: %s", self._safe_error(error))
                time.sleep(interval)

    def run_once(self) -> bool:
        with self._connect() as connection:
            job = self._claim_job(connection)
            if not job:
                return False
            try:
                self._process_job(connection, job)
            except Exception as error:
                LOGGER.error("Job %s failed: %s", job["id"], self._safe_error(error))
                self._fail_unfinished_results(connection, job["id"], self._safe_error(error))
                self._finish_job(connection, job["id"], "FAILED", {}, self._safe_error(error))
            return True

    def _process_job(self, connection: psycopg.Connection, job: dict[str, Any]) -> None:
        devices = self._load_devices(connection, job)
        source = devices[job["source_device_id"]]
        employees = self._load_employees(connection, job)
        owner_id = f'job:{job["id"]}'

        if not self._acquire_lock(connection, source["id"], owner_id):
            raise RuntimeError("Enrollment source is currently locked")

        source_adapter = self._adapter(source)
        try:
            source_adapter.connect()
            self._update_device_metadata(connection, source, source_adapter.metadata())
            source_users = {user.user_id: user for user in source_adapter.users()}
            source_templates = self._templates_by_uid(source_adapter.templates())

            if job["mode"] == "FULL_SYNC":
                desired = employees
            else:
                desired = employees

            source_records = self._resolve_source_records(job, desired, source_users, source_templates)
            for device_id in job["requested_target_device_ids"]:
                self._renew_lock(connection, source["id"], owner_id)
                self._process_device(connection, job, devices[device_id], source_records, owner_id)

            if job["mode"] == "EMPLOYEE_REMOVE":
                self._process_removal_source(connection, job, source, source_adapter, source_users, desired)
        finally:
            try:
                source_adapter.disconnect()
            finally:
                self._release_lock(connection, source["id"], owner_id)

        results = self._load_results(connection, job["id"])
        failed = sum(1 for result in results if result["status"] == "FAILED")
        completed = sum(1 for result in results if result["status"] == "COMPLETED")
        summary = {
            "devicesTotal": len(results),
            "devicesCompleted": completed,
            "devicesFailed": failed,
            "addedUsers": sum(result["added_users"] for result in results),
            "updatedUsers": sum(result["updated_users"] for result in results),
            "removedUsers": sum(result["removed_users"] for result in results),
            "missingTemplates": sum(result["missing_templates"] for result in results),
            "uidConflicts": sum(result["uid_conflicts"] for result in results),
        }
        if job["is_preview"]:
            status = "WAITING_CONFIRMATION" if job["mode"] == "EMPLOYEE_REMOVE" else "PREVIEW_READY"
            if failed == len(results):
                status = "FAILED"
        else:
            status = "FAILED" if completed == 0 else ("PARTIAL" if failed else "COMPLETED")
        self._finish_job(connection, job["id"], status, summary, None)

    def _process_device(
        self,
        connection: psycopg.Connection,
        job: dict[str, Any],
        device: dict[str, Any],
        source_records: dict[str, tuple[DeviceUser, list[FingerTemplate]]],
        owner_id: str,
    ) -> None:
        self._mark_result_running(connection, job["id"], device["id"])
        if not self._acquire_lock(connection, device["id"], owner_id):
            self._fail_result(connection, job["id"], device["id"], "Device is currently locked")
            return

        adapter = self._adapter(device)
        try:
            adapter.connect()
            self._update_device_metadata(connection, device, adapter.metadata())
            target_users = adapter.users()
            target_templates = self._templates_by_uid(adapter.templates())
            differences = self._differences(job, source_records, target_users, target_templates)

            if differences["uidConflicts"] or differences["missingSourceTemplates"]:
                self._complete_result(connection, job, device, differences, failed=True)
                return

            if not job["is_preview"]:
                if os.getenv("PROVISIONING_WRITES_ENABLED", "false").lower() != "true":
                    raise RuntimeError("Production writes are disabled until the compatibility gate is approved")
                self._apply_changes(adapter, job, source_records, target_users, differences)
                verified_users = adapter.users()
                verified_templates = self._templates_by_uid(adapter.templates())
                self._verify(job, source_records, verified_users, verified_templates)

            self._complete_result(connection, job, device, differences, failed=False)
        except Exception as error:
            self._fail_result(connection, job["id"], device["id"], self._safe_error(error))
        finally:
            try:
                adapter.disconnect()
            except Exception:
                pass
            self._release_lock(connection, device["id"], owner_id)

    def _resolve_source_records(
        self,
        job: dict[str, Any],
        employees: list[dict[str, Any]],
        users: dict[str, DeviceUser],
        templates: dict[int, list[FingerTemplate]],
    ) -> dict[str, tuple[DeviceUser, list[FingerTemplate]]]:
        records: dict[str, tuple[DeviceUser, list[FingerTemplate]]] = {}
        if job["mode"] == "EMPLOYEE_REMOVE":
            return records
        for employee in employees:
            biometric_id = employee["biometric_id"]
            source_user = users.get(biometric_id)
            if source_user:
                records[biometric_id] = (source_user, templates.get(source_user.uid, []))
            else:
                # A synthetic record lets every target report the missing enrollment without writes.
                records[biometric_id] = (DeviceUser(-1, biometric_id, employee["name"], None), [])
        return records

    def _differences(
        self,
        job: dict[str, Any],
        source_records: dict[str, tuple[DeviceUser, list[FingerTemplate]]],
        target_users: list[DeviceUser],
        target_templates: dict[int, list[FingerTemplate]],
    ) -> dict[str, Any]:
        by_user_id = {user.user_id: user for user in target_users}
        by_uid = {user.uid: user for user in target_users}
        result: dict[str, Any] = {
            "missingUsers": [], "updatedUsers": [], "removals": [],
            "missingSourceTemplates": [], "uidConflicts": [],
        }
        if job["mode"] == "EMPLOYEE_REMOVE":
            requested_ids = set(job["employee_biometric_ids"])
            result["removals"] = sorted(user_id for user_id in requested_ids if user_id in by_user_id)
            return result

        for biometric_id, (source_user, fingers) in source_records.items():
            if source_user.uid < 0 or not fingers:
                result["missingSourceTemplates"].append(biometric_id)
                continue
            occupant = by_uid.get(source_user.uid)
            existing = by_user_id.get(biometric_id)
            if occupant and occupant.user_id != biometric_id:
                result["uidConflicts"].append({
                    "uid": source_user.uid,
                    "expectedBiometricId": biometric_id,
                    "actualBiometricId": occupant.user_id,
                })
                continue
            if existing and existing.uid != source_user.uid:
                result["uidConflicts"].append({
                    "uid": source_user.uid,
                    "expectedBiometricId": biometric_id,
                    "actualUid": existing.uid,
                })
                continue
            if not existing:
                result["missingUsers"].append(biometric_id)
                continue
            target_fingers = {finger.finger_id: finger.ephemeral_value() for finger in target_templates.get(existing.uid, [])}
            source_fingers = {finger.finger_id: finger.ephemeral_value() for finger in fingers}
            if existing.name != source_user.name or target_fingers != source_fingers:
                result["updatedUsers"].append(biometric_id)
        return result

    def _apply_changes(
        self,
        adapter: DeviceAdapter,
        job: dict[str, Any],
        source_records: dict[str, tuple[DeviceUser, list[FingerTemplate]]],
        target_users: list[DeviceUser],
        differences: dict[str, Any],
    ) -> None:
        adapter.disable()
        try:
            if job["mode"] == "EMPLOYEE_REMOVE":
                target_by_id = {user.user_id: user for user in target_users}
                for biometric_id in differences["removals"]:
                    adapter.delete_user(target_by_id[biometric_id])
            else:
                changed = set(differences["missingUsers"] + differences["updatedUsers"])
                for biometric_id in changed:
                    user, fingers = source_records[biometric_id]
                    adapter.upsert_user_with_templates(user, fingers)
            adapter.refresh()
        finally:
            adapter.enable()

    def _verify(
        self,
        job: dict[str, Any],
        source_records: dict[str, tuple[DeviceUser, list[FingerTemplate]]],
        users: list[DeviceUser],
        templates: dict[int, list[FingerTemplate]],
    ) -> None:
        by_id = {user.user_id: user for user in users}
        if job["mode"] == "EMPLOYEE_REMOVE":
            remaining = set(job["employee_biometric_ids"]) & set(by_id)
            if remaining:
                raise RuntimeError("Read-back verification found users that should have been removed")
            return
        for biometric_id, (source_user, source_fingers) in source_records.items():
            target_user = by_id.get(biometric_id)
            if not target_user or target_user.uid != source_user.uid:
                raise RuntimeError(f"Read-back identity verification failed for biometric ID {biometric_id}")
            source_slots = {finger.finger_id for finger in source_fingers}
            target_slots = {finger.finger_id for finger in templates.get(target_user.uid, [])}
            if source_slots != target_slots:
                raise RuntimeError(f"Read-back template verification failed for biometric ID {biometric_id}")

    def _process_removal_source(
        self,
        connection: psycopg.Connection,
        job: dict[str, Any],
        source: dict[str, Any],
        adapter: DeviceAdapter,
        source_users: dict[str, DeviceUser],
        employees: list[dict[str, Any]],
    ) -> None:
        self._mark_result_running(connection, job["id"], source["id"])
        biometric_ids = [employee["biometric_id"] for employee in employees]
        removals = [biometric_id for biometric_id in biometric_ids if biometric_id in source_users]
        differences = {"missingUsers": [], "updatedUsers": [], "removals": removals, "missingSourceTemplates": [], "uidConflicts": []}
        try:
            if not job["is_preview"]:
                if os.getenv("PROVISIONING_WRITES_ENABLED", "false").lower() != "true":
                    raise RuntimeError("Production writes are disabled until the compatibility gate is approved")
                self._apply_changes(adapter, job, {}, list(source_users.values()), differences)
                self._verify(job, {}, adapter.users(), {})
            self._complete_result(connection, job, source, differences, failed=False)
        except Exception as error:
            self._fail_result(connection, job["id"], source["id"], self._safe_error(error))

    def _load_employees(self, connection: psycopg.Connection, job: dict[str, Any]) -> list[dict[str, Any]]:
        if job["mode"] == "FULL_SYNC":
            rows = connection.execute(
                """SELECT id, biometric_id, concat_ws(' ', first_name_en, middle_name_en, last_name_en) AS name
                   FROM employees WHERE is_active = true AND employment_status = 'ACTIVE' AND biometric_id IS NOT NULL
                   ORDER BY employee_code"""
            ).fetchall()
        else:
            rows = connection.execute(
                """SELECT id, biometric_id, concat_ws(' ', first_name_en, middle_name_en, last_name_en) AS name
                   FROM employees WHERE id = ANY(%s::uuid[]) AND biometric_id IS NOT NULL""",
                (job["requested_employee_ids"],),
            ).fetchall()
        job["employee_biometric_ids"] = [row["biometric_id"] for row in rows]
        return rows

    def _load_devices(self, connection: psycopg.Connection, job: dict[str, Any]) -> dict[str, dict[str, Any]]:
        ids = list(dict.fromkeys([job["source_device_id"], *job["requested_target_device_ids"]]))
        rows = connection.execute(
            """SELECT id::text, device_name, ip_address, COALESCE(port, 4370) AS port,
                      COALESCE(NULLIF(communication_key, ''), '0') AS communication_key
               FROM biometric_devices WHERE id = ANY(%s::uuid[]) AND is_active = true AND provisioning_enabled = true""",
            (ids,),
        ).fetchall()
        devices = {row["id"]: row for row in rows}
        if set(ids) != set(devices):
            raise RuntimeError("One or more provisioning devices are inactive or unavailable")
        if any(not device["ip_address"] for device in devices.values()):
            raise RuntimeError("Every provisioning device must have an IP address")
        return devices

    def _claim_job(self, connection: psycopg.Connection) -> dict[str, Any] | None:
        with connection.transaction():
            return connection.execute(
                """UPDATE biometric_provisioning_jobs SET status = 'RUNNING', started_at = now(), updated_at = now()
                   WHERE id = (SELECT id FROM biometric_provisioning_jobs WHERE status = 'QUEUED'
                               ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
                   RETURNING *, source_device_id::text"""
            ).fetchone()

    def _load_results(self, connection: psycopg.Connection, job_id: str) -> list[dict[str, Any]]:
        return connection.execute(
            "SELECT * FROM biometric_provisioning_device_results WHERE job_id = %s::uuid", (job_id,)
        ).fetchall()

    def _mark_result_running(self, connection: psycopg.Connection, job_id: str, device_id: str) -> None:
        connection.execute(
            """UPDATE biometric_provisioning_device_results
               SET status='RUNNING', attempts=attempts+1, started_at=now(), completed_at=NULL,
                   error_message=NULL, updated_at=now() WHERE job_id=%s::uuid AND device_id=%s::uuid""",
            (job_id, device_id),
        )
        connection.commit()

    def _complete_result(self, connection: psycopg.Connection, job: dict[str, Any], device: dict[str, Any], differences: dict[str, Any], failed: bool) -> None:
        error = "UID conflict or missing source enrollment blocks this device" if failed else None
        connection.execute(
            """UPDATE biometric_provisioning_device_results SET status=%s,
                      added_users=%s, updated_users=%s, removed_users=%s,
                      missing_templates=%s, uid_conflicts=%s, differences=%s::jsonb,
                      error_message=%s, completed_at=now(), updated_at=now()
               WHERE job_id=%s::uuid AND device_id=%s::uuid""",
            (
                "FAILED" if failed else "COMPLETED",
                len(differences["missingUsers"]), len(differences["updatedUsers"]), len(differences["removals"]),
                len(differences["missingSourceTemplates"]), len(differences["uidConflicts"]),
                json.dumps(differences), error, job["id"], device["id"],
            ),
        )
        connection.execute(
            """UPDATE biometric_devices SET last_provisioning_at=now(), last_provisioning_status=%s, updated_at=now()
               WHERE id=%s::uuid""", ("FAILED" if failed else ("PREVIEW" if job["is_preview"] else "COMPLETED"), device["id"]),
        )
        connection.commit()

    def _fail_result(self, connection: psycopg.Connection, job_id: str, device_id: str, error: str) -> None:
        connection.execute(
            """UPDATE biometric_provisioning_device_results SET status='FAILED', error_message=%s,
                      completed_at=now(), updated_at=now() WHERE job_id=%s::uuid AND device_id=%s::uuid""",
            (error, job_id, device_id),
        )
        connection.execute(
            "UPDATE biometric_devices SET last_provisioning_at=now(), last_provisioning_status='FAILED', updated_at=now() WHERE id=%s::uuid",
            (device_id,),
        )
        connection.commit()

    def _fail_unfinished_results(self, connection: psycopg.Connection, job_id: str, error: str) -> None:
        connection.execute(
            """UPDATE biometric_provisioning_device_results SET status='FAILED', error_message=%s,
                      completed_at=now(), updated_at=now()
               WHERE job_id=%s::uuid AND status IN ('PENDING', 'RUNNING')""",
            (error, job_id),
        )
        connection.commit()

    def _finish_job(self, connection: psycopg.Connection, job_id: str, status: str, summary: dict[str, Any], error: str | None) -> None:
        connection.execute(
            """UPDATE biometric_provisioning_jobs SET status=%s, summary=%s::jsonb, error_message=%s,
                      completed_at=now(), updated_at=now() WHERE id=%s::uuid""",
            (status, json.dumps(summary), error, job_id),
        )
        connection.commit()

    def _update_device_metadata(self, connection: psycopg.Connection, device: dict[str, Any], metadata: dict[str, str | None]) -> None:
        connection.execute(
            """UPDATE biometric_devices SET firmware_version=COALESCE(%s, firmware_version),
                      platform_version=COALESCE(%s, platform_version), serial_number=COALESCE(%s, serial_number),
                      fingerprint_algorithm=COALESCE(%s, fingerprint_algorithm), last_seen_at=now(), health_status='ONLINE', updated_at=now()
               WHERE id=%s::uuid""",
            (metadata["firmware"], metadata["platform"], metadata["serial"], metadata["fingerprintAlgorithm"], device["id"]),
        )
        connection.commit()

    def _acquire_lock(self, connection: psycopg.Connection, device_id: str, owner_id: str) -> bool:
        connection.execute("DELETE FROM biometric_device_locks WHERE device_id=%s::uuid AND expires_at <= now()", (device_id,))
        row = connection.execute(
            """INSERT INTO biometric_device_locks (device_id, owner_type, owner_id, acquired_at, expires_at)
               VALUES (%s::uuid, 'PROVISIONING', %s, now(), %s)
               ON CONFLICT (device_id) DO NOTHING RETURNING device_id""",
            (device_id, owner_id, datetime.now(timezone.utc) + timedelta(minutes=30)),
        ).fetchone()
        connection.commit()
        return row is not None

    def _release_lock(self, connection: psycopg.Connection, device_id: str, owner_id: str) -> None:
        connection.execute(
            "DELETE FROM biometric_device_locks WHERE device_id=%s::uuid AND owner_type='PROVISIONING' AND owner_id=%s",
            (device_id, owner_id),
        )
        connection.commit()

    def _renew_lock(self, connection: psycopg.Connection, device_id: str, owner_id: str) -> None:
        connection.execute(
            """UPDATE biometric_device_locks SET expires_at=%s
               WHERE device_id=%s::uuid AND owner_type='PROVISIONING' AND owner_id=%s""",
            (datetime.now(timezone.utc) + timedelta(minutes=30), device_id, owner_id),
        )
        connection.commit()

    def _adapter(self, device: dict[str, Any]) -> DeviceAdapter:
        try:
            key = int(device["communication_key"])
        except (TypeError, ValueError) as error:
            raise RuntimeError("Device communication key must be numeric for pyzk") from error
        return self.adapter_factory(DeviceConfig(device["id"], device["ip_address"], device["port"], key))

    @staticmethod
    def _templates_by_uid(templates: list[FingerTemplate]) -> dict[int, list[FingerTemplate]]:
        grouped: dict[int, list[FingerTemplate]] = defaultdict(list)
        for template in templates:
            grouped[template.uid].append(template)
        return grouped

    @staticmethod
    def _safe_error(error: Exception) -> str:
        # Do not serialize exception messages from protocol code: they may embed packet bytes.
        if isinstance(error, OSError):
            return f"{error.__class__.__name__}: device network operation failed"
        return f"{error.__class__.__name__}: device provisioning operation failed"

    @contextmanager
    def _connect(self) -> Iterator[psycopg.Connection]:
        with psycopg.connect(self.database_url, row_factory=dict_row, autocommit=False) as connection:
            yield connection


if __name__ == "__main__":
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")
    ProvisioningWorker(database_url).run_forever()
