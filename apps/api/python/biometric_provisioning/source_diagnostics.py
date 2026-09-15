"""Source enrollment diagnostics containing identifiers and counts only."""

from collections import defaultdict


def numeric_id(value: str) -> str | None:
    text = str(value).strip()
    return (text.lstrip("0") or "0") if text.isascii() and text.isdigit() else None


def source_diagnostics(employees, source_users, templates, reported_counts=None):
    users = defaultdict(list)
    numeric_users = defaultdict(list)
    for user in source_users:
        users[user.user_id].append(user)
        key = numeric_id(user.user_id)
        if key is not None:
            numeric_users[key].append(user)

    missing_users = []
    without_fingerprints = []
    possible_id_mismatches = []
    matched = 0
    for employee in employees:
        biometric_id = employee["biometric_id"]
        matches = users.get(biometric_id, [])
        if matches:
            matched += 1
            if not any(templates.get(user.uid) for user in matches):
                without_fingerprints.append(biometric_id)
        else:
            missing_users.append(biometric_id)
            key = numeric_id(biometric_id)
            candidates = numeric_users.get(key, []) if key is not None else []
            if candidates:
                possible_id_mismatches.append({
                    "employeeBiometricId": biometric_id,
                    "sourceUserIds": [user.user_id for user in candidates],
                })

    return {
        "employeeCount": len(employees),
        "sourceUserCount": len(source_users),
        "sourceFingerprintCount": sum(len(fingers) for fingers in templates.values()),
        "sourceUsersWithFingerprints": sum(bool(templates.get(user.uid)) for user in source_users),
        "exactMatchedEmployeeCount": matched,
        "missingSourceUserIds": missing_users,
        "sourceUsersWithoutFingerprints": without_fingerprints,
        "possibleIdMismatches": possible_id_mismatches,
        "duplicateSourceUserIds": [user_id for user_id, matches in users.items() if len(matches) > 1],
        "reportedUserCount": (reported_counts or {}).get("users"),
        "reportedFingerprintCount": (reported_counts or {}).get("fingerprints"),
        "reportedFaceCount": (reported_counts or {}).get("faces"),
        "userPacketSize": (reported_counts or {}).get("userPacketSize"),
    }
