import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  biometricDeviceCommands,
  biometricDeviceExclusions,
  biometricDeviceRoster,
  biometricDevices,
  biometricDeviceUsers,
  biometricSyncRuns,
  biometricTemplates,
  employees,
} from '../../schema';
import { writeAuditEvent } from '../../../lib/audit';
import { isWorkingEmployee } from '../../../lib/employees/employment-status';
import {
  buildBiodataQueryCommand,
  buildBiodataUpsertCommand,
  buildUserDeleteCommand,
  buildUserUpsertCommand,
  QUERY_ALL_USERS_COMMAND,
} from '../../../lib/zkteco/enrollment/commands';
import { computeTemplatesHash, planDeviceSync, type DevicePlan, type PlannerUser } from '../../../lib/zkteco/enrollment/sync-planner';
import { decryptTemplate, encryptTemplate, hashTemplate } from '../../../lib/zkteco/enrollment/template-crypto';
import type { DeviceCommandReply, EnrollmentTemplate, EnrollmentUser } from '../../../lib/zkteco/enrollment/types';

type DbClient = typeof db | any;
type Device = typeof biometricDevices.$inferSelect;

const INSERT_CHUNK = 500;
const TEMPLATE_INSERT_CHUNK = 200;
// Commands per getrequest reply; tune with ZK_ADMS_COMMAND_BATCH during the pilot.
const COMMAND_BATCH_MAX = Math.min(Math.max(Number.parseInt(process.env.ZK_ADMS_COMMAND_BATCH ?? '', 10) || 100, 1), 500);
// Bytes per getrequest reply. Device firmware reads replies into a small buffer, so a reply
// of many ~2.7 KB templates gets cut off; 48 KB holds about one user's face + palm.
const COMMAND_BATCH_MAX_BYTES = Math.min(Math.max(Number.parseInt(process.env.ZK_ADMS_COMMAND_MAX_KB ?? '', 10) || 48, 4), 512) * 1024;
const COMMAND_REPLY_TIMEOUT_MS = 10 * 60 * 1000;
const COMMAND_MAX_ATTEMPTS = 3;
const DEFAULT_QUERY_BIO_TYPES = [2, 8];

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export function admsCommandsEnabled() {
  return process.env.ZK_ADMS_COMMANDS_ENABLED === 'true';
}

function autoRemoveOnDeactivateEnabled() {
  return process.env.ZK_AUTO_REMOVE_ON_DEACTIVATE === 'true';
}

export async function getEnrollmentMasterDevice(tx: DbClient = db): Promise<Device | undefined> {
  return tx.query.biometricDevices.findFirst({
    where: and(eq(biometricDevices.isEnrollmentMaster, true), eq(biometricDevices.isActive, true)),
  });
}

// ---------------------------------------------------------------------------
// Capture: users and templates from the master (USB export or ADMS upload)
// ---------------------------------------------------------------------------

export type EnrollmentIngestResult = {
  users: number;
  templates: number;
  linkedUsers: number;
  unmatchedPins: string[];
};

export async function ingestEnrollment(input: {
  users: EnrollmentUser[];
  templates: EnrollmentTemplate[];
  sourceDeviceId: string | null;
  // A USB export is a full snapshot per user, so the user's old templates are replaced.
  replaceTemplates: boolean;
}): Promise<EnrollmentIngestResult> {
  const now = new Date();
  // USB exports repeat identical BIODATA rows; one row per (pin, type, no, index) slot.
  // Large templates are split into fragments across Index values, so every slot is kept.
  const templates = [...new Map(input.templates.map((template) => [
    `${template.pin}|${template.bioType}|${template.bioNo}|${template.bioIndex}`,
    template,
  ])).values()];
  const templatePins = [...new Set(templates.map((template) => template.pin))];
  const allPins = [...new Set([...input.users.map((user) => user.pin), ...templatePins])];
  if (allPins.length === 0) return { users: 0, templates: 0, linkedUsers: 0, unmatchedPins: [] };

  await db.transaction(async (tx) => {
    for (const users of chunk(input.users, INSERT_CHUNK)) {
      await tx
        .insert(biometricDeviceUsers)
        .values(users.map((user) => ({
          pin: user.pin,
          name: user.name,
          privilege: user.privilege,
          password: user.password,
          card: user.card,
          sourceDeviceId: input.sourceDeviceId,
          lastCapturedAt: now,
        })))
        .onConflictDoUpdate({
          target: biometricDeviceUsers.pin,
          set: {
            name: sql`excluded.name`,
            privilege: sql`excluded.privilege`,
            password: sql`excluded.password`,
            card: sql`excluded.card`,
            sourceDeviceId: sql`excluded.source_device_id`,
            lastCapturedAt: now,
            updatedAt: now,
          },
        });
    }

    // Templates can arrive before (or without) their USER line.
    for (const pins of chunk(templatePins, INSERT_CHUNK)) {
      await tx
        .insert(biometricDeviceUsers)
        .values(pins.map((pin) => ({ pin, sourceDeviceId: input.sourceDeviceId, lastCapturedAt: now })))
        .onConflictDoNothing();
    }

    const userIdByPin = new Map<string, string>();
    for (const pins of chunk(allPins, INSERT_CHUNK)) {
      const rows = await tx
        .select({ id: biometricDeviceUsers.id, pin: biometricDeviceUsers.pin })
        .from(biometricDeviceUsers)
        .where(inArray(biometricDeviceUsers.pin, pins));
      for (const row of rows) userIdByPin.set(row.pin, row.id);
    }

    if (input.replaceTemplates) {
      for (const pins of chunk(templatePins, INSERT_CHUNK)) {
        await tx.delete(biometricTemplates).where(inArray(biometricTemplates.deviceUserId, pins.map((pin) => userIdByPin.get(pin)!)));
      }
    }

    for (const batch of chunk(templates, TEMPLATE_INSERT_CHUNK)) {
      await tx
        .insert(biometricTemplates)
        .values(batch.map((template) => ({
          deviceUserId: userIdByPin.get(template.pin)!,
          bioType: template.bioType,
          bioNo: template.bioNo,
          bioIndex: template.bioIndex,
          valid: template.valid,
          duress: template.duress,
          majorVer: template.majorVer,
          minorVer: template.minorVer,
          format: template.format,
          templateEnc: encryptTemplate(template.template),
          templateSha256: hashTemplate(template.template),
          capturedAt: now,
        })))
        .onConflictDoUpdate({
          target: [biometricTemplates.deviceUserId, biometricTemplates.bioType, biometricTemplates.bioNo, biometricTemplates.bioIndex],
          set: {
            valid: sql`excluded.valid`,
            duress: sql`excluded.duress`,
            majorVer: sql`excluded.major_ver`,
            minorVer: sql`excluded.minor_ver`,
            format: sql`excluded.format`,
            templateEnc: sql`excluded.template_enc`,
            templateSha256: sql`excluded.template_sha256`,
            capturedAt: now,
          },
        });
    }

    // Whatever the master reported is on the master; removals there go through the roster.
    if (input.sourceDeviceId) {
      await upsertRosterPins(input.sourceDeviceId, allPins, tx);
    }

    await linkEnrollmentUsersToEmployees(tx);
  });

  const linked = await db
    .select({ pin: biometricDeviceUsers.pin, employeeId: biometricDeviceUsers.employeeId })
    .from(biometricDeviceUsers)
    .where(inArray(biometricDeviceUsers.pin, allPins.slice(0, 5000)));

  return {
    users: allPins.length,
    templates: templates.length,
    linkedUsers: linked.filter((row) => row.employeeId).length,
    unmatchedPins: linked.filter((row) => !row.employeeId).map((row) => row.pin).sort(),
  };
}

