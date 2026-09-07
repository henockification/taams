import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { user } from '../../schema';
import { assertUserHasLoginIdentifier, normalizeLoginEmail, normalizeLoginPhone } from '../../../lib/login-identifier';

type DbClient = typeof db | any;

export async function syncLinkedUserContact(
  userId: string,
  input: { email?: string | null; phoneNumber?: string | null },
  tx: DbClient = db,
) {
  const email = input.email === undefined
    ? undefined
    : normalizeLoginEmail(input.email);

  let phone: string | null | undefined;
  if (input.phoneNumber === undefined) {
    phone = undefined;
  } else if (input.phoneNumber === null || input.phoneNumber.trim() === '') {
    phone = null;
  } else {
    phone = normalizeLoginPhone(input.phoneNumber);
    if (!phone) {
      phone = undefined;
    }
  }

  if (email === undefined && phone === undefined) return;

  const current = await tx.query.user.findFirst({
    where: eq(user.id, userId),
  });
  if (!current) return;

  const nextEmail = email !== undefined ? email : current.email;
  const nextPhone = phone !== undefined ? phone : current.phone;
  assertUserHasLoginIdentifier(nextEmail, nextPhone);

  if (nextEmail) {
    const other = await tx.query.user.findFirst({
      where: and(eq(user.email, nextEmail), ne(user.id, userId)),
      columns: { id: true },
    });
    if (other) throw new Error('That email is already used by another user account');
  }

  if (nextPhone) {
    const other = await tx.query.user.findFirst({
      where: and(eq(user.phone, nextPhone), ne(user.id, userId)),
      columns: { id: true },
    });
    if (other) throw new Error('That phone number is already used by another user account');
  }

  await tx.update(user).set({
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    updatedAt: new Date(),
  }).where(eq(user.id, userId));
}
