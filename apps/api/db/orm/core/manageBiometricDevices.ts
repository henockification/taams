import { and, asc, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import { attendancePunches, attendanceSyncBatches, biometricDevices, departments, employees, user } from '../../schema';
import type {
  CreateAttendancePunchInput,
  CreateBiometricDeviceInput,
  CreateBiometricDeviceSyncInput,
  UpdateBiometricDeviceInput,
} from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';

type DbClient = typeof db | any;

export async function createBiometricDevice(input: CreateBiometricDeviceInput) {
  if (input.departmentId) {
    await assertDepartmentExists(input.departmentId);
  }

  const [device] = await db
    .insert(biometricDevices)
    .values(normalizeBiometricDeviceInput(input) as any)
    .returning();

  return getBiometricDeviceById(device.id);
}

export async function getBiometricDevices() {
  return db.query.biometricDevices.findMany({
    with: {
      department: true,
    },
    orderBy: (table, { asc }) => [asc(table.deviceName)],
  });
}

export async function getBiometricDeviceById(id: string, tx: DbClient = db) {
  return tx.query.biometricDevices.findFirst({
    where: eq(biometricDevices.id, id),
    with: {
      department: true,
    },
  });
}

export async function updateBiometricDevice(id: string, input: UpdateBiometricDeviceInput) {
  await assertBiometricDeviceExists(id);

  if (input.departmentId) {
    await assertDepartmentExists(input.departmentId);
  }

  const updateData = normalizeBiometricDeviceInput(input);

  if (Object.keys(updateData).length === 0) {
    return getBiometricDeviceById(id);
  }

  await db
    .update(biometricDevices)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(biometricDevices.id, id));

  return getBiometricDeviceById(id);
}

