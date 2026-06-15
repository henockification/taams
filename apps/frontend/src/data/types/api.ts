// Simple TypeScript types - trusting the API response
export type UserRole = 'admin' | 'user' | 'moderator';
export type UserStatus = 'active' | 'inactive' | 'pending' | 'suspended';

export interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean | null;
  role: string[];
  createdAt: string;
  updatedAt?: string;
  lastActiveAt?: string;
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  createdAfter?: string;
  createdBefore?: string;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  roleIds?: string[];
}

export interface CreateUserResponse {
  success: boolean;
  user: User;
}

export interface SignUpResponse {
  success: boolean;
  user?: {
    userId: string;
    customerId: string;
    customerCode: string;
  };
  error?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// Simple query keys factory
export const userQueryKeys = {
  all: ['users'] as const,
  lists: () => [...userQueryKeys.all, 'list'] as const,
  list: (filters: UserFilters) => [...userQueryKeys.lists(), filters] as const,
  details: () => [...userQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...userQueryKeys.details(), id] as const,
  signups: () => [...userQueryKeys.all, 'signup'] as const,
};
