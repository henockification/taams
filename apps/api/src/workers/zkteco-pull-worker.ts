import { and, eq, or } from "drizzle-orm";
import { db } from "../../db/db";
import { biometricDevices } from "../../db/schema";
import { pullZktecoAttendanceForDevice } from "../../lib/zkteco/tcp-pull-sync";
import type { DeviceIntegrationMode } from "../../types/core.types";

const INTERVAL_MS = Number(process.env.ZK_SYNC_INTERVAL_MS ?? 5 * 60 * 1000);

async function main() {
  console.log("ZKTeco TCP pull worker started");

  while (true) {
    try {
      await syncAllTcpPullDevices();
    } catch (error) {
      console.error("ZKTeco worker cycle failed", error);
    }

    await sleep(INTERVAL_MS);
  }
}

async function syncAllTcpPullDevices() {
  const devices = await db.query.biometricDevices.findMany({
    where: and(
      eq(biometricDevices.isActive, true),
      eq(biometricDevices.pullEnabled, true),
      eq(biometricDevices.autoSyncEnabled, true),
      or(
        eq(biometricDevices.integrationMode, "TCP_PULL"),
        eq(biometricDevices.integrationMode, "HYBRID"),
      ),
    ),
    orderBy: (table, { asc }) => [asc(table.deviceName)],
  });

  for (const device of devices) {
    if (!device.ipAddress) {
      console.warn(`Skipping ZKTeco device ${device.deviceCode} because it has no IP address`);
      continue;
    }

    const result = await pullZktecoAttendanceForDevice({
      id: device.id,
      deviceCode: device.deviceCode,
      ipAddress: device.ipAddress,
      port: device.port,
      isActive: device.isActive,
      pullEnabled: device.pullEnabled,
      integrationMode: device.integrationMode as DeviceIntegrationMode,
    });
    console.log("ZKTeco TCP pull sync completed", {
      deviceCode: device.deviceCode,
      syncStatus: result.syncStatus,
      totalRecords: result.totalRecords,
      successfulRecords: result.successfulRecords,
      failedRecords: result.failedRecords,
    });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error("Fatal ZKTeco worker error", error);
  process.exit(1);
});
