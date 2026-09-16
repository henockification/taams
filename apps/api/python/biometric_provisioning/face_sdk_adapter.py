"""G3/iFace face transfer using ZKTeco's registered Windows COM SDK.

The SDK handles the device's face packet format; pyzk remains responsible for
UID-aware user/fingerprint operations. TCP sessions never overlap. No biometric
payload is written to files, included in exceptions, or sent to the API.
"""

from contextlib import contextmanager
import sys
import time
import os

from device_adapter import DeviceUser, FaceTemplate, PyzkDeviceAdapter
from provisioning_errors import DeviceOperationError, device_operation


class SdkFaceDeviceAdapter(PyzkDeviceAdapter):
    supports_faces = True

    def __init__(self, config, timeout=12, sdk_factory=None):
        super().__init__(config, timeout)
        self._sdk_factory = sdk_factory or self._windows_sdk

    @staticmethod
    def _windows_sdk():
        if sys.platform != "win32":
            raise DeviceOperationError("Face provisioning requires a Windows worker with the registered ZKTeco Standalone SDK; the Linux/Docker worker supports fingerprints only")
        try:
            from win32com.client.dynamic import DumbDispatch
            # Ordinary dynamic.Dispatch still reads the SDK's type information
            # and can coerce our explicit BYREF VARIANTs (raising TypeError).
            # Use an untyped dispatch so those output arguments reach COM intact.
            return ComFaceSdk(DumbDispatch("zkemkeeper.ZKEM.1"))
        except Exception:
            raise DeviceOperationError("Cannot load ZKTeco Standalone SDK: install/register zkemkeeper.dll and use matching Python/SDK architecture with pywin32 installed") from None

    @contextmanager
    def _face_session(self):
        self._require_connection()
        sdk = self._sdk_factory()
        super().disconnect()
        connected = False
        try:
            self._check(sdk.SetCommPassword(self.config.communication_key), sdk, "Set communication key")
            self._connect_face_sdk(sdk)
            connected = True
            yield sdk
        finally:
            try:
                if connected:
                    sdk.Disconnect()
            finally:
                super().connect()

    def _connect_face_sdk(self, sdk):
        # A terminal can retain the pyzk session briefly after CMD_EXIT. Allow
        # that session to close, then retry only the SDK's device-busy response.
        time.sleep(0.5)
        delays = (1, 2, 4, 8)
        for attempt in range(len(delays) + 1):
            if sdk.Connect_Net(self.config.ip_address, self.config.port):
                return
            code = self._error_code(sdk)
            if code != -201:
                raise DeviceOperationError(f"Connect face SDK on device {self.config.id}: ZKTeco SDK error {code}")
            sdk.Disconnect()
            if attempt == len(delays):
                raise DeviceOperationError(
                    f"Connect face SDK on device {self.config.id}: ZKTeco SDK error -201 (device remains busy after 5 attempts). "
                    "Pause other device sync/enrollment software, exit the terminal menu, and create a new preview"
                )
            heartbeat = getattr(self, "heartbeat", None)
            if heartbeat:
                heartbeat()
            time.sleep(delays[attempt])

    @staticmethod
    def _error_code(sdk) -> int:
        result = sdk.GetLastError()
        return int(result[-1] if isinstance(result, tuple) else result)

    def _check(self, success, sdk, operation):
        if not success:
            code = self._error_code(sdk)
            reason = " (incompatible face algorithm)" if code in (-102, -103) else ""
            raise DeviceOperationError(f"{operation} on device {self.config.id}: ZKTeco SDK error {code}{reason}")

    @device_operation("Read faces")
    def face_templates(self, users: list[DeviceUser]) -> list[FaceTemplate]:
        faces = []
        with self._face_session() as sdk:
            for user in users:
                heartbeat = getattr(self, "heartbeat", None)
                if heartbeat:
                    heartbeat()
                # Index 50 means all face samples for this exact string ID.
                success, value, length = sdk.GetUserFaceStr(1, user.user_id, 50)
                if not success:
                    # 0 = no data, -100 = unsupported or no data. The worker
                    # also checks reported inventory to detect unsupported reads.
                    if self._error_code(sdk) not in (0, -100):
                        self._check(False, sdk, "Read faces")
                    continue
                if value and length > 0:
                    faces.append(FaceTemplate(user.uid, value, int(length)))
        return faces

    @device_operation("Write face enrollment")
    def upsert_face(self, user: DeviceUser, face: FaceTemplate | None) -> None:
        with self._face_session() as sdk:
            if face is None:
                success, _, length = sdk.GetUserFaceStr(1, user.user_id, 50)
                if success and length > 0:
                    self._check(sdk.DelUserFace(1, user.user_id, 50), sdk, "Remove obsolete faces")
                elif not success and self._error_code(sdk) not in (0, -100):
                    self._check(False, sdk, "Read existing faces")
            else:
                # Preserve the SDK's returned length; string length is not a
                # substitute for the native template length.
                self._check(sdk.SetUserFaceStr(1, user.user_id, 50, face.value, face.length), sdk, "Write faces")

    def delete_user(self, user: DeviceUser) -> None:
        self.upsert_face(user, None)
        super().delete_user(user)


class ComFaceSdk:
    """Explicit by-reference arguments avoid generated COM binding ambiguity."""

    def __init__(self, sdk):
        self.sdk = sdk

    def __getattr__(self, name):
        return getattr(self.sdk, name)

    def SetCommPassword(self, key):
        # New SDKs expose the extended password API and remain compatible with
        # older terminals. Fall back only when that method is unavailable.
        mode = os.getenv("PROVISIONING_SDK_PASSWORD_MODE", "auto")
        if mode == "legacy":
            return self.sdk.SetCommPassword(key)
        if mode not in ("auto", "extended"):
            raise DeviceOperationError("PROVISIONING_SDK_PASSWORD_MODE must be auto, legacy, or extended")
        extended = getattr(self.sdk, "SetCommPasswordEx", None)
        if mode == "extended" and extended is None:
            raise DeviceOperationError("Registered SDK does not expose SetCommPasswordEx")
        return extended(str(key)) if extended is not None else self.sdk.SetCommPassword(key)

    def GetUserFaceStr(self, machine, user_id, index):
        import pythoncom
        from win32com.client import VARIANT
        value = VARIANT(pythoncom.VT_BYREF | pythoncom.VT_BSTR, "")
        length = VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        success = self.sdk.GetUserFaceStr(machine, user_id, index, value, length)
        return success, value.value, length.value

    def GetLastError(self):
        import pythoncom
        from win32com.client import VARIANT
        code = VARIANT(pythoncom.VT_BYREF | pythoncom.VT_I4, 0)
        self.sdk.GetLastError(code)
        return code.value
