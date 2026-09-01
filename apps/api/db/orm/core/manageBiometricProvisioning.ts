import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../db';
import { biometricDevices, biometricProvisioningDeviceResults, biometricProvisioningJobs, employees } from '../../schema';
import type { BiometricProvisioningMode, CreateBiometricProvisioningPreviewInput } from '../../../types/core.types';

const TERMINAL_JOB_STATUSES = ['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED'];

export async function createBiometricProvisioningPreview(input: CreateBiometricProvisioningPreviewInput, requestedBy: string) {
  const source = await getEnrollmentSource();
  const targetIds = await resolveTargetDeviceIds(input.targetDeviceIds);
  const employeeIds = await validateEmployeeSelection(input.mode, input.employeeIds ?? []);

  return createJob({
    sourceDeviceId: source.id,
    mode: input.mode,
    isPreview: true,
    employeeIds,
    targetDeviceIds: targetIds,
    requestedBy,
  });
}

export async function applyBiometricProvisioningPreview(previewId: string, requestedBy: string) {
  const preview = await getBiometricProvisioningJobById(previewId);
  if (!preview || !preview.isPreview) throw new Error('Provisioning preview not found');
  if (!['PREVIEW_READY', 'WAITING_CONFIRMATION'].includes(preview.status)) {
    throw new Error('The preview is not ready to apply');
  }
  if (preview.deviceResults?.some((result: any) => result.uidConflicts > 0 || result.missingTemplates > 0)) {
    throw new Error('Resolve UID conflicts and missing source templates before applying this preview');
  }

  await assertNoActiveApplyForPreview(preview.id);
  await validateEmployeeSelection(preview.mode as BiometricProvisioningMode, preview.requestedEmployeeIds ?? []);

  return createJob({
    previewJobId: preview.id,
    sourceDeviceId: preview.sourceDeviceId,
    mode: preview.mode as BiometricProvisioningMode,
    isPreview: false,
    employeeIds: preview.requestedEmployeeIds ?? [],
    targetDeviceIds: preview.requestedTargetDeviceIds ?? [],
    requestedBy,
  });
}

export async function retryFailedBiometricProvisioningDevices(jobId: string, requestedBy: string) {
  const previous = await getBiometricProvisioningJobById(jobId);
  if (!previous || previous.isPreview) throw new Error('Applied provisioning job not found');
  if (!TERMINAL_JOB_STATUSES.includes(previous.status)) throw new Error('The provisioning job is still active');

  const failedTargetIds = (previous.deviceResults ?? [])
    .filter((result: any) => result.status === 'FAILED')
    .map((result: any) => result.deviceId)
    .filter((deviceId: string) => deviceId !== previous.sourceDeviceId);
  const sourceFailed = (previous.deviceResults ?? []).some((result: any) => result.deviceId === previous.sourceDeviceId && result.status === 'FAILED');

  if (failedTargetIds.length === 0 && !(previous.mode === 'EMPLOYEE_REMOVE' && sourceFailed)) throw new Error('This job has no failed devices to retry');

  return createJob({
    previewJobId: previous.previewJobId,
    sourceDeviceId: previous.sourceDeviceId,
    mode: previous.mode as BiometricProvisioningMode,
    isPreview: false,
    employeeIds: previous.requestedEmployeeIds ?? [],
    targetDeviceIds: failedTargetIds,
    requestedBy,
  });
}

