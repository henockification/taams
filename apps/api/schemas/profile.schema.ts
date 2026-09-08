import { z } from '@hono/zod-openapi';
import { EmployeeSchema } from './core.schema';
import { UserResponseSchema } from './users.schema';

export const UpdateProfileRequestSchema = z.object({
  firstNameEn: z.string().trim().min(1).max(100),
  middleNameEn: z.string().trim().max(100).nullable().optional(),
  lastNameEn: z.string().trim().min(1).max(100),
  firstNameAm: z.string().trim().max(100).nullable().optional(),
  middleNameAm: z.string().trim().max(100).nullable().optional(),
  lastNameAm: z.string().trim().max(100).nullable().optional(),
  phoneNumber: z.string().trim().min(1).max(50),
});

export const ProfileResponseSchema = z.object({
  success: z.boolean(),
  user: UserResponseSchema.shape.user,
  employee: EmployeeSchema.nullable(),
});
