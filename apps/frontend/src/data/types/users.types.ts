import type { User } from './api';
import type { Employee } from './core.types';

export type UserProfileUpdate = {
  firstNameEn: string;
  middleNameEn?: string | null;
  lastNameEn: string;
  firstNameAm?: string | null;
  middleNameAm?: string | null;
  lastNameAm?: string | null;
  phoneNumber: string;
};

export type UserProfileResponse = {
  success: boolean;
  user: User;
  employee: Employee | null;
};

export type UpdateProfileImageRequest = {
  imageUrl: string;
};

export type UpdateProfileImageResponse = {
  success: boolean;
  message: string;
  imageUrl: string;
};
