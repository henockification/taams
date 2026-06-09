import { z } from 'zod';

// User schema for validation
export const UserSchema = z.object({
  id: z.string().openapi({ example: 'user_123' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  email: z.string().email().openapi({ example: 'john@example.com' }),
  emailVerified: z.boolean().nullable().openapi({ example: false }),
  role: z.array(z.string()).openapi({ example: ['user'] }),
  roles: z.array(z.string()).optional().openapi({ example: ['admin'] }),
  createdAt: z.string().openapi({ example: '2023-01-01T00:00:00.000Z' }),
});

// Extended user schema for single user response (includes additional fields)
export const UserDetailSchema = z.object({
  id: z.string().openapi({ example: 'user_123' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  email: z.string().email().openapi({ example: 'john@example.com' }),
  emailVerified: z.boolean().nullable().openapi({ example: false }),
  role: z.array(z.string()).openapi({ example: ['user'] }),
  roles: z.array(z.string()).optional().openapi({ example: ['admin'] }),
  createdAt: z.string().openapi({ example: '2023-01-01T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2023-01-01T00:00:00.000Z' }),
  image: z.string().nullable().openapi({ example: 'https://example.com/avatar.jpg' }),
});

// Pagination schema
export const PaginationSchema = z.object({
  total: z.number().openapi({ example: 100 }),
  page: z.number().openapi({ example: 1 }),
  pageSize: z.number().openapi({ example: 20 }),
});

// Response schemas
export const UsersResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  users: z.array(UserSchema),
  pagination: PaginationSchema,
});

export const UserResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  user: UserDetailSchema,
});

export const CreateUserRequestSchema = z.object({
  name: z.string().min(1).openapi({ example: 'John Doe' }),
  email: z.string().email().openapi({ example: 'john@example.com' }),
  emailVerified: z.boolean().optional().openapi({ example: false }),
  image: z.string().url().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
  roleIds: z.array(z.string().uuid()).optional().openapi({
    example: ['a52da4a6-4b69-4aa0-865c-1a03fddb731f'],
    description: 'Role ids to assign after user creation',
  }),
});

export const UpdateUserRequestSchema = z.object({
  name: z.string().min(1).optional().openapi({ example: 'Jane Doe' }),
  email: z.string().email().optional().openapi({ example: 'jane@example.com' }),
  emailVerified: z.boolean().optional().openapi({ example: true }),
  image: z.string().url().nullable().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
  roleIds: z.array(z.string().uuid()).optional().openapi({
    example: ['a52da4a6-4b69-4aa0-865c-1a03fddb731f'],
    description: 'Replace all assigned roles for the user',
  }),
});

export const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Failed to fetch users' }),
  details: z.string().optional().openapi({ example: 'Database connection error' }),
});

export const UserProfileUpdateSchema = z.object({
  name: z.string()
});

export const UserProfileUpdateResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  profile: z.object({
    name: z.string().openapi({ example: 'John Doe' }),
  }),
  message: z.string().openapi({ example: 'Profile updated successfully' }),
});

export const UpdateProfileImageSchema = z.object({
  imageUrl: z.string().url().openapi({ 
    example: 'https://your-bucket.r2.dev/tenant123/avatars/image-123456.jpg',
    description: 'The URL of the uploaded profile image'
  }),
});

export const UpdateProfileImageResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Profile image updated successfully' }),
  imageUrl: z.string().url().openapi({ example: 'https://your-bucket.r2.dev/tenant123/avatars/image-123456.jpg' }),
});
