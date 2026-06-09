import { 
  User, 
  UserFilters, 
  UsersResponse,
  SignUpInput,
  SignUpResponse,
} from '../types/api';
import { PaginationParams } from '../shared/types';
import { UpdateProfileImageRequest, UpdateProfileImageResponse, UserProfileUpdate } from '../types/users.types';
import { apiClient } from '../utils/api-client';

// API endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012';

// Users API functions using native fetch (no complex client needed)
export const usersApi = {
  // Get all users with pagination and filters
  getUsers: async (
    filters: UserFilters = {},
    pagination: PaginationParams = {}
  ): Promise<UsersResponse> => {
    const params = new URLSearchParams({
      page: String(pagination.page || 1),
      pageSize: String(pagination.pageSize || 10),
      ...Object.entries(filters).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>),
    });

    const response = await fetch(
      `${API_BASE_URL}/api/users?${params.toString()}`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  // Get user by ID
  getUserById: async (id: string): Promise<User> => {
    const response = await fetch(
      `${API_BASE_URL}/api/users/${id}`,
      {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.user || data; // Handle different response formats
  },

  // Sign up a new user and create customer
  signup: async (input: SignUpInput): Promise<SignUpResponse> => {
    const response = await fetch(
      `${API_BASE_URL}/api/users/signup`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }
    );

    const data: SignUpResponse = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  },

  updateProfile: async (profile: UserProfileUpdate): Promise<UserProfileUpdate> => {
    const response = await apiClient.patch('/api/profile', profile);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.profile || data;
  },

  updateProfileImage: async (imageData: UpdateProfileImageRequest): Promise<UpdateProfileImageResponse> => {
    const response = await apiClient.patch('/api/profile/image', imageData);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
};
