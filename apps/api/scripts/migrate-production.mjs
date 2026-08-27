import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run database migrations');
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(scriptDirectory, '../drizzle');
const migrationLockId = 1_413_567_009;
const legacyBaselineIdx = Number(process.env.TAAMS_DRIZZLE_LEGACY_BASELINE_IDX ?? 22);
const client = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
});

let lockAcquired = false;

function readJournal() {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  return JSON.parse(fs.readFileSync(journalPath, 'utf8'));
}

function getMigrationHash(tag) {
  const migrationSql = fs.readFileSync(path.join(migrationsFolder, `${tag}.sql`), 'utf8');
  return crypto.createHash('sha256').update(migrationSql).digest('hex');
}

async function ensureMigrationTable() {
  await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await client`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
}

async function getCurrentMigrationTimestamp() {
  const [currentMigration] = await client`
    SELECT max(created_at)::bigint AS created_at FROM drizzle.__drizzle_migrations
  `;

  return currentMigration.created_at === null ? null : Number(currentMigration.created_at);
}

async function shouldBaselineLegacyMigrations(currentMigrationTimestamp) {
  const journal = readJournal();
  const baselineEntry = journal.entries.find((entry) => entry.idx === legacyBaselineIdx);

  if (!baselineEntry) {
    throw new Error(`No Drizzle migration found for baseline idx ${legacyBaselineIdx}`);
  }

  if (currentMigrationTimestamp !== null && currentMigrationTimestamp >= baselineEntry.when) {
    return false;
  }

  const existingSchema = await client`
    SELECT
      to_regclass('public.user') IS NOT NULL AS has_user,
      to_regclass('public.employees') IS NOT NULL AS has_employees,
      to_regclass('public.leave_requests') IS NOT NULL AS has_leave_requests,
      to_regclass('public.attendance_daily_records') IS NOT NULL AS has_attendance_daily_records
  `;
  const schema = existingSchema[0];

  return Boolean(
    schema.has_user
      && schema.has_employees
      && schema.has_leave_requests
      && schema.has_attendance_daily_records,
  );
}

async function baselineLegacyMigrations() {
  if (!Number.isInteger(legacyBaselineIdx) || legacyBaselineIdx < 0) {
    throw new Error(`Invalid TAAMS_DRIZZLE_LEGACY_BASELINE_IDX: ${process.env.TAAMS_DRIZZLE_LEGACY_BASELINE_IDX}`);
  }

  const journal = readJournal();
  const currentMigrationTimestamp = await getCurrentMigrationTimestamp();
  const baselineEntries = journal.entries.filter((entry) => (
    entry.idx <= legacyBaselineIdx
      && (currentMigrationTimestamp === null || entry.when > currentMigrationTimestamp)
  ));

  if (baselineEntries.length === 0) {
    return;
  }

  console.log(
    `Existing Tams schema detected with incomplete Drizzle history; marking migrations through idx ${legacyBaselineIdx} as already applied`,
  );

  for (const entry of baselineEntries) {
    await client`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${getMigrationHash(entry.tag)}, ${entry.when})
    `;
  }
}

try {
  console.log(`Applying database migrations from ${migrationsFolder}`);
  await client`select pg_advisory_lock(${migrationLockId})`;
  lockAcquired = true;
  await ensureMigrationTable();

  const currentMigrationTimestamp = await getCurrentMigrationTimestamp();
  if (await shouldBaselineLegacyMigrations(currentMigrationTimestamp)) {
    await baselineLegacyMigrations();
  }

  await migrate(drizzle(client), { migrationsFolder });
  console.log('Database migrations completed');
} finally {
  try {
    if (lockAcquired) {
      await client`select pg_advisory_unlock(${migrationLockId})`;
    }
  } finally {
    await client.end();
  }
}
