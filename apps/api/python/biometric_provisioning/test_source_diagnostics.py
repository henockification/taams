import json
from types import SimpleNamespace
import unittest

from source_diagnostics import source_diagnostics


class SourceDiagnosticsTest(unittest.TestCase):
    def test_systematic_numeric_format_mismatch_is_not_reported_as_missing_fingerprints(self):
        employees = [{"biometric_id": str(index).zfill(8)} for index in range(1, 636)]
        users = [SimpleNamespace(uid=index, user_id=str(index).zfill(8) if index <= 3 else str(index))
                 for index in range(1, 636)]
        templates = {index: [b"private fingerprint bytes"] for index in range(1, 636)}
        result = source_diagnostics(employees, users, templates, {"users": 635, "fingerprints": 635, "userPacketSize": 28})
        self.assertEqual(result["exactMatchedEmployeeCount"], 3)
        self.assertEqual(len(result["missingSourceUserIds"]), 632)
        self.assertEqual(len(result["possibleIdMismatches"]), 632)
        self.assertEqual(result["sourceUsersWithoutFingerprints"], [])
        self.assertEqual(result["sourceUsersWithFingerprints"], 635)
        self.assertEqual(result["reportedUserCount"], 635)
        self.assertNotIn("private fingerprint", json.dumps(result))

    def test_missing_users_and_unread_fingerprints_are_separate(self):
        result = source_diagnostics(
            [{"biometric_id": "001"}, {"biometric_id": "002"}],
            [SimpleNamespace(uid=10, user_id="001")], {}, {"users": 1, "fingerprints": 5},
        )
        self.assertEqual(result["missingSourceUserIds"], ["002"])
        self.assertEqual(result["sourceUsersWithoutFingerprints"], ["001"])
        self.assertEqual(result["sourceFingerprintCount"], 0)
        self.assertEqual(result["reportedFingerprintCount"], 5)

    def test_ambiguous_numeric_ids_are_listed_without_automatic_matching(self):
        result = source_diagnostics([{"biometric_id": "001"}], [
            SimpleNamespace(uid=1, user_id="1"), SimpleNamespace(uid=2, user_id="01"),
        ], {1: [object()], 2: [object()]})
        self.assertEqual(result["exactMatchedEmployeeCount"], 0)
        self.assertEqual(result["possibleIdMismatches"], [{"employeeBiometricId": "001", "sourceUserIds": ["1", "01"]}])

    def test_empty_source_and_alphanumeric_ids_do_not_create_numeric_matches(self):
        result = source_diagnostics([{"biometric_id": "CONTRACT-001"}], [], {})
        self.assertEqual(result["sourceUserCount"], 0)
        self.assertEqual(result["missingSourceUserIds"], ["CONTRACT-001"])
        self.assertEqual(result["possibleIdMismatches"], [])


if __name__ == "__main__":
    unittest.main()