export async function createBiometricDeviceSyncBatch(deviceId: string, input: CreateBiometricDeviceSyncInput = {}) {
  const device = await assertBiometricDeviceExists(deviceId);

  const [batch] = await db
    .insert(attendanceSyncBatches)
    .values({
      deviceId,
      syncStatus: input.syncStatus ?? 'STARTED',
      totalRecords: input.totalRecords ?? 0,
      successfulRecords: input.successfulRecords ?? 0,
      failedRecords: input.failedRecords ?? 0,
      errorMessage: input.errorMessage ?? null,
      syncCompletedAt: input.syncCompletedAt ? new Date(input.syncCompletedAt) : null,
    } as any)
    .returning();

  if (input.syncCompletedAt || input.syncStatus === 'COMPLETED') {
    await db
      .update(biometricDevices)
      .set({
        lastSyncAt: input.syncCompletedAt ? new Date(input.syncCompletedAt) : new Date(),
        lastSuccessfulSyncAt: input.syncCompletedAt ? new Date(input.syncCompletedAt) : new Date(),
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(biometricDevices.id, device.id));
  } else if (input.syncStatus === 'FAILED') {
    await db
      .update(biometricDevices)
      .set({
        lastFailedSyncAt: new Date(),
        lastErrorMessage: input.errorMessage ?? null,
        updatedAt: new Date(),
      })
      .where(eq(biometricDevices.id, device.id));
  }

  return getAttendanceSyncBatchById(batch.id);
}

export async function completeBiometricDeviceSyncBatch(
  batchId: string,
  input: Required<Pick<CreateBiometricDeviceSyncInput, 'syncStatus' | 'totalRecords' | 'successfulRecords' | 'failedRecords'>> &
    Pick<CreateBiometricDeviceSyncInput, 'errorMessage'>,
) {
  const completedAt = new Date();
  const batch = await getAttendanceSyncBatchById(batchId);

  if (!batch) throw new Error('Attendance sync batch not found');

  await db
    .update(attendanceSyncBatches)
    .set({
      syncStatus: input.syncStatus,
      totalRecords: input.totalRecords,
      successfulRecords: input.successfulRecords,
      failedRecords: input.failedRecords,
      errorMessage: input.errorMessage ?? null,
      syncCompletedAt: completedAt,
    } as any)
    .where(eq(attendanceSyncBatches.id, batchId));

  if (batch.deviceId) {
    await db
      .update(biometricDevices)
      .set({
        lastSyncAt: completedAt,
        lastPullAt: completedAt,
        lastSeenAt: completedAt,
        lastSuccessfulSyncAt: input.syncStatus === 'FAILED' ? batch.device?.lastSuccessfulSyncAt ?? null : completedAt,
        lastFailedSyncAt: input.syncStatus === 'FAILED' ? completedAt : batch.device?.lastFailedSyncAt ?? null,
        healthStatus: input.syncStatus === 'FAILED' ? 'ERROR' : 'ONLINE',
        lastErrorMessage: input.syncStatus === 'FAILED' ? input.errorMessage ?? null : null,
        updatedAt: completedAt,
      } as any)
      .where(eq(biometricDevices.id, batch.deviceId));
  }

  return getAttendanceSyncBatchById(batchId);
}

export async function getAttendanceSyncBatchesByDeviceId(deviceId: string) {
  await assertBiometricDeviceExists(deviceId);

  return db.query.attendanceSyncBatches.findMany({
    where: eq(attendanceSyncBatches.deviceId, deviceId),
    with: {
      device: true,
    },
    orderBy: (table, { desc }) => [desc(table.syncStartedAt)],
  });
}

export async function markBiometricDeviceConnectionTestResult(
  id: string,
  input: { success: boolean; message: string; testedAt: Date },
) {
  await assertBiometricDeviceExists(id);

  await db
    .update(biometricDevices)
    .set({
      healthStatus: input.success ? 'ONLINE' : 'ERROR',
      ...(input.success ? { lastSeenAt: input.testedAt } : { lastFailedSyncAt: input.testedAt }),
      lastErrorMessage: input.success ? null : input.message,
      updatedAt: new Date(),
    })
    .where(eq(biometricDevices.id, id));

  return getBiometricDeviceById(id);
}

export async function createAttendancePunch(input: CreateAttendancePunchInput, tx: DbClient = db) {
  let device: { id: string; deviceCode: string } | null = null;

  if (input.employeeId) {
    await assertEmployeeExists(input.employeeId, tx);
  }

  if (input.deviceId) {
    device = await getBiometricDeviceIdentity(input.deviceId, tx);
  }

  if (input.syncBatchId) {
    await assertAttendanceSyncBatchExists(input.syncBatchId, tx);
  }

  if (input.approvedBy) {
    await assertUserExists(input.approvedBy, tx);
  }

  const punchTime = new Date(input.punchTime);
  const externalUid = input.externalUid ?? (
    device ? generateAttendancePunchExternalUid(device.deviceCode, input.biometricId, punchTime) : null
  );

  const [punch] = await tx
    .insert(attendancePunches)
    .values({
      employeeId: input.employeeId ?? null,
      biometricId: input.biometricId,
      deviceId: input.deviceId ?? null,
      syncBatchId: input.syncBatchId ?? null,
      externalUid,
      punchTime,
      punchType: input.punchType ?? 'UNKNOWN',
      verificationType: input.verificationType ?? null,
      devicePunchId: input.devicePunchId ?? null,
      source: input.source ?? 'DEVICE',
      isProcessed: input.isProcessed ?? false,
      isManual: input.isManual ?? input.source === 'MANUAL',
      manualReason: input.manualReason ?? null,
      approvedBy: input.approvedBy ?? null,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : null,
      supervisorDelegationId: input.supervisorDelegationId ?? null,
      processedAt: input.processedAt ? new Date(input.processedAt) : null,
      rawPayload: input.rawPayload ?? null,
    } as any)
    .returning();

  return getAttendancePunchById(punch.id, tx);
}

export async function getAttendancePunches(scope?: EmployeeVisibilityScope) {
  const punches = await db.query.attendancePunches.findMany({
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      device: {
        with: {
          department: true,
        },
      },
      syncBatch: {
        with: {
          device: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.punchTime)],
  });

  return filterPunchesByScope(await hydratePunchEmployeesByBiometricId(punches), scope);
}

export async function getAttendancePunchesPaginated({
  page = 1,
  pageSize = 50,
  employeeId,
  deviceId,
  status,
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
  scope,
}: {
  page?: number;
  pageSize?: number;
  employeeId?: string | null;
  deviceId?: string | null;
  status?: 'processed' | 'unprocessed' | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  scope?: EmployeeVisibilityScope;
}) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(200, Math.max(1, pageSize));
  const offset = (safePage - 1) * safePageSize;
  const conditions = [
    employeeId ? eq(attendancePunches.employeeId, employeeId) : undefined,
    deviceId ? eq(attendancePunches.deviceId, deviceId) : undefined,
    status === 'processed' ? eq(attendancePunches.isProcessed, true) : undefined,
    status === 'unprocessed' ? eq(attendancePunches.isProcessed, false) : undefined,
    ...buildPunchTimeConditions({ dateFrom, dateTo, timeFrom, timeTo }),
  ].filter(Boolean);
  const whereClause = conditions.length ? and(...conditions as any) : undefined;
  const totalQuery = db.select({ value: count() }).from(attendancePunches);

  const punchQuery = db.query.attendancePunches.findMany({
    where: whereClause,
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      device: {
        with: {
          department: true,
        },
      },
      syncBatch: {
        with: {
          device: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.punchTime)],
    limit: safePageSize,
    offset,
  });

  const [totalResult, punches] = await Promise.all([
    whereClause ? totalQuery.where(whereClause) : totalQuery,
    punchQuery,
  ]);

  const scopedPunches = filterPunchesByScope(await hydratePunchEmployeesByBiometricId(punches), scope);

  return {
    attendancePunches: scopedPunches,
    total: scope && scope.type !== 'unrestricted' ? scopedPunches.length : Number(totalResult[0]?.value ?? 0),
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function getAttendancePunchesByEmployeeId(employeeId: string, scope?: EmployeeVisibilityScope) {
  await assertEmployeeExists(employeeId);
  if (scope) await assertCanAccessEmployee(employeeId, scope);

  const punches = await db.query.attendancePunches.findMany({
    where: eq(attendancePunches.employeeId, employeeId),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      device: {
        with: {
          department: true,
        },
      },
      syncBatch: {
        with: {
          device: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.punchTime)],
  });

  return hydratePunchEmployeesByBiometricId(punches);
}

export async function getUnprocessedAttendancePunches(scope?: EmployeeVisibilityScope) {
  const punches = await db.query.attendancePunches.findMany({
    where: eq(attendancePunches.isProcessed, false),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      device: {
        with: {
          department: true,
        },
      },
      syncBatch: {
        with: {
          device: true,
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.punchTime)],
  });

  return filterPunchesByScope(await hydratePunchEmployeesByBiometricId(punches), scope);
}

async function getAttendancePunchById(id: string, tx: DbClient = db) {
  const punch = await tx.query.attendancePunches.findFirst({
    where: eq(attendancePunches.id, id),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      device: {
        with: {
          department: true,
        },
      },
      syncBatch: {
        with: {
          device: true,
        },
      },
    },
  });

  return punch ? (await hydratePunchEmployeesByBiometricId([punch], tx))[0] : punch;
}

async function hydratePunchEmployeesByBiometricId<T extends { biometricId: string; employee?: unknown | null }>(
  punches: T[],
  tx: DbClient = db,
) {
  const biometricIds = [...new Set(
    punches
      .filter((punch) => !punch.employee)
      .map((punch) => punch.biometricId)
      .filter(Boolean),
  )];

  if (biometricIds.length === 0) {
    return punches;
  }

  const matchedEmployees = await tx.query.employees.findMany({
    where: inArray(employees.biometricId, biometricIds),
    with: {
      department: true,
      position: true,
    },
  });

  const employeeByBiometricId = new Map<string, (typeof matchedEmployees)[number]>(
    matchedEmployees
      .filter((employee: (typeof matchedEmployees)[number]) => employee.biometricId)
      .map((employee: (typeof matchedEmployees)[number]) => [employee.biometricId as string, employee]),
  );

  return punches.map((punch) => ({
    ...punch,
    employee: punch.employee ?? employeeByBiometricId.get(punch.biometricId) ?? null,
  }));
}

function filterPunchesByScope<T extends { employee?: any | null }>(punches: T[], scope?: EmployeeVisibilityScope) {
  if (!scope || scope.type === 'unrestricted' || scope.type === 'hr') return punches;
  return punches.filter((punch) => punch.employee?.userId === scope.userId);
}

function buildPunchTimeConditions({
  dateFrom,
  dateTo,
  timeFrom,
  timeTo,
}: {
  dateFrom?: string | null;
  dateTo?: string | null;
  timeFrom?: string | null;
  timeTo?: string | null;
}) {
  const conditions = [];
  const start = buildPunchBoundary(dateFrom, timeFrom, 'start');
  const end = buildPunchBoundary(dateTo, timeTo, 'end');

  if (start) {
    conditions.push(gte(attendancePunches.punchTime, start));
  }

  if (end) {
    conditions.push(lte(attendancePunches.punchTime, end));
  }

  return conditions;
}

function buildPunchBoundary(dateValue: string | null | undefined, timeValue: string | null | undefined, boundary: 'start' | 'end') {
  const normalizedDate = dateValue?.trim();
  if (!normalizedDate) return null;

  const normalizedTime = normalizeTimeInput(timeValue) ?? (boundary === 'start' ? '00:00:00' : '23:59:59.999');
  const candidate = new Date(`${normalizedDate}T${normalizedTime}`);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate;
}

function normalizeTimeInput(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;

  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }

  return normalized;
}