// Same matching rule as the TCP pull: biometric id first, then employee code. Re-run
// before anything that reads the links, since employees' biometric ids change in TAAMS
// after the enrollment was captured. Only rows whose match changed are written.
export async function linkEnrollmentUsersToEmployees(tx: DbClient = db) {
  await tx.execute(sql`
    UPDATE biometric_device_users u
    SET employee_id = m.employee_id, updated_at = now()
    FROM (
      SELECT u2.id,
        COALESCE(
          (SELECT e.id FROM employees e WHERE e.biometric_id = u2.pin LIMIT 1),
          (SELECT e.id FROM employees e WHERE e.employee_code = u2.pin LIMIT 1)
        ) AS employee_id
      FROM biometric_device_users u2
    ) m
    WHERE m.id = u.id AND u.employee_id IS DISTINCT FROM m.employee_id
  `);
}

// Users a device reported (DATA QUERY USERINFO). Known template hashes are kept.
async function upsertRosterPins(deviceId: string, pins: string[], tx: DbClient = db) {
  for (const batch of chunk(pins, INSERT_CHUNK)) {
    await tx
      .insert(biometricDeviceRoster)
      .values(batch.map((pin) => ({ deviceId, pin, templatesHash: null })))
      .onConflictDoNothing();
  }
}

// ADMS uploads: the master feeds TAAMS; other enrolled devices only report what they hold.
export async function handleDeviceEnrollmentUpload(device: Device, upload: { users: EnrollmentUser[]; templates: EnrollmentTemplate[] }) {
  if (upload.users.length === 0 && upload.templates.length === 0) return;

  if (device.isEnrollmentMaster) {
    const result = await ingestEnrollment({ ...upload, sourceDeviceId: device.id, replaceTemplates: false });
    console.log('Captured enrollment upload from master device', {
      deviceId: device.id,
      users: upload.users.length,
      templates: upload.templates.length,
      unmatchedPins: result.unmatchedPins.length,
    });
    return;
  }

  if (device.enrollmentSyncEnabled && upload.users.length > 0) {
    await upsertRosterPins(device.id, [...new Set(upload.users.map((user) => user.pin))]);
  }
}

// ---------------------------------------------------------------------------
// ADMS command queue
// ---------------------------------------------------------------------------

export async function markDeviceCommandPoll(deviceId: string, pushVersion?: string | null) {
  const now = new Date();
  await db
    .update(biometricDevices)
    .set({
      lastCommandPollAt: now,
      lastSeenAt: now,
      ...(pushVersion ? { pushProtocolVersion: pushVersion.slice(0, 50) } : {}),
    })
    .where(eq(biometricDevices.id, deviceId));
}

