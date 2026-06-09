import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';
import type { UserFilters, SignUpInput } from '../types/api';
import type { PaginationParams } from '../shared/types';
import { userQueryKeys } from '../types/api';
import { UpdateProfileImageRequest, UserProfileUpdate } from '../types/users.types';

// Get all users with pagination and filters
export const useUsers = (
  filters: UserFilters = {},
  pagination: PaginationParams = {}
) => {
  return useQuery({
    queryKey: userQueryKeys.list({ ...filters, ...pagination }),
    queryFn: () => usersApi.getUsers(filters, pagination),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Get user by ID
export const useUser = (id: string) => {
  return useQuery({
    queryKey: userQueryKeys.detail(id),
    queryFn: () => usersApi.getUserById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Sign up a new user and create customer
export const useSignup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignUpInput) => usersApi.signup(input),
    onSuccess: () => {
      // Invalidate users list queries to reflect new user
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      // Also invalidate customers list since signup creates a customer
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: (profile: UserProfileUpdate) => usersApi.updateProfile(profile),
  });
};

// Update user profile image
export const useUpdateProfileImage = () => {
  return useMutation({
    mutationFn: (imageData: UpdateProfileImageRequest) => usersApi.updateProfileImage(imageData),
  });
};