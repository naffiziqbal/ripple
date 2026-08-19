import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgres://ripple:ripple@localhost:5433/ripple'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FIREBASE_SERVICE_ACCOUNT: z
    .string()
    .default(path.join(__dirname, '..', 'firebase-service-account.json')),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';