// Hands the next commands to a polling device and marks them SENT. Commands the device
// never confirmed are re-sent after a timeout, up to COMMAND_MAX_ATTEMPTS.
export async function claimDeviceCommands(deviceId: string) {
  return db.transaction(async (tx) => {
    const timedOutBefore = new Date(Date.now() - COMMAND_REPLY_TIMEOUT_MS);

    await tx
      .update(biometricDeviceCommands)
      .set({ status: 'FAILED', completedAt: new Date() })
      .where(and(
        eq(biometricDeviceCommands.deviceId, deviceId),
        eq(biometricDeviceCommands.status, 'SENT'),
        lt(biometricDeviceCommands.sentAt, timedOutBefore),
        sql`${biometricDeviceCommands.attempts} >= ${COMMAND_MAX_ATTEMPTS}`,
      ));

    const candidates = await tx
      .select()
      .from(biometricDeviceCommands)
      .where(and(
        eq(biometricDeviceCommands.deviceId, deviceId),
        or(
          eq(biometricDeviceCommands.status, 'PENDING'),
          and(eq(biometricDeviceCommands.status, 'SENT'), lt(biometricDeviceCommands.sentAt, timedOutBefore)),
        ),
      ))
      .orderBy(asc(biometricDeviceCommands.id))
      .limit(COMMAND_BATCH_MAX)
      .for('update', { skipLocked: true });

    if (candidates.length === 0) return [];

    const pins = [...new Set(candidates.map((command) => command.pin).filter((pin): pin is string => Boolean(pin)))];
    const templateIds = candidates.map((command) => command.templateId).filter((id): id is string => Boolean(id));
    const users = pins.length
      ? await tx.select().from(biometricDeviceUsers).where(inArray(biometricDeviceUsers.pin, pins))
      : [];
    const templates = templateIds.length
      ? await tx.select().from(biometricTemplates).where(inArray(biometricTemplates.id, templateIds))
      : [];
    const userByPin = new Map(users.map((user) => [user.pin, user]));
    const templateById = new Map(templates.map((template) => [template.id, template]));

    const lines: { id: number; command: string }[] = [];
    const cancelled: number[] = [];
    let bytes = 0;

    for (const command of candidates) {
      const text = buildQueuedCommandText(command, userByPin, templateById);
      if (text === null) {
        cancelled.push(command.id);
        continue;
      }
      if (lines.length > 0 && bytes + text.length > COMMAND_BATCH_MAX_BYTES) break;
      bytes += text.length;
      lines.push({ id: command.id, command: text });
    }

    if (cancelled.length) {
      await tx
        .update(biometricDeviceCommands)
        .set({ status: 'CANCELLED', completedAt: new Date() })
        .where(inArray(biometricDeviceCommands.id, cancelled));
    }
    if (lines.length) {
      await tx
        .update(biometricDeviceCommands)
        .set({ status: 'SENT', sentAt: new Date(), attempts: sql`${biometricDeviceCommands.attempts} + 1` })
        .where(inArray(biometricDeviceCommands.id, lines.map((line) => line.id)));
    }

    return lines;
  });
}

// Returns null when the user/template behind the command no longer exists.
function buildQueuedCommandText(
  command: typeof biometricDeviceCommands.$inferSelect,
  userByPin: Map<string, typeof biometricDeviceUsers.$inferSelect>,
  templateById: Map<string, typeof biometricTemplates.$inferSelect>,
) {
  switch (command.kind) {
    case 'USER_UPSERT': {
      const user = command.pin ? userByPin.get(command.pin) : undefined;
      if (!user) return null;
      return buildUserUpsertCommand(user);
    }
    case 'BIODATA_UPSERT': {
      const template = command.templateId ? templateById.get(command.templateId) : undefined;
      if (!template || !command.pin) return null;
      return buildBiodataUpsertCommand({ ...template, pin: command.pin, template: decryptTemplate(template.templateEnc) });
    }
    case 'USER_DELETE':
      return command.pin ? buildUserDeleteCommand(command.pin) : null;
    default:
      return command.commandText ?? null;
  }
}

// devicecmd replies. Return >= 0 is success on ZKTeco firmware.
export async function completeDeviceCommands(deviceId: string, replies: DeviceCommandReply[]) {
  if (replies.length === 0) return;
  const now = new Date();

  // Rejections are logged always (not only with ZK_ADMS_DEBUG): the code says why the firmware refused.
  const failures = replies.filter((reply) => reply.returnCode < 0);
  if (failures.length) {
    const byCode: Record<string, number> = {};
    for (const reply of failures) {
      const key = `${reply.cmd ?? '?'} Return=${reply.returnCode}`;
      byCode[key] = (byCode[key] ?? 0) + 1;
    }
    console.warn('ZKTeco device rejected commands', { deviceId, failed: failures.length, of: replies.length, byCode, sampleIds: failures.slice(0, 5).map((reply) => reply.id) });
  }

  await db.transaction(async (tx) => {
    const completed: (typeof biometricDeviceCommands.$inferSelect)[] = [];
    for (const reply of replies) {
      const succeeded = reply.returnCode >= 0;
      const [row] = await tx
        .update(biometricDeviceCommands)
        .set({ status: succeeded ? 'SUCCEEDED' : 'FAILED', returnCode: reply.returnCode, completedAt: now })
        .where(and(
          eq(biometricDeviceCommands.id, reply.id),
          eq(biometricDeviceCommands.deviceId, deviceId),
          inArray(biometricDeviceCommands.status, ['SENT', 'PENDING']),
        ))
        .returning();
      if (row && succeeded) completed.push(row);
    }

    const deletedPins = completed.filter((row) => row.kind === 'USER_DELETE' && row.pin).map((row) => row.pin!);
    if (deletedPins.length) {
      await tx
        .delete(biometricDeviceRoster)
        .where(and(eq(biometricDeviceRoster.deviceId, deviceId), inArray(biometricDeviceRoster.pin, deletedPins)));
    }

    // The user exists on the device once USERINFO succeeded; its hash is recorded only
    // when every command of that provisioning (same run + PIN) has succeeded.
    const upserted = completed.filter((row) => (row.kind === 'USER_UPSERT' || row.kind === 'BIODATA_UPSERT') && row.pin);
    const groups = new Map<string, { pin: string; syncRunId: string | null }>();
    for (const row of upserted) groups.set(`${row.syncRunId}:${row.pin}`, { pin: row.pin!, syncRunId: row.syncRunId });

    for (const { pin, syncRunId } of groups.values()) {
      const groupCommands = await tx
        .select({ kind: biometricDeviceCommands.kind, status: biometricDeviceCommands.status, templatesHash: biometricDeviceCommands.templatesHash })
        .from(biometricDeviceCommands)
        .where(and(
          eq(biometricDeviceCommands.deviceId, deviceId),
          eq(biometricDeviceCommands.pin, pin),
          syncRunId ? eq(biometricDeviceCommands.syncRunId, syncRunId) : sql`${biometricDeviceCommands.syncRunId} IS NULL`,
          inArray(biometricDeviceCommands.kind, ['USER_UPSERT', 'BIODATA_UPSERT']),
        ));
      const userCommand = groupCommands.find((command) => command.kind === 'USER_UPSERT');
      if (!userCommand || userCommand.status !== 'SUCCEEDED') continue;
      const allSucceeded = groupCommands.every((command) => command.status === 'SUCCEEDED');
      const templatesHash = allSucceeded ? userCommand.templatesHash : null;

      await tx
        .insert(biometricDeviceRoster)
        .values({ deviceId, pin, templatesHash, confirmedAt: now })
        .onConflictDoUpdate({
          target: [biometricDeviceRoster.deviceId, biometricDeviceRoster.pin],
          set: { templatesHash, confirmedAt: now },
        });
    }
  });
}

