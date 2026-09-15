"""Exercise face transfer and failure boundaries without hardware or a database."""
import importlib
import json
import os
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from provisioning_errors import DeviceOperationError
from source_diagnostics import source_diagnostics


def load_modules():
    zk = ModuleType("zk")
    zk.ZK = Mock()
    user = ModuleType("zk.user")
    user.User = Mock()
    psycopg = ModuleType("psycopg")
    rows = ModuleType("psycopg.rows")
    rows.dict_row = Mock()
    with patch.dict(sys.modules, {"zk": zk, "zk.user": user, "psycopg": psycopg, "psycopg.rows": rows}):
        return [importlib.import_module(name) for name in ("device_adapter", "face_sdk_adapter", "worker")]


device, sdk_module, worker_module = load_modules()


class FaceSdkTest(unittest.TestCase):
    def adapter(self):
        sdk = Mock()
        sdk.SetCommPassword.return_value = True
        sdk.Connect_Net.return_value = True
        sdk.GetLastError.return_value = 0
        adapter = sdk_module.SdkFaceDeviceAdapter(device.DeviceConfig("target", "10.0.0.2", 4370, 0), sdk_factory=lambda: sdk)
        adapter._zk = Mock()
        adapter.connect()
        def sdk_connect(*args):
            self.assertIsNone(adapter._connection, "SDK and pyzk TCP sessions must not overlap")
            return True
        sdk.Connect_Net.side_effect = sdk_connect
        return adapter, sdk

    def test_exact_string_id_and_sdk_length_survive_transfer(self):
        adapter, sdk = self.adapter()
        user = device.DeviceUser(12, "00012", "Employee", None)
        sdk.GetUserFaceStr.return_value = (True, "PRIVATE-FACE", 1234)
        faces = adapter.face_templates([user])
        sdk.GetUserFaceStr.assert_called_once_with(1, "00012", 50)
        self.assertEqual(faces[0].uid, 12)
        self.assertNotIn("PRIVATE-FACE", repr(faces[0]))
        adapter.upsert_face(user, faces[0])
        sdk.SetUserFaceStr.assert_called_once_with(1, "00012", 50, "PRIVATE-FACE", 1234)
        self.assertEqual(sdk.Disconnect.call_count, 2)
        self.assertEqual(adapter._zk.connect.call_count, 3)

    def test_timeout_is_not_missing_enrollment_and_session_is_restored(self):
        adapter, sdk = self.adapter()
        sdk.GetUserFaceStr.return_value = (False, "", 0)
        sdk.GetLastError.return_value = -8
        with self.assertRaisesRegex(DeviceOperationError, "SDK error -8"):
            adapter.face_templates([device.DeviceUser(1, "001", "", None)])
        sdk.Disconnect.assert_called_once()
        self.assertIsNotNone(adapter._connection)

    def test_read_does_not_write_or_delete_and_no_data_is_distinct(self):
        adapter, sdk = self.adapter()
        sdk.GetUserFaceStr.return_value = (False, "", 0)
        self.assertEqual(adapter.face_templates([device.DeviceUser(1, "001", "", None)]), [])
        sdk.SetUserFaceStr.assert_not_called()
        sdk.DelUserFace.assert_not_called()

    def test_sdk_rejection_is_sanitized_and_obsolete_faces_are_removed(self):
        adapter, sdk = self.adapter()
        user = device.DeviceUser(1, "001", "", None)
        sdk.SetUserFaceStr.return_value = False
        sdk.GetLastError.return_value = -103
        with self.assertRaisesRegex(DeviceOperationError, "incompatible face algorithm") as caught:
            adapter.upsert_face(user, device.FaceTemplate(1, "PRIVATE-FACE", 10))
        self.assertNotIn("PRIVATE-FACE", str(caught.exception))
        sdk.GetUserFaceStr.return_value = (True, "OLD", 20)
        adapter.upsert_face(user, None)
        sdk.DelUserFace.assert_called_once_with(1, "001", 50)


