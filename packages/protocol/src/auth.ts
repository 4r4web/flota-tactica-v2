import { z } from 'zod';

export const RegisterRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  displayName: z.string().min(1).max(32),
});

export const LoginRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const RefreshRequest = z.object({
  refreshToken: z.string().min(1),
});

export const LogoutRequest = z.object({
  refreshToken: z.string().min(1),
});

export const UpdateProfileRequest = z.object({
  displayName: z.string().min(1).max(32),
});

export const UserProfile = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  createdAt: z.string(),
});

export const AuthResponse = z.object({
  user: UserProfile,
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type RegisterRequest = z.infer<typeof RegisterRequest>;
export type LoginRequest = z.infer<typeof LoginRequest>;
export type RefreshRequest = z.infer<typeof RefreshRequest>;
export type LogoutRequest = z.infer<typeof LogoutRequest>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;
export type UserProfile = z.infer<typeof UserProfile>;
export type AuthResponse = z.infer<typeof AuthResponse>;
export type TokenResponse = z.infer<typeof TokenResponse>;