export async function getBiometricProvisioningJobById(id: string) {
  return db.query.biometricProvisioningJobs.findFirst({
    where: eq(biometricProvisioningJobs.id, id),
    with: {
      sourceDevice: { with: { department: true } },
      deviceResults: {
        with: { device: { with: { department: true } } },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
  });
}

export async function getBiometricProvisioningJobs(limit = 50) {
  return db.query.biometricProvisioningJobs.findMany({
    with: {
      sourceDevice: { with: { department: true } },
      deviceResults: {
        with: { device: { with: { department: true } } },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
    orderBy: [desc(biometricProvisioningJobs.createdAt)],
    limit: Math.min(Math.max(limit, 1), 100),
  });
}

async function createJob(input: {
  previewJobId?: string | null;
  sourceDeviceId: string;
  mode: BiometricProvisioningMode;
  isPreview: boolean;
  employeeIds: string[];
  targetDeviceIds: string[];
  requestedBy: string;
}) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(biometricProvisioningJobs)
      .values({
        previewJobId: input.previewJobId ?? null,
        sourceDeviceId: input.sourceDeviceId,
        mode: input.mode,
        status: 'QUEUED',
        isPreview: input.isPreview,
        requestedEmployeeIds: input.employeeIds,
        requestedTargetDeviceIds: input.targetDeviceIds,
        requestedBy: input.requestedBy,
      })
      .returning();

    const resultDeviceIds = input.mode === 'EMPLOYEE_REMOVE' ? [...new Set([...input.targetDeviceIds, input.sourceDeviceId])] : input.targetDeviceIds;

    if (resultDeviceIds.length > 0) {
      await tx.insert(biometricProvisioningDeviceResults).values(
        resultDeviceIds.map((deviceId) => ({
          jobId: job.id,
          deviceId,
          status: 'PENDING',
        })),
      );
    }

    return tx.query.biometricProvisioningJobs.findFirst({
      where: eq(biometricProvisioningJobs.id, job.id),
      with: {
        sourceDevice: { with: { department: true } },
        deviceResults: { with: { device: { with: { department: true } } } },
      },
    });
  });
}

async function getEnrollmentSource() {
  const sources = await db.query.biometricDevices.findMany({
    where: and(
      eq(biometricDevices.provisioningRole, 'ENROLLMENT_SOURCE'),
      eq(biometricDevices.provisioningEnabled, true),
      eq(biometricDevices.isActive, true),
      isNotNull(biometricDevices.ipAddress),
    ),
    columns: { id: true },
  });

  if (sources.length !== 1) {
    throw new Error('Exactly one active, provisioning-enabled enrollment source with an IP address is required');
  }
  return sources[0];
}

async function resolveTargetDeviceIds(requestedIds: string[] | undefined) {
  const targets = await db.query.biometricDevices.findMany({
    where: and(
      eq(biometricDevices.provisioningRole, 'TARGET'),
      eq(biometricDevices.provisioningEnabled, true),
      eq(biometricDevices.isActive, true),
      isNotNull(biometricDevices.ipAddress),
      requestedIds?.length ? inArray(biometricDevices.id, requestedIds) : undefined,
    ),
    columns: { id: true },
  });

  if (targets.length === 0) throw new Error('Select at least one active, provisioning-enabled target device');
  if (requestedIds?.length && targets.length !== new Set(requestedIds).size) {
    throw new Error('One or more selected target devices are unavailable or not configured for provisioning');
  }
  return targets.map((target) => target.id);
}

async function validateEmployeeSelection(mode: BiometricProvisioningMode, requestedIds: string[]) {
  if (mode === 'FULL_SYNC') return [];
  if (requestedIds.length === 0) throw new Error('Select at least one employee');

  const selected = await db.query.employees.findMany({
    where: inArray(employees.id, requestedIds),
    columns: {
      id: true,
      biometricId: true,
      isActive: true,
      employmentStatus: true,
    },
  });
  if (selected.length !== new Set(requestedIds).size) throw new Error('One or more selected employees do not exist');

  for (const employee of selected) {
    if (!employee.biometricId) throw new Error('Every selected employee must have a biometric ID');
    if (mode === 'EMPLOYEE_UPSERT' && (!employee.isActive || employee.employmentStatus !== 'ACTIVE')) {
      throw new Error('Only active employees can be synchronized');
    }
    if (mode === 'EMPLOYEE_REMOVE' && employee.isActive && employee.employmentStatus === 'ACTIVE') {
      throw new Error('An employee must be inactive before biometric removal');
    }
  }
  return [...new Set(requestedIds)];
}

async function assertNoActiveApplyForPreview(previewId: string) {
  const existing = await db.query.biometricProvisioningJobs.findFirst({
    where: and(eq(biometricProvisioningJobs.previewJobId, previewId), inArray(biometricProvisioningJobs.status, ['QUEUED', 'RUNNING'])),
    columns: { id: true },
  });
  if (existing) throw new Error('This preview already has an active apply job');
}