// ---------------------------------------------------------------------------
// Planning and queueing
// ---------------------------------------------------------------------------

type ProvisionableUser = PlannerUser & {
  templateIds: string[];
};

async function loadProvisionableUsers(tx: DbClient = db): Promise<ProvisionableUser[]> {
  const rows = await tx
    .select({
      pin: biometricDeviceUsers.pin,
      employeeId: biometricDeviceUsers.employeeId,
      name: biometricDeviceUsers.name,
      privilege: biometricDeviceUsers.privilege,
      password: biometricDeviceUsers.password,
      card: biometricDeviceUsers.card,
      isActive: employees.isActive,
      employmentStatus: employees.employmentStatus,
      sourceEmploymentStatus: employees.sourceEmploymentStatus,
      templateId: biometricTemplates.id,
      templateSha256: biometricTemplates.templateSha256,
    })
    .from(biometricDeviceUsers)
    .leftJoin(employees, eq(employees.id, biometricDeviceUsers.employeeId))
    .leftJoin(biometricTemplates, eq(biometricTemplates.deviceUserId, biometricDeviceUsers.id))
    .orderBy(asc(biometricDeviceUsers.pin), asc(biometricTemplates.bioType), asc(biometricTemplates.bioNo), asc(biometricTemplates.bioIndex));

  const byPin = new Map<string, { row: (typeof rows)[number]; templateIds: string[]; hashes: string[] }>();
  for (const row of rows) {
    let entry = byPin.get(row.pin);
    if (!entry) {
      entry = { row, templateIds: [], hashes: [`user:${row.name ?? ''}|${row.privilege}|${row.password ?? ''}|${row.card ?? ''}`] };
      byPin.set(row.pin, entry);
    }
    if (row.templateId && row.templateSha256) {
      entry.templateIds.push(row.templateId);
      entry.hashes.push(row.templateSha256);
    }
  }

  return [...byPin.values()].map(({ row, templateIds, hashes }) => ({
    pin: row.pin,
    employeeId: row.employeeId,
    employeeActive: row.employeeId ? isWorkingEmployee(row) : null,
    templatesHash: computeTemplatesHash(hashes),
    templateIds,
  }));
}

async function loadDeviceRoster(deviceId: string, tx: DbClient = db) {
  const rows = await tx
    .select({ pin: biometricDeviceRoster.pin, templatesHash: biometricDeviceRoster.templatesHash })
    .from(biometricDeviceRoster)
    .where(eq(biometricDeviceRoster.deviceId, deviceId));
  return new Map<string, string | null>(rows.map((row: { pin: string; templatesHash: string | null }) => [row.pin, row.templatesHash]));
}

async function loadDeviceExclusions(deviceId: string, tx: DbClient = db) {
  const rows = await tx
    .select({ employeeId: biometricDeviceExclusions.employeeId })
    .from(biometricDeviceExclusions)
    .where(eq(biometricDeviceExclusions.deviceId, deviceId));
  return new Set<string>(rows.map((row: { employeeId: string }) => row.employeeId));
}

// Devices that take part in enrollment sync. The master only ever receives removals.
async function getSyncDevices(deviceId?: string | null, tx: DbClient = db): Promise<Device[]> {
  const devices: Device[] = await tx.query.biometricDevices.findMany({
    where: and(eq(biometricDevices.isActive, true), eq(biometricDevices.enrollmentSyncEnabled, true)),
    orderBy: (table: typeof biometricDevices, { asc }: any) => [asc(table.deviceName)],
  });
  if (!deviceId) return devices;
  const device = devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error('Enrollment sync is not enabled for this device (or the device was not found)');
  return [device];
}

export type DeviceSyncPreview = Omit<DevicePlan, 'add' | 'update' | 'remove' | 'heldRemovals' | 'unknownOnDevice'> & {
  deviceName: string;
  isEnrollmentMaster: boolean;
  rosterSize: number;
  add: number;
  update: number;
  remove: number;
  heldRemovals: number;
  unknownOnDevice: number;
  removePins: string[];
  heldRemovalPins: string[];
};

