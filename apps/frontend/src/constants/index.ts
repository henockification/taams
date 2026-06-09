// App constants
export const APP_NAME = 'Taams';
export const APP_VERSION = '1.0.0';

// API constants
export const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3009';

// Theme constants
export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME = 'system';

// Auth constants
export const AUTH_ROUTES = {
  SIGN_IN: '/auth/signin',
  SIGN_UP: '/auth/signup',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  USERS: '/users',
  ...AUTH_ROUTES,
} as const;

