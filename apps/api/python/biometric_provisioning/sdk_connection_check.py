"""SDK-only connection probe: no database, pyzk session, or enrollment writes."""
import argparse
import json
import time


def probe(ip, port, mode, key=0, protocol_mode="default"):
    from win32com.client.dynamic import DumbDispatch
    from face_sdk_adapter import ComFaceSdk
    native = DumbDispatch("zkemkeeper.ZKEM.1")
    sdk = ComFaceSdk(native)
    result = {"passwordMode": mode, "ip": ip, "port": port, "protocolMode": protocol_mode}
    try:
        # Test the SDK's normal default first. An unsuccessful protocol override
        # can itself change SDK error state and confuse connection diagnostics.
        if protocol_mode == "standalone":
            protocol = getattr(native, "SetCommProType", None)
            result["standaloneProtocolSelected"] = bool(protocol(1)) if protocol else None
            if not result["standaloneProtocolSelected"]:
                result["failedOperation"] = "SetCommProType"
                result["sdkError"] = sdk.GetLastError()
                return result
        method = getattr(native, "SetCommPassword" if mode == "legacy" else "SetCommPasswordEx", None)
        if method is None:
            result["error"] = "Password method unavailable in registered SDK"
            return result
        result["passwordConfigured"] = bool(method(key if mode == "legacy" else str(key)))
        if not result["passwordConfigured"]:
            result["sdkError"] = sdk.GetLastError()
            return result
        result["connected"] = bool(native.Connect_Net(ip, port))
        if not result["connected"]:
            result["sdkError"] = sdk.GetLastError()
        return result
    except Exception as error:
        result["errorType"] = type(error).__name__
        result["hresult"] = getattr(error, "hresult", None)
        return result
    finally:
        native.Disconnect()


def installation_info():
    import struct
    import winreg
    from pathlib import Path
    from win32com.client.dynamic import DumbDispatch
    from win32com.client import VARIANT
    import pythoncom
    info = {"pythonBits": struct.calcsize("P") * 8}
    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, r"zkemkeeper.ZKEM.1\CLSID") as entry:
            clsid = winreg.QueryValueEx(entry, "")[0]
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, rf"CLSID\{clsid}\InprocServer32") as entry:
            dll = winreg.QueryValueEx(entry, "")[0]
        info["registeredDll"] = dll
        # Companion file names are useful for detecting partial SDK copies.
        info["dllsInSdkFolder"] = sorted(file.name for file in Path(dll.strip('"')).parent.glob("*.dll"))
        native = DumbDispatch("zkemkeeper.ZKEM.1")
        version = VARIANT(pythoncom.VT_BYREF | pythoncom.VT_BSTR, "")
        if native.GetSDKVersion(version):
            info["sdkVersion"] = version.value
    except Exception as error:
        info["installationInfoErrorType"] = type(error).__name__
    return info


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ip", required=True)
    parser.add_argument("--port", type=int, default=4370)
    parser.add_argument("--protocol", choices=("default", "standalone"), default="default")
    # Current devices use blank/zero communication keys. Nonzero keys must be
    # supplied in the process environment, never as shell command arguments.
    args = parser.parse_args()
    import os
    key = int(os.getenv("PROVISIONING_TEST_COMM_KEY", "0"))
    print(json.dumps(installation_info()), flush=True)
    for mode in ("legacy", "extended"):
        print(json.dumps(probe(args.ip, args.port, mode, key, args.protocol)), flush=True)
        if mode == "legacy":
            time.sleep(5)
