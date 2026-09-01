"""Replaceable device boundary. Fingerprint bytes never leave adapter/worker memory."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from zk import ZK
from zk.user import User


@dataclass(frozen=True)
class DeviceConfig:
    id: str
    ip_address: str
    port: int
    communication_key: int


@dataclass
class DeviceUser:
    uid: int
    user_id: str
    name: str
    raw: Any


@dataclass
class FingerTemplate:
    uid: int
    finger_id: int
    raw: Any

    def ephemeral_value(self) -> bytes:
        value = getattr(self.raw, "template", b"")
        return bytes(value or b"")


class DeviceAdapter(Protocol):
    def connect(self) -> None: ...
    def disconnect(self) -> None: ...
    def users(self) -> list[DeviceUser]: ...
    def templates(self) -> list[FingerTemplate]: ...
    def disable(self) -> None: ...
    def enable(self) -> None: ...
    def refresh(self) -> None: ...
    def upsert_user_with_templates(self, user: DeviceUser, templates: list[FingerTemplate]) -> None: ...
    def delete_user(self, user: DeviceUser) -> None: ...
    def metadata(self) -> dict[str, str | None]: ...


class PyzkDeviceAdapter:
    def __init__(self, config: DeviceConfig, timeout: int = 12):
        self.config = config
        self._zk = ZK(
            config.ip_address,
            port=config.port,
            timeout=timeout,
            password=config.communication_key,
            force_udp=False,
            ommit_ping=False,
        )
        self._connection: Any = None

    def connect(self) -> None:
        self._connection = self._zk.connect()

    def disconnect(self) -> None:
        if self._connection is not None:
            self._connection.disconnect()
            self._connection = None

    def users(self) -> list[DeviceUser]:
        self._require_connection()
        return [
            DeviceUser(int(user.uid), str(user.user_id).strip(), str(user.name or ""), user)
            for user in self._connection.get_users()
        ]

    def templates(self) -> list[FingerTemplate]:
        self._require_connection()
        templates = []
        for finger in self._connection.get_templates():
            finger_id = int(getattr(finger, "fid", -1))
            if 0 <= finger_id <= 9:
                templates.append(FingerTemplate(int(finger.uid), finger_id, finger))
        return templates

    def disable(self) -> None:
        self._require_connection()
        self._connection.disable_device()

    def enable(self) -> None:
        self._require_connection()
        self._connection.enable_device()

    def refresh(self) -> None:
        self._require_connection()
        self._connection.refresh_data()

    def upsert_user_with_templates(self, user: DeviceUser, templates: list[FingerTemplate]) -> None:
        self._require_connection()
        existing_slots = [
            template.finger_id for template in self.templates() if template.uid == user.uid
        ]
        sanitized_user = User(
            uid=user.uid,
            name=user.name[:24],
            privilege=0,
            password="",
            group_id="",
            user_id=user.user_id,
            card=0,
        )
        for finger_id in existing_slots:
            self._connection.delete_user_template(uid=user.uid, temp_id=finger_id, user_id=user.user_id)
        self._connection.set_user(
            uid=user.uid,
            name=user.name[:24],
            privilege=0,
            password="",
            group_id="",
            user_id=user.user_id,
            card=0,
        )
        # pyzk packs user metadata with template writes; supply a deliberately
        # sanitized user so passwords, cards, groups, and privileges are excluded.
        self._connection.save_user_template(sanitized_user, [template.raw for template in templates])

    def delete_user(self, user: DeviceUser) -> None:
        self._require_connection()
        self._connection.delete_user(uid=user.uid, user_id=user.user_id)

    def metadata(self) -> dict[str, str | None]:
        self._require_connection()
        return {
            "firmware": self._safe_call("get_firmware_version"),
            "platform": self._safe_call("get_platform"),
            "serial": self._safe_call("get_serialnumber"),
            "fingerprintAlgorithm": self._safe_call("get_fp_version"),
        }

    def _safe_call(self, method_name: str) -> str | None:
        method = getattr(self._connection, method_name, None)
        if not method:
            return None
        try:
            value = method()
            return str(value) if value is not None else None
        except Exception:
            return None

    def _require_connection(self) -> None:
        if self._connection is None:
            raise RuntimeError("Device is not connected")
