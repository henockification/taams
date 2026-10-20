import { eq } from 'drizzle-orm';
import { db } from '../../db/db';
import { biometricDevices } from '../../db/schema';
import { writeAuditEvent } from '../audit';
import { parseZktecoAttLog } from './parse-zkteco-attlog';
import { IngestZktecoPushInput } from "../../types/zkteco";
import { parseAdmsEnrollmentUpload } from './enrollment/parse-records';
import { handleDeviceEnrollmentUpload } from '../../db/orm/core/manageBiometricEnrollment';

// Tables that carry users/templates (push 2.x OPERLOG, or table/tablename uploads).
const ENROLLMENT_TABLES = new Set(['OPERLOG', 'USERINFO', 'USER', 'BIODATA']);

export async function ingestZktecoPush(input: IngestZktecoPushInput) {
  const { serialNumber, table, rawBody, query } = input;

  const device = await db.query.biometricDevices.findFirst({
    where: eq(biometricDevices.serialNumber, serialNumber),
  });

  if (!device || !device.isActive) {
    throw new Error('Unknown ZKTeco device');
  }

  const tableName = table?.toUpperCase() ?? '';
  if (ENROLLMENT_TABLES.has(tableName)) {
    await handleDeviceEnrollmentUpload(device, parseAdmsEnrollmentUpload(rawBody, tableName));
    return;
  }

  // Punches are recorded by the TCP pull only; ATTLOG pushes are acknowledged, not stored.
  if (tableName !== 'ATTLOG') {
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
