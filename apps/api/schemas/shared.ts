import { z } from '@hono/zod-openapi';

// System schemas
export const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  message: z.string().openapi({ example: 'Cool Agent API is running' }),
  timestamp: z.string().openapi({ example: '2025-08-30T13:00:00.000Z' }),
});

export const ApiResponseSchema = z.object({
  message: z.string().openapi({ example: 'Welcome to Cool Agent API' }),
});

export const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Something went wrong' }),
});



// Auth schemas
export const SignUpRequestSchema = z.object({
  firstName: z.string().openapi({ example: 'John' }),
  lastName: z.string().openapi({ example: 'Doe' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().min(6).openapi({ example: 'password123' }),
  captchaToken: z.string().optional().openapi({ example: 'captcha-token' }),
});

export const SignInRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().openapi({ example: 'password123' }),
});

export const AuthResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Authentication successful' }),
  user: z.object({
    id: z.string().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().optional().openapi({ example: 'John Doe' }),
  }).optional(),
  session: z.object({
    id: z.string().openapi({ example: 'session-id' }),
    expiresAt: z.string().openapi({ example: '2025-09-30T12:00:00.000Z' }),
  }).optional(),
});

export const SessionResponseSchema = z.object({
  user: z.object({
    id: z.string().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().optional().openapi({ example: 'John Doe' }),
  }).optional(),
  session: z.object({
    id: z.string().openapi({ example: 'session-id' }),
    expiresAt: z.string().openapi({ example: '2025-09-30T12:00:00.000Z' }),
  }).optional(),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string().openapi({ example: 'reset-token' }),
  password: z.string().min(6).openapi({ example: 'newpassword123' }),
});

// Protected route schemas
export const UserProfileSchema = z.object({
  id: z.string().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().openapi({ example: 'John Doe' }),
  emailVerified: z.boolean().openapi({ example: true }),
  role: z.array(z.string()).default(['user']).openapi({ example: ['user'] }),
  createdAt: z.string().openapi({ example: '2025-08-30T12:55:12.760Z' }),
});

export const ProfileResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  user: UserProfileSchema,
});

export const PostSchema = z.object({
  id: z.string().openapi({ example: 'post-id' }),
  title: z.string().openapi({ example: 'Sample Post' }),
  content: z.string().openapi({ example: 'This is a sample post content.' }),
  authorId: z.string().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  createdAt: z.string().openapi({ example: '2025-08-30T12:55:12.760Z' }),
});

export const PostsResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  posts: z.array(PostSchema),
});

export const AuthErrorSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Authentication required' }),
});