class WorkflowTest(unittest.TestCase):
    def setUp(self):
        self.worker = worker_module.ProvisioningWorker("unused")
        self.user = device.DeviceUser(12, "00012", "Employee", None)
        self.face = device.FaceTemplate(12, "PRIVATE-FACE", 100)
        self.records = {"00012": (self.user, [], self.face)}
        self.job = {"id": "job", "mode": "FULL_SYNC", "is_preview": True, "source_device_id": "source", "source_face_algorithm": "7"}

    def test_face_only_employee_is_eligible_and_idempotent(self):
        diff = self.worker._differences(self.job, self.records, [], {}, {})
        self.assertEqual(diff["missingUsers"], ["00012"])
        self.assertEqual(diff["missingSourceTemplates"], [])
        self.assertNotIn("PRIVATE-FACE", json.dumps(diff))
        diff = self.worker._differences(self.job, self.records, [self.user], {}, {12: self.face})
        self.assertEqual(diff["updatedUsers"], [])
        self.worker._verify(self.job, self.records, [self.user], {}, {12: self.face})

    def test_reenrollment_and_readback_compare_payload_not_just_presence(self):
        stale = device.FaceTemplate(12, "OLD-FACE", 100)
        diff = self.worker._differences(self.job, self.records, [self.user], {}, {12: stale})
        self.assertEqual(diff["updatedUsers"], ["00012"])
        with self.assertRaisesRegex(DeviceOperationError, "Read-back face verification failed"):
            self.worker._verify(self.job, self.records, [self.user], {}, {12: stale})

    def test_missing_user_and_missing_all_biometrics_still_block(self):
        records = {"001": (device.DeviceUser(-1, "001", "", None), [], None), "00012": (self.user, [], None)}
        diff = self.worker._differences(self.job, records, [], {}, {})
        self.assertEqual(diff["missingSourceTemplates"], ["001", "00012"])

    def process_device(self, adapter):
        self.worker.adapter_factory = lambda config: adapter
        for name in ("_mark_result_running", "_update_device_metadata", "_renew_lock", "_release_lock", "_complete_result", "_fail_result"):
            setattr(self.worker, name, Mock())
        self.worker._acquire_lock = Mock(return_value=True)
        self.worker._process_device(Mock(), self.job, {"id": "target", "ip_address": "10.0.0.2", "port": 4370, "communication_key": "0"}, self.records, "owner")

    def test_compatibility_failure_and_uid_conflict_precede_any_writes(self):
        adapter = Mock(supports_faces=True)
        adapter.metadata.return_value = {"faceAlgorithm": "8"}
        self.process_device(adapter)
        adapter.disable.assert_not_called()
        adapter.upsert_face.assert_not_called()
        self.assertIn("Face compatibility", self.worker._fail_result.call_args.args[-1])
        adapter.metadata.return_value = {"faceAlgorithm": "7"}
        adapter.users.return_value = [device.DeviceUser(12, "someone-else", "", None)]
        adapter.templates.return_value = []
        adapter.face_templates.return_value = []
        self.process_device(adapter)
        adapter.disable.assert_not_called()
        self.assertTrue(self.worker._complete_result.call_args.kwargs["failed"])

    def test_apply_and_readback_face_only_employee(self):
        adapter = Mock(supports_faces=True)
        adapter.metadata.return_value = {"faceAlgorithm": "7"}
        adapter.users.side_effect = [[], [self.user]]
        adapter.templates.return_value = []
        adapter.face_templates.side_effect = [[], [self.face]]
        self.job["is_preview"] = False
        with patch.dict(os.environ, {"PROVISIONING_WRITES_ENABLED": "true"}):
            self.process_device(adapter)
        adapter.upsert_user_with_templates.assert_called_once_with(self.user, [])
        adapter.upsert_face.assert_called_once_with(self.user, self.face)
        adapter.enable.assert_called_once()
        self.worker._fail_result.assert_not_called()

    def test_diagnostics_accept_faces_without_serializing_them(self):
        result = source_diagnostics([{"biometric_id": "00012"}, {"biometric_id": "005"}], [self.user], {}, {"faces": 1}, {12: self.face}, True)
        self.assertEqual(result["sourceUsersWithoutFingerprints"], ["00012"])
        self.assertEqual(result["sourceUsersWithoutEnrollments"], [])
        self.assertEqual(result["missingSourceUserIds"], ["005"])
        self.assertEqual(result["sourceFaceCount"], 1)
        self.assertNotIn("PRIVATE-FACE", json.dumps(result))

    def test_fingerprint_only_backend_reports_face_reader_problem(self):
        source = {"id": "source", "ip_address": "10.0.0.1", "port": 4370, "communication_key": "0"}
        self.worker._load_devices = Mock(return_value={"source": source})
        self.worker._load_employees = Mock(return_value=[{"biometric_id": "00012", "name": "Employee"}])
        self.worker._acquire_lock = Mock(return_value=True)
        self.worker._update_device_metadata = Mock()
        self.worker._release_lock = Mock()
        self.worker._process_device = Mock()
        adapter = Mock(supports_faces=False)
        adapter.users.return_value = [self.user]
        adapter.templates.return_value = []
        adapter.face_templates.return_value = []
        adapter.inventory_counts.return_value = {"users": 1, "faces": 1}
        self.worker.adapter_factory = lambda config: adapter
        with self.assertRaisesRegex(DeviceOperationError, "fingerprint-only backend"):
            self.worker._process_job(Mock(), self.job)
        self.assertEqual(self.job["source_diagnostics"]["exactMatchedEmployeeCount"], 1)
        self.assertFalse(self.job["source_diagnostics"]["faceProvisioningSupported"])
        self.worker._process_device.assert_not_called()
        self.worker._release_lock.assert_called_once()

    def test_mixed_enrollment_copies_both_and_departure_removes_user(self):
        finger = device.FingerTemplate(12, 2, SimpleNamespace(template=b"PRIVATE-FINGER"))
        self.records["00012"] = (self.user, [finger], self.face)
        adapter = Mock(supports_faces=True)
        differences = self.worker._differences(self.job, self.records, [], {}, {})
        self.worker._apply_changes(adapter, self.job, self.records, [], differences)
        adapter.upsert_user_with_templates.assert_called_once_with(self.user, [finger])
        adapter.upsert_face.assert_called_once_with(self.user, self.face)
        self.worker._verify(self.job, self.records, [self.user], {12: [finger]}, {12: self.face})
        self.job.update(mode="EMPLOYEE_REMOVE", employee_biometric_ids=["00012"])
        differences = self.worker._differences(self.job, {}, [self.user], {}, {})
        self.worker._apply_changes(adapter, self.job, {}, [self.user], differences)
        adapter.delete_user.assert_called_once_with(self.user)
        self.worker._verify(self.job, {}, [], {})


if __name__ == "__main__":
    unittest.main()
