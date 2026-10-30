import { Context } from 'hono';
import { z } from 'zod';
import {
  applyEnrollmentSync,
  cancelPendingDeviceCommands,
  DeviceConsoleError,
  deprovisionEmployee,
  getDeviceConsole,
  getEmployeeEnrollment,
  getEnrollmentMasterDevice,
  getEnrollmentOverview,
  getSyncRuns,
  ingestEnrollment,
  previewEnrollmentSync,
  provisionEmployee,
  queueDeviceConsoleCommand,
  refreshDeviceRoster,
  refreshFromMaster,
  retryFailedDeviceCommands,
} from '../../../../db/orm/core/manageBiometricEnrollment';
import { parseUsbBiodataFile, parseUsbUserFile } from '../../../../lib/zkteco/enrollment/parse-records';
import { writeAuditEvent } from '../../../../lib/audit';
import { db } from '../../../../db/db';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';

const SyncRequestSchema = z.object({
  deviceId: z.string().uuid().nullable().optional(),
  allowRemovals: z.boolean().optional().default(false),
});

const DeviceConsoleCommandSchema = z.object({
  command: z.string().trim().min(1).max(20000),
});

const EmployeeDevicesRequestSchema = z.object({
  deviceIds: z.array(z.string().uuid()).optional(),
});

function sessionUserId(c: Context) {
  const session = c.get('session') as { user?: { id?: string } } | undefined;
  return session?.user?.id ?? null;
}

function uploadedFile(formData: FormData, name: string) {
  const file = formData.get(name);
  if (!file || typeof file === 'string' || typeof (file as any).arrayBuffer !== 'function') return null;
  return file as File;
}

export async function getEnrollmentOverviewHandler(c: Context) {
  try {
    return c.json({ success: true, overview: await getEnrollmentOverview() });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric enrollment overview');
  }
}

export async function getEnrollmentSyncRunsHandler(c: Context) {
  try {
    return c.json({ success: true, syncRuns: await getSyncRuns() });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch enrollment sync runs');
  }
}

// USB export from the master: user.dat + biotemplate.dat.
export async function importUsbEnrollmentHandler(c: Context) {
  try {
    const formData = await c.req.formData();
    const userFile = uploadedFile(formData, 'userFile');
    const biodataFile = uploadedFile(formData, 'biodataFile');
    if (!userFile || !biodataFile) {
      return validationErrorResponse(c, 'Both user.dat and biotemplate.dat are required');
    }

    let users;
    let templates;
    try {
      users = parseUsbUserFile(Buffer.from(await userFile.arrayBuffer()));
      templates = parseUsbBiodataFile(await biodataFile.text());
    } catch (error) {
      return validationErrorResponse(c, error instanceof Error ? error.message : 'Invalid USB export');
    }
    if (users.length === 0) {
      return validationErrorResponse(c, 'user.dat contains no users');
    }

    const master = await getEnrollmentMasterDevice();
    const result = await ingestEnrollment({ users, templates, sourceDeviceId: master?.id ?? null, replaceTemplates: true });

    await writeAuditEvent(db, {
      action: 'BIOMETRIC_ENROLLMENT_IMPORTED',
      resourceType: 'biometric_device',
      resourceId: master?.id ?? null,
      resourceLabel: master?.deviceName ?? 'USB export',
      metadata: { users: result.users, templates: result.templates, linkedUsers: result.linkedUsers, unmatched: result.unmatchedPins.length },
    });

    return c.json({ success: true, result }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to import USB enrollment export');
  }
}

export async function refreshFromMasterHandler(c: Context) {
  try {
    return c.json({ success: true, ...(await refreshFromMaster(sessionUserId(c))) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to request enrollment data from the master device');
  }
}

export async function refreshDeviceRosterHandler(c: Context) {
  try {
    return c.json({ success: true, ...(await refreshDeviceRoster(c.req.param('id'), sessionUserId(c))) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to request the device user list');
  }
}

export async function cancelPendingDeviceCommandsHandler(c: Context) {
  try {
    return c.json({ success: true, ...(await cancelPendingDeviceCommands(c.req.param('id'))) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to cancel pending device commands');
  }
}

export async function retryFailedDeviceCommandsHandler(c: Context) {
  try {
    return c.json({ success: true, ...(await retryFailedDeviceCommands(c.req.param('id'))) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to retry device commands');
  }
}

export async function previewEnrollmentSyncHandler(c: Context) {
  try {
    const parsed = SyncRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    return c.json({ success: true, devices: await previewEnrollmentSync(parsed.data) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to preview enrollment sync');
  }
}

export async function applyEnrollmentSyncHandler(c: Context) {
  try {
    const parsed = SyncRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await applyEnrollmentSync({ ...parsed.data, triggeredBy: sessionUserId(c) });
    return c.json({ success: true, ...result }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to start enrollment sync');
  }
}

export async function getEmployeeEnrollmentHandler(c: Context) {
  try {
    return c.json({ success: true, enrollment: await getEmployeeEnrollment(c.req.param('id')) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee biometric enrollment');
  }
}

export async function provisionEmployeeHandler(c: Context) {
  try {
    const parsed = EmployeeDevicesRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await provisionEmployee({ employeeId: c.req.param('id'), deviceIds: parsed.data.deviceIds, triggeredBy: sessionUserId(c) });
    return c.json({ success: true, ...result }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to provision employee to devices');
  }
}

export async function deprovisionEmployeeHandler(c: Context) {
  try {
    const parsed = EmployeeDevicesRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await deprovisionEmployee({ employeeId: c.req.param('id'), deviceIds: parsed.data.deviceIds, triggeredBy: sessionUserId(c) });
    return c.json({ success: true, ...result }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to remove employee from devices');
  }
}

export async function getDeviceConsoleHandler(c: Context) {
  try {
    return c.json({ success: true, console: await getDeviceConsole(c.req.param('id'), c.req.query('watchPin')) });
  } catch (error) {
    if (error instanceof DeviceConsoleError) return validationErrorResponse(c, error.message);
    return coreErrorResponse(c, error, 'Failed to fetch the device console');
  }
}

export async function sendDeviceConsoleCommandHandler(c: Context) {
  try {
    const parsed = DeviceConsoleCommandSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await queueDeviceConsoleCommand({ deviceId: c.req.param('id'), command: parsed.data.command, triggeredBy: sessionUserId(c) });
    return c.json({ success: true, ...result }, 201);
  } catch (error) {
    if (error instanceof DeviceConsoleError) return validationErrorResponse(c, error.message);
    return coreErrorResponse(c, error, 'Failed to send the device command');
  }
}
