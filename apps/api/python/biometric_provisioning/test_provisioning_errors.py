import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

from provisioning_errors import DeviceOperationError, failure_reason, safe_provisioning_error


class ProvisioningErrorsTest(unittest.TestCase):
    def test_network_categories_are_actionable_without_raw_messages(self):
        for error, expected in [
            (TimeoutError("private packet timed out"), "connection timed out"),
            (ConnectionRefusedError("private packet"), "connection refused"),
            (RuntimeError("can't reach device (ping 10.0.109.11)"), "ping precheck failed"),
            (RuntimeError("TCP packet invalid: private packet"), "invalid protocol response"),
            (RuntimeError("unauthenticated; password=secret"), "check its communication key"),
        ]:
            result = failure_reason(error)
            self.assertIn(expected, result)
            self.assertNotIn("private packet", result)
            self.assertNotIn("secret", result)

    def test_unknown_protocol_messages_are_never_persisted(self):
        error = RuntimeError("fingerprint bytes or credentials")
        self.assertNotIn("fingerprint bytes", safe_provisioning_error(error))
        self.assertEqual(safe_provisioning_error(RuntimeError("Enrollment source is currently locked")),
                         "Enrollment source is currently locked")

    def load_adapter(self, zk_factory):
        # Exercise the real adapter with a mocked SDK; no devices or network are accessed.
        zk_module = types.ModuleType("zk")
        zk_module.ZK = zk_factory
        user_module = types.ModuleType("zk.user")
        user_module.User = Mock()
        name = "provisioning_test_device_adapter"
        spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name("device_adapter.py"))
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"zk": zk_module, "zk.user": user_module, name: module}):
            spec.loader.exec_module(module)
        return module

    def test_connection_does_not_require_ping(self):
        sdk = Mock()
        factory = Mock(return_value=sdk)
        module = self.load_adapter(factory)
        adapter = module.PyzkDeviceAdapter(module.DeviceConfig("source", "10.0.109.11", 4370, 0))
        self.assertTrue(factory.call_args.kwargs["ommit_ping"])
        adapter.connect()
        sdk.connect.assert_called_once()

    def test_inventory_counts_do_not_issue_additional_device_reads(self):
        sdk = Mock()
        sdk.connect.return_value.users = 635
        sdk.connect.return_value.fingers = 800
        sdk.connect.return_value.faces = 12
        sdk.connect.return_value.user_packet_size = 72
        module = self.load_adapter(Mock(return_value=sdk))
        adapter = module.PyzkDeviceAdapter(module.DeviceConfig("source", "10.0.109.11", 4370, 0))
        adapter.connect()
        self.assertEqual(adapter.inventory_counts(), {"users": 635, "fingerprints": 800, "faces": 12, "userPacketSize": 72})
        sdk.connect.return_value.get_users.assert_not_called()
        sdk.connect.return_value.get_templates.assert_not_called()

    def test_connection_and_read_errors_identify_stage_and_device(self):
        sdk = Mock()
        sdk.connect.side_effect = ConnectionRefusedError("private packet")
        module = self.load_adapter(Mock(return_value=sdk))
        adapter = module.PyzkDeviceAdapter(module.DeviceConfig("source", "10.0.109.11", 4370, 0))
        with self.assertRaises(DeviceOperationError) as caught:
            adapter.connect()
        self.assertEqual(safe_provisioning_error(caught.exception),
                         "Connect on device source (10.0.109.11:4370): connection refused")
        sdk.connect.side_effect = None
        adapter.connect()
        sdk.connect.return_value.get_templates.side_effect = TimeoutError("private fingerprint bytes")
        with self.assertRaises(DeviceOperationError) as caught:
            adapter.templates()
        self.assertEqual(safe_provisioning_error(caught.exception),
                         "Read fingerprints on device source (10.0.109.11:4370): connection timed out")


if __name__ == "__main__":
    unittest.main()