function summarizePlan(device: Device, plan: DevicePlan, rosterSize: number): DeviceSyncPreview {
  return {
    deviceId: device.id,
    deviceName: device.deviceName,
    isEnrollmentMaster: device.isEnrollmentMaster,
    rosterSize,
    add: plan.add.length,
    update: plan.update.length,
    remove: plan.remove.length,
    heldRemovals: plan.heldRemovals.length,
    unknownOnDevice: plan.unknownOnDevice.length,
    removePins: plan.remove.slice(0, 200),
    heldRemovalPins: plan.heldRemovals.slice(0, 200),
  };
}

export async function previewEnrollmentSync(input: { deviceId?: string | null; allowRemovals: boolean }) {
  await linkEnrollmentUsersToEmployees();
  const devices = await getSyncDevices(input.deviceId);
  const users = await loadProvisionableUsers();
  const previews: DeviceSyncPreview[] = [];
  for (const device of devices) {
    const roster = await loadDeviceRoster(device.id);
    const plan = planDeviceSync(
      { deviceId: device.id, removalsOnly: device.isEnrollmentMaster, roster, excludedEmployeeIds: await loadDeviceExclusions(device.id) },
      users,
      input.allowRemovals,
    );
    previews.push(summarizePlan(device, plan, roster.size));
  }
  return previews;
}

type QueuedCommand = typeof biometricDeviceCommands.$inferInsert;

function provisionCommands(deviceId: string, syncRunId: string, user: ProvisionableUser): QueuedCommand[] {
  return [
    { deviceId, syncRunId, kind: 'USER_UPSERT', pin: user.pin, templatesHash: user.templatesHash },
    ...user.templateIds.map((templateId) => ({ deviceId, syncRunId, kind: 'BIODATA_UPSERT', pin: user.pin, templateId })),
  ];
}

async function insertCommands(commands: QueuedCommand[], tx: DbClient) {
  for (const batch of chunk(commands, 1000)) {
    await tx.insert(biometricDeviceCommands).values(batch);
  }
}