async function getAttendanceSyncBatchById(id: string, tx: DbClient = db) {
  return tx.query.attendanceSyncBatches.findFirst({
    where: eq(attendanceSyncBatches.id, id),
    with: {
      device: true,
    },
  });
}

async function assertBiometricDeviceExists(id: string, tx: DbClient = db) {
  const found = await tx.query.biometricDevices.findFirst({
    where: eq(biometricDevices.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Biometric device not found');

  return found;
}

async function assertAttendanceSyncBatchExists(id: string, tx: DbClient = db) {
  const found = await tx.query.attendanceSyncBatches.findFirst({
    where: eq(attendanceSyncBatches.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Attendance sync batch not found');
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Employee not found');
}

async function assertDepartmentExists(id: string, tx: DbClient = db) {
  const found = await tx.query.departments.findFirst({
    where: eq(departments.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Department not found');
}

function normalizeBiometricDeviceInput(input: Partial<CreateBiometricDeviceInput | UpdateBiometricDeviceInput>) {
  return removeUndefined({
    deviceName: input.deviceName,
    deviceCode: input.deviceCode,
    ipAddress: input.ipAddress,
    port: input.port,
    locationName: input.locationName,
    departmentId: input.departmentId,
    deviceType: input.deviceType,
    connectionType: input.connectionType,
    vendor: input.vendor,
    protocol: input.protocol,
    integrationMode: input.integrationMode,
    preferredMode: input.preferredMode,
    pushEnabled: input.pushEnabled,
    pullEnabled: input.pullEnabled,
    pushSecret: input.pushSecret,
    communicationKey: input.communicationKey,
    serialNumber: input.serialNumber,
    model: input.model,
    manufacturer: input.manufacturer,
    syncIntervalMinutes: input.syncIntervalMinutes,
    autoSyncEnabled: input.autoSyncEnabled,
    healthStatus: input.healthStatus,
    fallbackToPull: input.fallbackToPull,
    isActive: input.isActive,
  });
}

async function getBiometricDeviceIdentity(id: string, tx: DbClient = db) {
  const found = await tx.query.biometricDevices.findFirst({
    where: eq(biometricDevices.id, id),
    columns: { id: true, deviceCode: true },
  });

  if (!found) throw new Error('Biometric device not found');

  return found;
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('User not found');
}

function generateAttendancePunchExternalUid(deviceCode: string, biometricId: string, punchTime: Date) {
  return `${deviceCode}:${biometricId}:${punchTime.toISOString()}`;
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
