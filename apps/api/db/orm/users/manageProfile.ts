import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../db';
import { employees, user } from '../../schema';
import { normalizeLoginPhone } from '../../../lib/login-identifier';
import { diffChanges, employeeAuditFields, formatEmployeeLabel, writeAuditEvent } from '../../../lib/audit';

type DbClient = typeof db | any;

export type UpdateOwnProfileInput = {
  firstNameEn: string;
  middleNameEn?: string | null;
  lastNameEn: string;
  firstNameAm?: string | null;
  middleNameAm?: string | null;
  lastNameAm?: string | null;
  phoneNumber: string;
};

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function displayName(input: Pick<UpdateOwnProfileInput, 'firstNameEn' | 'middleNameEn' | 'lastNameEn'>) {
  return [input.firstNameEn, input.middleNameEn, input.lastNameEn]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

export async function getOwnProfile(userId: string, tx: DbClient = db) {
  const foundUser = await tx.query.user.findFirst({
    where: eq(user.id, userId),
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
    },
  });
  if (!foundUser) throw new Error('User not found');

  const employee = await tx.query.employees.findFirst({
    where: eq(employees.userId, userId),
    with: {
      department: true,
      position: true,
    },
  });

  return { user: foundUser, employee: employee ?? null };
}

export async function updateOwnProfile(userId: string, input: UpdateOwnProfileInput) {
  const normalizedPhone = normalizeLoginPhone(input.phoneNumber);
  if (!normalizedPhone) throw new Error('Invalid phone number');

  const updateData = {
    firstNameEn: input.firstNameEn.trim(),
    middleNameEn: cleanOptional(input.middleNameEn),
    lastNameEn: input.lastNameEn.trim(),
    firstNameAm: cleanOptional(input.firstNameAm),
    middleNameAm: cleanOptional(input.middleNameAm),
    lastNameAm: cleanOptional(input.lastNameAm),
    phoneNumber: normalizedPhone,
  };

  return db.transaction(async (tx) => {
    const profile = await getOwnProfile(userId, tx);
    if (!profile.employee) throw new Error('No employee profile is linked to this user');

    const phoneOwner = await tx.query.user.findFirst({
      where: and(eq(user.phone, normalizedPhone), ne(user.id, userId)),
      columns: { id: true },
    });
    if (phoneOwner) throw new Error('That phone number is already used by another user account');

    await tx.update(employees)
      .set({ ...updateData, updatedAt: new Date() } as any)
      .where(eq(employees.id, profile.employee.id));

    await tx.update(user)
      .set({
        name: displayName(updateData),
        phone: normalizedPhone,
        updatedAt: new Date(),
      } as any)
      .where(eq(user.id, userId));

    const updatedProfile = await getOwnProfile(userId, tx);
    await writeAuditEvent(tx, {
      action: 'EMPLOYEE_UPDATED',
      resourceType: 'employee',
      resourceId: updatedProfile.employee?.id,
      resourceLabel: formatEmployeeLabel(updatedProfile.employee),
      ...employeeAuditFields(updatedProfile.employee),
      changes: diffChanges(profile.employee, updateData),
    });

    return updatedProfile;
  });
}
