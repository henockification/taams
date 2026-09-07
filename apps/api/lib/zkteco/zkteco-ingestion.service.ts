import { eq } from 'drizzle-orm';
import { db } from '../../db/db';
import { biometricDevices } from '../../db/schema';
import { writeAuditEvent } from '../audit';
import { parseZktecoAttLog } from './parse-zkteco-attlog';
import { IngestZktecoPushInput } from "../../types/zkteco";

export async function ingestZktecoPush(input: IngestZktecoPushInput) {
  const { serialNumber, table, rawBody, query } = input;

  const device = await db.query.biometricDevices.findFirst({
    where: eq(biometricDevices.serialNumber, serialNumber),
  });

  if (!device || !device.isActive) {
    throw new Error('Unknown ZKTeco device');
  }

  if (table?.toUpperCase() !== 'ATTLOG') {
    return;
  }

  const punches = parseZktecoAttLog(rawBody);
  const now = new Date();

  await db.update(biometricDevices).set({
    lastPushAt: now,
    lastSeenAt: now,
    healthStatus: 'ONLINE',
    updatedAt: now,
  }).where(eq(biometricDevices.id, device.id));

  await writeAuditEvent(db, {
    action: 'ZKTECO_INGESTED',
    resourceType: 'biometric_device',
    resourceId: device.id,
    resourceLabel: device.deviceName,
    departmentId: device.departmentId,
    actorType: 'DEVICE',
    actorName: device.deviceName,
    metadata: {
      serialNumber,
      punchCount: punches.length,
      table,
      stamp: query?.Stamp ?? null,
    },
  });
}
