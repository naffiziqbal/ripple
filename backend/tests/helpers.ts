import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { closeDb, getPool } from '../src/db';
import { migrate } from '../src/db/migrate';

/** Migrate once per file, wipe all tables before each test, close the pool after. */
export function useTestDb(): void {
  beforeAll(async () => {
    await migrate(getPool());
  });

  beforeEach(async () => {
    await getPool().query('TRUNCATE users, posts, likes, comments RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await closeDb();
  });
}

export async function signupUser(
  app: Express,
  username: string,
  password = 'password123'
): Promise<{ token: string; user: { id: number; username: string } }> {
  const res = await request(app).post('/auth/signup').send({ username, password });
  if (res.status !== 201) {
    throw new Error(`signup failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
