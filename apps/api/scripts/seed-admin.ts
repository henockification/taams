/**
 * Create or update an Admin account (production runs without Super admins).
 * Run `npm run db:seed-system-roles` first so the admin role exists.
 *
 *   ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD=... npm run db:seed-admin
 *
 * Re-running for the same email resets that account's password and unlocks it.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { authCredentials, roles, user, userRoles } from '../db/schema';
import { hashPassword } from '../lib/password';
import { assertPasswordPolicy } from '../lib/password-policy';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const connectionString = requireEnv('DATABASE_URL');
  const email = requireEnv('ADMIN_EMAIL').toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  const password = requireEnv('ADMIN_PASSWORD');
  assertPasswordPolicy(password, email);

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });
  try {
    const adminRole = await db.query.roles.findFirst({ where: eq(roles.name, 'admin') });
    if (!adminRole) throw new Error('The admin role does not exist. Run npm run db:seed-system-roles first.');
    const passwordHash = await hashPassword(password);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.user.findFirst({ where: eq(user.email, email) });
      const userId = existing?.id ?? `user_${randomUUID()}`;
      if (existing) {
        const roleNames = [...new Set([...(existing.role ?? []).filter((role) => role !== 'user'), 'admin'])];
        await tx.update(user)
          .set({ name, role: roleNames, emailVerified: true, failedLoginCount: 0, lockedUntil: null, updatedAt: now })
          .where(eq(user.id, userId));
      } else {
        await tx.insert(user).values({ id: userId, name, email, emailVerified: true, role: ['admin'], createdAt: now, updatedAt: now });
      }
      await tx.insert(authCredentials).values({ userId, passwordHash, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({ target: authCredentials.userId, set: { passwordHash, updatedAt: now } });
      await tx.insert(userRoles).values({ userId, roleId: adminRole.id, createdAt: now }).onConflictDoNothing();
      return { userId, created: !existing };
    });

    console.log(`${result.created ? 'Created' : 'Updated'} admin account ${email} (${result.userId})`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
