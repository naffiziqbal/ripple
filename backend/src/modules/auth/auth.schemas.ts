import { z } from 'zod';

export const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters: letters, numbers, underscore'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const deviceTokenSchema = z.object({
  token: z.string().min(1, 'Device token is required'),
});

export type Credentials = z.infer<typeof credentialsSchema>;
