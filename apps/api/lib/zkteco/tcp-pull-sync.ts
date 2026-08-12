import ZKLib from "node-zklib";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/db";
import { attendancePunches, employees } from "../../db/schema";
import {
  completeBiometricDeviceSyncBatch,
  createAttendancePunch,
  createBiometricDeviceSyncBatch,
} from "../../db/orm/core/manageBiometricDevices";
import type { DeviceIntegrationMode, PunchType, SyncStatus } from "../../types/core.types";

type PullBiometricDevice = {
  id: string;
  deviceCode: string;
  ipAddress: string | null;
  port: number | null;
  isActive: boolean;
  pullEnabled: boolean;
  integrationMode: DeviceIntegrationMode;
};

type ZktecoAttendanceLog = {
  deviceUserId?: string | number;
  userId?: string | number;
  recordTime?: string | Date;
  attTime?: string | Date;
  type?: string | number;
  recordType?: string | number;
  verifyType?: string | number;
  verificationType?: string | number;
  uid?: string | number;
  id?: string | number;
  [key: string]: unknown;
};

export async function pullZktecoAttendanceForDevice(device: PullBiometricDevice) {
  if (!device.ipAddress) {
    throw new Error("Device IP address is required for TCP pull sync");
  }

  if (!device.isActive) {
    throw new Error("Cannot sync an inactive biometric device");
  }

  if (!device.pullEnabled && device.integrationMode !== "TCP_PULL" && device.integrationMode !== "HYBRID") {
    throw new Error("TCP pull is not enabled for this biometric device");
  }

  const batch = await createBiometricDeviceSyncBatch(device.id, { syncStatus: "STARTED" });
  if (!batch) throw new Error("Failed to create attendance sync batch");

  const zk = new ZKLib(device.ipAddress, device.port || 4370, 10000, 4000);
  let totalRecords = 0;
  let successfulRecords = 0;
  let failedRecords = 0;
  const errors: string[] = [];

  try {
    await zk.createSocket();

    const attendances = await zk.getAttendances();
    const logs = ((attendances?.data ?? []) as ZktecoAttendanceLog[]);
    totalRecords = logs.length;

    for (const log of logs) {
      try {
        const parsed = parseAttendanceLog(device, log);

        if (!parsed) {
          failedRecords += 1;
          errors.push("Skipped a punch with missing biometric id or punch time");
          continue;
        }

        const alreadyImported = await db.query.attendancePunches.findFirst({
          where: and(
            eq(attendancePunches.deviceId, device.id),
            eq(attendancePunches.externalUid, parsed.externalUid),
          ),
          columns: { id: true },
        });

        if (alreadyImported) {
          continue;
        }

        const employee = await db.query.employees.findFirst({
          where: eq(employees.biometricId, parsed.biometricId),
          columns: { id: true },
        });

        await createAttendancePunch({
          employeeId: employee?.id ?? null,
          biometricId: parsed.biometricId,
          deviceId: device.id,
          syncBatchId: batch.id,
          externalUid: parsed.externalUid,
          punchTime: parsed.punchTime.toISOString(),
          punchType: parsed.punchType,
          verificationType: parsed.verificationType,
          devicePunchId: parsed.devicePunchId,
          source: "DEVICE",
          isManual: false,
          rawPayload: log,
        });

        successfulRecords += 1;
      } catch (error) {
        failedRecords += 1;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const syncStatus = getSyncStatus(totalRecords, failedRecords);

    return completeBiometricDeviceSyncBatch(batch.id, {
      syncStatus,
      totalRecords,
      successfulRecords,
      failedRecords,
      errorMessage: errors.length ? errors.slice(0, 5).join("; ") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return completeBiometricDeviceSyncBatch(batch.id, {
      syncStatus: "FAILED",
      totalRecords,
      successfulRecords,
      failedRecords: totalRecords > 0 ? Math.max(failedRecords, totalRecords - successfulRecords) : 0,
      errorMessage: message,
    });
  } finally {
    try {
      await zk.disconnect();
    } catch {
      // The sync result above is the useful operational signal.
    }
  }
}

function parseAttendanceLog(device: PullBiometricDevice, log: ZktecoAttendanceLog) {
  const biometricId = String(log.deviceUserId ?? log.userId ?? "").trim();
  const recordTime = log.recordTime ?? log.attTime;

  if (!biometricId || !recordTime) {
    return null;
  }

  const punchTime = new Date(recordTime);
  if (Number.isNaN(punchTime.getTime())) {
    throw new Error(`Invalid ZKTeco punch time: ${String(recordTime)}`);
  }

  const externalUid = [
    device.deviceCode,
    biometricId,
    punchTime.toISOString(),
  ].join(":");

  return {
    biometricId,
    punchTime,
    externalUid,
    punchType: mapZktecoPunchType(log.type ?? log.recordType),
    verificationType: stringifyOptional(log.verifyType ?? log.verificationType),
    devicePunchId: stringifyOptional(log.uid ?? log.id),
  };
}

function mapZktecoPunchType(value: unknown): PunchType {
  switch (String(value ?? "")) {
    case "0":
      return "IN";
    case "1":
      return "OUT";
    case "2":
      return "BREAK_OUT";
    case "3":
      return "BREAK_IN";
    default:
      return "UNKNOWN";
  }
}

function getSyncStatus(totalRecords: number, failedRecords: number): SyncStatus {
  if (failedRecords === 0) return "COMPLETED";
  if (failedRecords >= totalRecords) return "FAILED";
  return "PARTIAL";
}

function stringifyOptional(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}
