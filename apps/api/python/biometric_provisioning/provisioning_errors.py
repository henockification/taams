"""Actionable provisioning errors without protocol packets or template bytes."""

import errno
from functools import wraps


class DeviceOperationError(RuntimeError):
    pass


def failure_reason(error: Exception) -> str:
    text = str(error).lower()
    code = getattr(error, "errno", None)
    if isinstance(error, TimeoutError) or "timed out" in text or "timeout" in text:
        return "connection timed out"
    if isinstance(error, ConnectionRefusedError) or code == errno.ECONNREFUSED or "connection refused" in text:
        return "connection refused"
    if "ping" in text:
        return "ping precheck failed; ICMP or the ping utility is unavailable"
    if code in (errno.ENETUNREACH, errno.EHOSTUNREACH) or "no route to host" in text or "network is unreachable" in text or "can't reach device" in text:
        return "device is unreachable from the provisioning worker"
    if "unauth" in text or "authentication" in text or "password" in text:
        return "device authentication failed; check its communication key"
    if "packet invalid" in text:
        return "device returned an invalid protocol response"
    return f"device operation failed ({type(error).__name__})"


def device_operation(operation: str):
    def decorate(method):
        @wraps(method)
        def wrapped(self, *args, **kwargs):
            try:
                return method(self, *args, **kwargs)
            except DeviceOperationError:
                raise
            except Exception as error:
                config = self.config
                raise DeviceOperationError(
                    f"{operation} on device {config.id} ({config.ip_address}:{config.port}): {failure_reason(error)}"
                ) from error
        return wrapped
    return decorate


def safe_provisioning_error(error: Exception) -> str:
    if isinstance(error, DeviceOperationError):
        return str(error)
    # These messages originate in our worker, rather than device protocol code.
    known_messages = {
        "Enrollment source is currently locked",
        "Production writes are disabled until the compatibility gate is approved",
        "One or more provisioning devices are inactive or unavailable",
        "Every provisioning device must have an IP address",
        "Device communication key must be numeric for pyzk",
        "Read-back verification found users that should have been removed",
    }
    if type(error) is RuntimeError and str(error) in known_messages:
        return str(error)
    if isinstance(error, OSError):
        return failure_reason(error)
    return f"{type(error).__name__}: device provisioning operation failed"