// Per-device transaction lock so two syncs never interleave their queues.
async function lockDeviceQueue(deviceId: string, tx: DbClient) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`biometric-enrollment:${deviceId}`}))`);
}

async function createSyncRun(values: typeof biometricSyncRuns.$inferInsert, tx: DbClient = db) {
  const [run] = await tx.insert(biometricSyncRuns).values(values).returning();
  return run as typeof biometricSyncRuns.$inferSelect;
}

export async function applyEnrollmentSync(input: { deviceId?: string | null; allowRemovals: boolean; triggeredBy: string | null }) {
  await linkEnrollmentUsersToEmployees();
  const devices = await getSyncDevices(input.deviceId);
  const users = await loadProvisionableUsers();
  const usersByPin = new Map(users.map((user) => [user.pin, user]));
  const run = await createSyncRun({
    triggeredBy: input.triggeredBy,
    scope: input.deviceId ? 'DEVICE' : 'ALL',
    deviceId: input.deviceId ?? null,
    allowRemovals: input.allowRemovals,
  });

  const previews: DeviceSyncPreview[] = [];
  for (const device of devices) {
    const preview = await db.transaction(async (tx) => {
      await lockDeviceQueue(device.id, tx);
      // A new sync supersedes whatever an earlier sync left queued for this device.
      await tx
        .update(biometricDeviceCommands)
        .set({ status: 'CANCELLED', completedAt: new Date() })
        .where(and(
          eq(biometricDeviceCommands.deviceId, device.id),
          eq(biometricDeviceCommands.status, 'PENDING'),
          inArray(biometricDeviceCommands.kind, ['USER_UPSERT', 'BIODATA_UPSERT', 'USER_DELETE']),
        ));

      const roster = await loadDeviceRoster(device.id, tx);
      const plan = planDeviceSync(
        { deviceId: device.id, removalsOnly: device.isEnrollmentMaster, roster, excludedEmployeeIds: await loadDeviceExclusions(device.id, tx) },
        users,
        input.allowRemovals,
      );

      const commands: QueuedCommand[] = [];
      for (const pin of [...plan.add, ...plan.update]) {
        commands.push(...provisionCommands(device.id, run.id, usersByPin.get(pin)!));
      }
      for (const pin of plan.remove) {
        commands.push({ deviceId: device.id, syncRunId: run.id, kind: 'USER_DELETE', pin });
      }
      await insertCommands(commands, tx);
      return summarizePlan(device, plan, roster.size);
    });
    previews.push(preview);
  }

  const totals = previews.reduce((sum, preview) => ({
    usersAdded: sum.usersAdded + preview.add,
    usersUpdated: sum.usersUpdated + preview.update,
    usersRemoved: sum.usersRemoved + preview.remove,
  }), { usersAdded: 0, usersUpdated: 0, usersRemoved: 0 });
  await db.update(biometricSyncRuns).set(totals).where(eq(biometricSyncRuns.id, run.id));

  await writeAuditEvent(db, {
    action: 'BIOMETRIC_ENROLLMENT_SYNCED',
    resourceType: 'biometric_sync_run',
    resourceId: run.id,
    metadata: { deviceId: input.deviceId ?? null, allowRemovals: input.allowRemovals, devices: devices.length, ...totals },
  });

  return { syncRunId: run.id, devices: previews };
}

// Asks the master to upload every user and template (it answers through cdata/querydata).
export async function refreshFromMaster(triggeredBy: string | null) {
  const master = await getEnrollmentMasterDevice();
  if (!master) throw new Error('No enrollment master device is configured');
  if (!master.enrollmentSyncEnabled) throw new Error('Enrollment sync must be enabled on the master device');

  const typeRows = await db.selectDistinct({ bioType: biometricTemplates.bioType }).from(biometricTemplates);
  const bioTypes = typeRows.length ? typeRows.map((row) => row.bioType) : DEFAULT_QUERY_BIO_TYPES;
  const run = await createSyncRun({ triggeredBy, scope: 'MASTER_REFRESH', deviceId: master.id });
  await insertCommands([
    { deviceId: master.id, syncRunId: run.id, kind: 'QUERY', commandText: QUERY_ALL_USERS_COMMAND },
    ...bioTypes.map((bioType) => ({ deviceId: master.id, syncRunId: run.id, kind: 'QUERY', commandText: buildBiodataQueryCommand(bioType) })),
  ], db);
  return { syncRunId: run.id, deviceId: master.id };
}

// Asks a device which users it holds, so removals can be planned for users copied by USB.
export async function refreshDeviceRoster(deviceId: string, triggeredBy: string | null) {
  const [device] = await getSyncDevices(deviceId);
  const run = await createSyncRun({ triggeredBy, scope: 'ROSTER_REFRESH', deviceId: device.id });
  await insertCommands([{ deviceId: device.id, syncRunId: run.id, kind: 'QUERY', commandText: QUERY_ALL_USERS_COMMAND }], db);
  return { syncRunId: run.id, deviceId: device.id };
}

export async function cancelPendingDeviceCommands(deviceId: string) {
  const cancelled = await db
    .update(biometricDeviceCommands)
    .set({ status: 'CANCELLED', completedAt: new Date() })
    .where(and(eq(biometricDeviceCommands.deviceId, deviceId), inArray(biometricDeviceCommands.status, ['PENDING', 'SENT'])))
    .returning({ id: biometricDeviceCommands.id });
  return { cancelled: cancelled.length };
}

export async function retryFailedDeviceCommands(deviceId: string) {
  const retried = await db
    .update(biometricDeviceCommands)
    .set({ status: 'PENDING', attempts: 0, returnCode: null, sentAt: null, completedAt: null })
    .where(and(eq(biometricDeviceCommands.deviceId, deviceId), eq(biometricDeviceCommands.status, 'FAILED')))
    .returning({ id: biometricDeviceCommands.id });
  return { retried: retried.length };
}

// ---------------------------------------------------------------------------
// Per-employee actions
// ---------------------------------------------------------------------------

async function getEmployeeEnrollmentUser(employeeId: string, tx: DbClient = db) {
  await linkEnrollmentUsersToEmployees(tx);
  const employee = await tx.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { id: true, biometricId: true, employeeCode: true, isActive: true, employmentStatus: true, sourceEmploymentStatus: true },
  });
  if (!employee) throw new Error('Employee not found');

  const enrollmentUser = await tx.query.biometricDeviceUsers.findFirst({
    where: eq(biometricDeviceUsers.employeeId, employeeId),
  });
  return { employee, enrollmentUser: enrollmentUser as typeof biometricDeviceUsers.$inferSelect | undefined };
}

export async function provisionEmployee(input: { employeeId: string; deviceIds?: string[]; triggeredBy: string | null }) {
  const { employee, enrollmentUser } = await getEmployeeEnrollmentUser(input.employeeId);
  if (!enrollmentUser) throw new Error('No enrollment found for this employee: enroll on the master device first');

  const devices = (await getSyncDevices()).filter((device) => !device.isEnrollmentMaster
    && (!input.deviceIds?.length || input.deviceIds.includes(device.id)));
  if (devices.length === 0) throw new Error('No enrollment-enabled devices selected');

  const user = (await loadProvisionableUsers()).find((candidate) => candidate.pin === enrollmentUser.pin)!;
  const run = await createSyncRun({ triggeredBy: input.triggeredBy, scope: 'EMPLOYEE', employeeId: employee.id, usersAdded: devices.length });

  await db.transaction(async (tx) => {
    await tx
      .delete(biometricDeviceExclusions)
      .where(and(eq(biometricDeviceExclusions.employeeId, employee.id), inArray(biometricDeviceExclusions.deviceId, devices.map((device) => device.id))));
    for (const device of devices) {
      await lockDeviceQueue(device.id, tx);
      await insertCommands(provisionCommands(device.id, run.id, user), tx);
    }
  });

  await writeAuditEvent(db, {
    action: 'BIOMETRIC_EMPLOYEE_PROVISIONED',
    resourceType: 'employee',
    resourceId: employee.id,
    resourceLabel: employee.employeeCode,
    employeeId: employee.id,
    metadata: { syncRunId: run.id, deviceIds: devices.map((device) => device.id) },
  });
  return { syncRunId: run.id, devices: devices.length };
}

// Removes the employee from the chosen devices and excludes them there, so a later sync
// does not add them back.
export async function deprovisionEmployee(input: { employeeId: string; deviceIds?: string[]; triggeredBy: string | null }) {
  const { employee, enrollmentUser } = await getEmployeeEnrollmentUser(input.employeeId);
  const pin = enrollmentUser?.pin ?? employee.biometricId;
  if (!pin) throw new Error('Employee has no biometric id');

  const devices = (await getSyncDevices()).filter((device) => (input.deviceIds?.length
    ? input.deviceIds.includes(device.id)
    : !device.isEnrollmentMaster));
  if (devices.length === 0) throw new Error('No enrollment-enabled devices selected');

  const run = await createSyncRun({ triggeredBy: input.triggeredBy, scope: 'EMPLOYEE', employeeId: employee.id, allowRemovals: true, usersRemoved: devices.length });
  await db.transaction(async (tx) => {
    await tx
      .insert(biometricDeviceExclusions)
      .values(devices.map((device) => ({ employeeId: employee.id, deviceId: device.id, createdBy: input.triggeredBy })))
      .onConflictDoNothing();
    for (const device of devices) {
      await lockDeviceQueue(device.id, tx);
      await tx
        .update(biometricDeviceCommands)
        .set({ status: 'CANCELLED', completedAt: new Date() })
        .where(and(eq(biometricDeviceCommands.deviceId, device.id), eq(biometricDeviceCommands.pin, pin), eq(biometricDeviceCommands.status, 'PENDING')));
      await insertCommands([{ deviceId: device.id, syncRunId: run.id, kind: 'USER_DELETE', pin }], tx);
    }
  });

  await writeAuditEvent(db, {
    action: 'BIOMETRIC_EMPLOYEE_DEPROVISIONED',
    resourceType: 'employee',
    resourceId: employee.id,
    resourceLabel: employee.employeeCode,
    employeeId: employee.id,
    metadata: { syncRunId: run.id, deviceIds: devices.map((device) => device.id) },
  });
  return { syncRunId: run.id, devices: devices.length };
}

// Called after an employee stops being active. Queues removal from every enrollment
// device (master included) that is known to hold them. Off unless ZK_AUTO_REMOVE_ON_DEACTIVATE=true.
export async function queueEnrollmentRemovalForDeactivatedEmployee(employeeId: string) {
  if (!autoRemoveOnDeactivateEnabled()) return;
  try {
    const { employee, enrollmentUser } = await getEmployeeEnrollmentUser(employeeId);
    if (isWorkingEmployee(employee)) return;
    const pin = enrollmentUser?.pin ?? employee.biometricId;
    if (!pin) return;

    const devices = await getSyncDevices();
    const holding = devices.length
      ? await db
        .select({ deviceId: biometricDeviceRoster.deviceId })
        .from(biometricDeviceRoster)
        .where(and(eq(biometricDeviceRoster.pin, pin), inArray(biometricDeviceRoster.deviceId, devices.map((device) => device.id))))
      : [];
    if (holding.length === 0) return;

    const run = await createSyncRun({ scope: 'AUTO_REMOVE', employeeId, allowRemovals: true, usersRemoved: holding.length });
    await insertCommands(holding.map(({ deviceId }) => ({ deviceId, syncRunId: run.id, kind: 'USER_DELETE', pin })), db);
  } catch (error) {
    console.error('Failed to queue biometric removal for deactivated employee', {
      employeeId,
      message: error instanceof Error ? error.message : error,
    });
  }
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

type CommandCounts = Record<'PENDING' | 'SENT' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED', number>;

function emptyCounts(): CommandCounts {
  return { PENDING: 0, SENT: 0, SUCCEEDED: 0, FAILED: 0, CANCELLED: 0 };
}

export async function getEnrollmentOverview() {
  await linkEnrollmentUsersToEmployees();
  const devices: Device[] = await db.query.biometricDevices.findMany({
    where: eq(biometricDevices.isActive, true),
    orderBy: (table, { asc }) => [asc(table.deviceName)],
  });

  const commandRows = await db
    .select({ deviceId: biometricDeviceCommands.deviceId, status: biometricDeviceCommands.status, count: sql<number>`count(*)::int` })
    .from(biometricDeviceCommands)
    .where(inArray(biometricDeviceCommands.status, ['PENDING', 'SENT', 'FAILED']))
    .groupBy(biometricDeviceCommands.deviceId, biometricDeviceCommands.status);
  // Why commands failed: the device's Return code, or null when it never answered (timed out).
  const failureRows = await db
    .select({
      deviceId: biometricDeviceCommands.deviceId,
      kind: biometricDeviceCommands.kind,
      returnCode: biometricDeviceCommands.returnCode,
      count: sql<number>`count(*)::int`,
    })
    .from(biometricDeviceCommands)
    .where(eq(biometricDeviceCommands.status, 'FAILED'))
    .groupBy(biometricDeviceCommands.deviceId, biometricDeviceCommands.kind, biometricDeviceCommands.returnCode);
  const rosterRows = await db
    .select({ deviceId: biometricDeviceRoster.deviceId, count: sql<number>`count(*)::int` })
    .from(biometricDeviceRoster)
    .groupBy(biometricDeviceRoster.deviceId);

  const [userStats] = await db
    .select({
      users: sql<number>`count(*)::int`,
      linked: sql<number>`count(${biometricDeviceUsers.employeeId})::int`,
    })
    .from(biometricDeviceUsers);
  const templateStats = await db
    .select({ bioType: biometricTemplates.bioType, templates: sql<number>`count(*)::int`, users: sql<number>`count(distinct ${biometricTemplates.deviceUserId})::int` })
    .from(biometricTemplates)
    .groupBy(biometricTemplates.bioType);
  const unmatched = await db
    .select({ pin: biometricDeviceUsers.pin, name: biometricDeviceUsers.name })
    .from(biometricDeviceUsers)
    .where(sql`${biometricDeviceUsers.employeeId} IS NULL`)
    .orderBy(asc(biometricDeviceUsers.pin))
    .limit(500);

  return {
    commandsEnabled: admsCommandsEnabled(),
    autoRemoveOnDeactivate: autoRemoveOnDeactivateEnabled(),
    users: userStats?.users ?? 0,
    linkedUsers: userStats?.linked ?? 0,
    templatesByType: templateStats,
    unmatchedUsers: unmatched,
    devices: devices.map((device) => {
      const counts = emptyCounts();
      for (const row of commandRows) if (row.deviceId === device.id) counts[row.status as keyof CommandCounts] = row.count;
      return {
        id: device.id,
        deviceName: device.deviceName,
        serialNumber: device.serialNumber,
        ipAddress: device.ipAddress,
        isEnrollmentMaster: device.isEnrollmentMaster,
        enrollmentSyncEnabled: device.enrollmentSyncEnabled,
        pushProtocolVersion: device.pushProtocolVersion,
        lastCommandPollAt: device.lastCommandPollAt,
        rosterSize: rosterRows.find((row) => row.deviceId === device.id)?.count ?? 0,
        pendingCommands: counts.PENDING + counts.SENT,
        failedCommands: counts.FAILED,
        failureReasons: failureRows
          .filter((row) => row.deviceId === device.id)
          .map(({ kind, returnCode, count }) => ({ kind, returnCode, count }))
          .sort((a, b) => b.count - a.count),
      };
    }),
  };
}

export async function getSyncRuns(limit = 20) {
  const runs = await db.query.biometricSyncRuns.findMany({
    orderBy: [desc(biometricSyncRuns.createdAt)],
    limit,
  });
  if (runs.length === 0) return [];

  const progress = await db
    .select({
      syncRunId: biometricDeviceCommands.syncRunId,
      deviceId: biometricDeviceCommands.deviceId,
      status: biometricDeviceCommands.status,
      count: sql<number>`count(*)::int`,
    })
    .from(biometricDeviceCommands)
    .where(inArray(biometricDeviceCommands.syncRunId, runs.map((run) => run.id)))
    .groupBy(biometricDeviceCommands.syncRunId, biometricDeviceCommands.deviceId, biometricDeviceCommands.status);

  return runs.map((run) => {
    const byDevice = new Map<string, CommandCounts>();
    for (const row of progress) {
      if (row.syncRunId !== run.id) continue;
      const counts = byDevice.get(row.deviceId) ?? emptyCounts();
      counts[row.status as keyof CommandCounts] = row.count;
      byDevice.set(row.deviceId, counts);
    }
    return {
      ...run,
      devices: [...byDevice.entries()].map(([deviceId, counts]) => ({ deviceId, ...counts })),
    };
  });
}

export async function getEmployeeEnrollment(employeeId: string) {
  const { employee, enrollmentUser } = await getEmployeeEnrollmentUser(employeeId);
  const pin = enrollmentUser?.pin ?? employee.biometricId ?? null;

  const templateCounts = enrollmentUser
    ? await db
      .select({ bioType: biometricTemplates.bioType, count: sql<number>`count(*)::int` })
      .from(biometricTemplates)
      .where(eq(biometricTemplates.deviceUserId, enrollmentUser.id))
      .groupBy(biometricTemplates.bioType)
    : [];

  const currentHash = enrollmentUser
    ? (await loadProvisionableUsers()).find((user) => user.pin === enrollmentUser.pin)?.templatesHash ?? null
    : null;

  const devices = await getSyncDevices();
  const deviceIds = devices.map((device) => device.id);
  const roster = pin && deviceIds.length
    ? await db.select().from(biometricDeviceRoster).where(and(eq(biometricDeviceRoster.pin, pin), inArray(biometricDeviceRoster.deviceId, deviceIds)))
    : [];
  const openCommands = pin && deviceIds.length
    ? await db
      .select({ deviceId: biometricDeviceCommands.deviceId, kind: biometricDeviceCommands.kind, status: biometricDeviceCommands.status })
      .from(biometricDeviceCommands)
      .where(and(eq(biometricDeviceCommands.pin, pin), inArray(biometricDeviceCommands.deviceId, deviceIds), inArray(biometricDeviceCommands.status, ['PENDING', 'SENT', 'FAILED'])))
    : [];
  const exclusions = await db
    .select({ deviceId: biometricDeviceExclusions.deviceId })
    .from(biometricDeviceExclusions)
    .where(eq(biometricDeviceExclusions.employeeId, employeeId));

  return {
    pin,
    enrolled: Boolean(enrollmentUser),
    capturedAt: enrollmentUser?.lastCapturedAt ?? null,
    templatesByType: templateCounts,
    devices: devices.map((device) => {
      const rosterRow = roster.find((row) => row.deviceId === device.id);
      const commands = openCommands.filter((command) => command.deviceId === device.id);
      const pendingKind = commands.find((command) => command.status !== 'FAILED')?.kind ?? null;
      const status = commands.some((command) => command.status === 'FAILED')
        ? 'FAILED'
        : pendingKind === 'USER_DELETE'
          ? 'REMOVING'
          : pendingKind
            ? 'PROVISIONING'
            : !rosterRow
              ? 'ABSENT'
              : rosterRow.templatesHash && rosterRow.templatesHash === currentHash
                ? 'IN_SYNC'
                : 'PRESENT';
      return {
        deviceId: device.id,
        deviceName: device.deviceName,
        isEnrollmentMaster: device.isEnrollmentMaster,
        excluded: exclusions.some((exclusion) => exclusion.deviceId === device.id),
        status,
      };
    }),
  };
}
