import path from 'node:path';
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
const client = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 30,
});

let lockAcquired = false;

try {
  console.log(`Applying database migrations from ${migrationsFolder}`);
  await client`select pg_advisory_lock(${migrationLockId})`;
  lockAcquired = true;
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
