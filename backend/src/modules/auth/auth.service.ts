import bcrypt from 'bcryptjs';
import { getPool } from '../../db';
import { ApiError } from '../../lib/errors';
import { signToken } from '../../middleware/auth';
import type { UserDto, UserRow } from '../../types';
import type { Credentials } from './auth.schemas';

interface AuthResult {
  token: string;
  user: UserDto;
}

export function toUserDto(row: UserRow): UserDto {
  return { id: row.id, username: row.username, createdAt: row.created_at.toISOString() };
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>(
    'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0];
}

export async function signup({ username, password }: Credentials): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(password, 10);

  // Rely on the unique index rather than a check-then-insert race.
  let user: UserRow;
  try {
    const { rows } = await getPool().query<UserRow>(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
      [username, passwordHash]
    );
    user = rows[0]!;
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === '23505') {
      throw ApiError.conflict('Username already taken');
    }
    throw err;
  }

  return { token: signToken({ id: user.id, username: user.username }), user: toUserDto(user) };
}

export async function login({ username, password }: Credentials): Promise<AuthResult> {
  const user = await findUserByUsername(username);
  // Compare against a dummy hash on unknown users to keep timing uniform.
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid username or password');
  }
  return { token: signToken({ id: user.id, username: user.username }), user: toUserDto(user) };
}

export async function saveDeviceToken(userId: number, token: string): Promise<void> {
  await getPool().query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, userId]);
}
