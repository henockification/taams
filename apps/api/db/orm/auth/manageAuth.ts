import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../../db';
import { authCredentials, authSessions, authVerificationTokens, user } from '../../schema';
import { generateOtpCode, hashOtp, OTP_TTL_MINUTES, OtpPurpose, verifyOtp } from '../../../lib/otp';
import { hashPassword, runDummyPasswordHash, verifyPassword } from '../../../lib/password';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const OTP_MAX_ATTEMPTS = 5;

export type AuthUser = typeof user.$inferSelect;
export type AuthSession = typeof authSessions.$inferSelect;

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

export function getSessionExpiry() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export async function findUserByEmail(email: string) {
  return db.query.user.findFirst({
    where: eq(user.email, email.toLowerCase()),
  });
}

export async function createOtpVerification(identifier: string, purpose: OtpPurpose) {
  const normalizedIdentifier = identifier.toLowerCase();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const verification = await db.transaction(async (tx) => {
    await tx.update(authVerificationTokens).set({
      consumedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(authVerificationTokens.identifier, normalizedIdentifier),
      eq(authVerificationTokens.purpose, purpose),
      isNull(authVerificationTokens.consumedAt),
    ));

    const [created] = await tx.insert(authVerificationTokens).values({
      purpose,
      identifier: normalizedIdentifier,
      tokenHash: hashOtp(code),
      expiresAt,
    }).returning();
    return created;
  });

  return { verification, code };
}

export function createPasswordResetVerification(email: string) {
  return createOtpVerification(email, 'password-reset');
}

export async function verifyOtpForPurpose(identifier: string, purpose: OtpPurpose, code: string) {
  const latest = await db.query.authVerificationTokens.findFirst({
    where: and(
      eq(authVerificationTokens.identifier, identifier.toLowerCase()),
      eq(authVerificationTokens.purpose, purpose),
      isNull(authVerificationTokens.consumedAt)
    ),
    orderBy: [desc(authVerificationTokens.createdAt)],
  });

  if (!latest) {
    return { success: false as const, code: 'INVALID_OTP' };
  }

  if (latest.expiresAt < new Date()) {
    return { success: false as const, code: 'OTP_EXPIRED' };
  }

  if (latest.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false as const, code: 'TOO_MANY_ATTEMPTS' };
  }

  if (!/^\d{6}$/.test(code) || !verifyOtp(code, latest.tokenHash)) {
    await db
      .update(authVerificationTokens)
      .set({ attempts: latest.attempts + 1, updatedAt: new Date() })
      .where(eq(authVerificationTokens.id, latest.id));

    return { success: false as const, code: 'INVALID_OTP' };
  }

  await db
    .update(authVerificationTokens)
    .set({ consumedAt: new Date(), updatedAt: new Date() })
    .where(eq(authVerificationTokens.id, latest.id));

  return { success: true as const };
}

export async function setUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db
    .insert(authCredentials)
    .values({
      userId,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: authCredentials.userId,
      set: {
        passwordHash,
        updatedAt: now,
      },
    });
}

export async function revokeUserSessions(userId: string) {
  await db.delete(authSessions).where(eq(authSessions.userId, userId));
}

export async function authenticateEmailPassword(email: string, password: string) {
  const foundUser = await findUserByEmail(email);

  if (!foundUser) {
    await runDummyPasswordHash(password);
    return { success: false as const, reason: 'INVALID_CREDENTIALS' };
  }

  const credential = await db.query.authCredentials.findFirst({
    where: eq(authCredentials.userId, foundUser.id),
  });

  if (!credential) {
    await runDummyPasswordHash(password);
    return { success: false as const, reason: 'PASSWORD_NOT_SET', user: foundUser };
  }

  const validPassword = await verifyPassword(password, credential.passwordHash);

  if (!validPassword) {
    return { success: false as const, reason: 'INVALID_CREDENTIALS' };
  }

  return { success: true as const, user: foundUser };
}

export async function createSessionForUser({
  userId,
  ipAddress,
  userAgent,
}: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const [session] = await db
    .insert(authSessions)
    .values({
      token: createSessionToken(),
      userId,
      expiresAt: getSessionExpiry(),
      ipAddress,
      userAgent,
    })
    .returning();

  return session;
}

export async function getSessionByToken(token: string) {
  const result = await db.query.authSessions.findFirst({
    where: eq(authSessions.token, token),
    with: {
      user: true,
    },
  });

  if (!result || result.expiresAt < new Date()) {
    if (result) {
      await deleteSessionByToken(token);
    }
    return null;
  }

  return result;
}

export async function deleteSessionByToken(token: string) {
  await db.delete(authSessions).where(eq(authSessions.token, token));
}
