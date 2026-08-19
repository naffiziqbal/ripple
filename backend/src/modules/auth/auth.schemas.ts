import { z } from 'zod';

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters: letters, numbers, underscore'),
  email: z.string().trim().toLowerCase().email('A valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const loginSchema = z.object({
  /** Username or email address. */
  identifier: z.string().trim().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  /** Username or email address. */
  identifier: z.string().trim().min(1, 'Username or email is required'),
});

export const verifyOtpSchema = z.object({
  identifier: z.string().trim().min(1, 'Username or email is required'),
  otp: z.string().trim().regex(/^\d{6}$/, 'The code is 6 digits'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const deviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
