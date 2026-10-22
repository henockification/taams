import { desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceSyncBatches, biometricDevices } from '../../schema';

const RECENT_SYNC_BATCHES = 20;

/**
 * Biometric device health and recent attendance syncs for system administrators' dashboard.
 * Only display fields are selected; device secrets and communication keys never leave the API.
 */
export async function getDeviceHealthSummary() {
  const [devices, batches] = await Promise.all([
    db.query.biometricDevices.findMany({
      where: eq(biometricDevices.isActive, true),
      columns: { id: true, deviceName: true, locationName: true, healthStatus: true, lastSeenAt: true, lastErrorMessage: true },
    }),
    db.query.attendanceSyncBatches.findMany({
      orderBy: [desc(attendanceSyncBatches.createdAt)],
      limit: RECENT_SYNC_BATCHES,
      columns: { id: true, syncStatus: true, totalRecords: true, successfulRecords: true, failedRecords: true, errorMessage: true, createdAt: true },
      with: { device: { columns: { id: true, deviceName: true } } },
    }),
  ]);

  const syncCounts = {
    started: batches.filter((batch) => batch.syncStatus === 'STARTED').length,
    completed: batches.filter((batch) => batch.syncStatus === 'COMPLETED').length,
    failed: batches.filter((batch) => batch.syncStatus === 'FAILED').length,
    partial: batches.filter((batch) => batch.syncStatus === 'PARTIAL').length,
  };
  const offlineDevices = devices.filter((device) => device.healthStatus === 'OFFLINE');

  return {
    activeDevices: devices.length,
    offlineDevices: offlineDevices.map((device) => ({
      ...device,
      lastSeenAt: device.lastSeenAt ? new Date(device.lastSeenAt).toISOString() : null,
    })),
    sync: {
      counts: syncCounts,
      openIssues: syncCounts.started + syncCounts.failed + syncCounts.partial,
      recent: batches.map((batch) => ({
        ...batch,
        createdAt: batch.createdAt ? new Date(batch.createdAt).toISOString() : null,
        deviceName: batch.device?.deviceName ?? null,
        device: undefined,
      })),
    },
  };
}
