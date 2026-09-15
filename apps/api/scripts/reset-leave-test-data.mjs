import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

export const leaveTables = [
  'leave_balance_transactions',
  'leave_interruption_dates',
  'leave_interruptions',
  'annual_leave_request_dates',
  'leave_requests',
  'leave_balances',
];
export const preservedTables = ['employees', 'user', 'leave_fiscal_years', 'leave_types', 'attendance_daily_records', 'audit_events'];

async function counts(sql) {
  const result = {};
  for (const table of [...leaveTables, ...preservedTables]) {
    const [row] = await sql.unsafe(`SELECT count(*)::int AS count FROM "${table}"`);
    result[table] = row.count;
  }
  const [permission] = await sql`SELECT count(*)::int AS count FROM permissions WHERE resource = 'leave-transfer' OR name = 'leave-transfer:read'`;
  const [assignments] = await sql`SELECT count(*)::int AS count FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'leave-transfer' OR name = 'leave-transfer:read')`;
  result.transferPermissions = permission.count;
  result.transferPermissionAssignments = assignments.count;
  return result;
}

export async function resetLeaveTestData(sql, { apply = false, rollbackTest = false } = {}) {
  let report;
  const rollback = new Error('Intentional cleanup verification rollback');
  try {
    return await sql.begin(async (tx) => {
      await tx.unsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      if (apply || rollbackTest) {
        await tx.unsafe(`LOCK TABLE ${[...leaveTables, 'permissions', 'role_permissions'].map((table) => `"${table}"`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
      }
      const before = await counts(tx);
      if (!apply && !rollbackTest) return { applied: false, before };
      for (const table of leaveTables) await tx.unsafe(`DELETE FROM "${table}"`);
      await tx`DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE resource = 'leave-transfer' OR name = 'leave-transfer:read')`;
      await tx`DELETE FROM permissions WHERE resource = 'leave-transfer' OR name = 'leave-transfer:read'`;
      const after = await counts(tx);
      for (const table of leaveTables) {
        if (after[table] !== 0) throw new Error(`Cleanup did not empty ${table}`);
      }
      for (const table of preservedTables) {
        if (before[table] !== after[table]) throw new Error(`Cleanup changed preserved table ${table}`);
      }
      if (after.transferPermissions || after.transferPermissionAssignments) throw new Error('Transfer permissions remain');
      report = { applied: apply, rolledBack: rollbackTest, before, after };
      if (rollbackTest) throw rollback;
      return report;
    });
  } catch (error) {
    if (error === rollback) return report;
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--apply', '--rollback-test'].includes(arg)) || (args.includes('--apply') && args.includes('--rollback-test'))) {
    throw new Error('Usage: node scripts/reset-leave-test-data.mjs [--apply | --rollback-test]');
  }
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const target = new URL(process.env.DATABASE_URL);
  console.log(JSON.stringify({ host: target.hostname, database: target.pathname.slice(1) }));
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 10 });
  try {
    const report = await resetLeaveTestData(sql, { apply: args.includes('--apply'), rollbackTest: args.includes('--rollback-test') });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    // Avoid logging connection strings or database payloads.
    console.error('Leave test-data cleanup failed:', error.code || error.message);
    process.exitCode = 1;
  });
}
