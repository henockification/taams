import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureIfmisAttendanceTable, pushIfmisAttendanceRows } from './oracle';
import type { IfmisAttendanceRow } from './attendance';

setOracleEnv();

test('Oracle setup creates missing table and index, and is idempotent when both exist', async () => {
  const statements: string[] = [];
  const missingConnection = fakeConnection(async (sql) => {
    statements.push(sql);
    if (sql.includes('USER_TABLES') || sql.includes('USER_INDEXES')) return { rows: [] };
    return {};
  });
  const created = await ensureIfmisAttendanceTable(missingConnection as never);
  assert.equal(created.created, true);
  assert.ok(statements.some((sql) => sql.includes('CREATE TABLE TAMS_ATTENDANCE')));
  assert.ok(statements.some((sql) => sql.includes('CREATE UNIQUE INDEX')));

  const existingStatements: string[] = [];
  const existingConnection = fakeConnection(async (sql) => {
    existingStatements.push(sql);
    if (sql.includes('USER_TABLES')) return { rows: [{ TABLE_NAME: 'TAMS_ATTENDANCE' }] };
    if (sql.includes('USER_INDEXES')) return { rows: [{ INDEX_NAME: 'UX_TAMS_ATTENDANCE_PERIOD_NAME' }] };
    return {};
  });
  const existing = await ensureIfmisAttendanceTable(existingConnection as never);
  assert.equal(existing.created, false);
  assert.equal(existingStatements.some((sql) => sql.includes('CREATE TABLE')), false);
});

test('Oracle push commits complete executeMany success', async () => {
  const state = { committed: false, rolledBack: false, closed: false };
  const connection = {
    executeMany: async () => ({ rowsAffected: 1 }),
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; },
    close: async () => { state.closed = true; },
  };
  await pushIfmisAttendanceRows([row()], { getConnection: async () => connection as never });
  assert.deepEqual(state, { committed: true, rolledBack: false, closed: true });
});

test('Oracle push rolls back and closes on bulk failure', async () => {
  const state = { committed: false, rolledBack: false, closed: false };
  const connection = {
    executeMany: async () => { throw new Error('database detail'); },
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; },
    close: async () => { state.closed = true; },
  };
  await assert.rejects(() => pushIfmisAttendanceRows([row()], { getConnection: async () => connection as never }));
  assert.deepEqual(state, { committed: false, rolledBack: true, closed: true });
});

function fakeConnection(execute: (sql: string) => Promise<any>) {
  return { execute, commit: async () => undefined, close: async () => undefined };
}

function setOracleEnv() {
  process.env.IFMIS_ORACLE_USERNAME = 'test';
  process.env.IFMIS_ORACLE_PASSWORD = 'test';
  process.env.IFMIS_ORACLE_HOST = '127.0.0.1';
  process.env.IFMIS_ORACLE_PORT = '1521';
  process.env.IFMIS_ORACLE_SERVICE_NAME = 'test';
  process.env.IFMIS_ORACLE_TABLE = 'TAMS_ATTENDANCE';
}

function row(): IfmisAttendanceRow {
  return {
    employeeId: 'employee-1', ifmisNo: null, nationalId: null, orgId: null,
    firstName: 'Hana', fatherName: 'Bekele', grandName: 'Abebe',
    firstNameAmharic: 'ሀና', fatherNameAmharic: 'በቀለ', grandNameAmharic: 'አበበ',
    absenteeism: 0, late: 0.1, currentStatus: 'ACTIVE', approved: 'YES', payMonth: 8, payYear: 2026,
  };
}
