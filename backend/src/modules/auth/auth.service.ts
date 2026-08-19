import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { config } from '../../config';
import { getPool } from '../../db';
import { ApiError } from '../../lib/errors';
import { signToken } from '../../middleware/auth';
import type { UserDto, UserRow } from '../../types';
import type { Credentials } from './auth.schemas';

interface AuthResult {
  token: string;
  refreshToken: string;
  user: UserDto;
}

interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
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

function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Access JWT (short-lived) + opaque refresh token (long-lived, hash stored). */
async function issueTokenPair(user: UserRow): Promise<{ token: string; refreshToken: string }> {
  const refreshToken = randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await getPool().query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hashRefreshToken(refreshToken), expiresAt]
  );
  return { token: signToken({ id: user.id, username: user.username }), refreshToken };
}

async function toAuthResult(user: UserRow): Promise<AuthResult> {
  const pair = await issueTokenPair(user);
  return { ...pair, user: toUserDto(user) };
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

  return toAuthResult(user);
}

export async function login({ username, password }: Credentials): Promise<AuthResult> {
  const user = await findUserByUsername(username);
  // Compare against a dummy hash on unknown users to keep timing uniform.
  const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid username or password');
  }
  return toAuthResult(user);
}

/**
 * Rotate a refresh token: revoke the presented one, issue a fresh pair.
 * Reuse of an already-revoked token means it may be stolen — revoke every
 * session for that user so both parties must log in again.
 */
export async function rotateRefreshToken(raw: string): Promise<AuthResult> {
  const pool = getPool();
  const { rows } = await pool.query<RefreshTokenRow>(
    'SELECT * FROM refresh_tokens WHERE token_hash = $1',
    [hashRefreshToken(raw)]
  );
  const stored = rows[0];
  if (!stored) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  if (stored.revoked_at) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [stored.user_id]
    );
    throw ApiError.unauthorized('Refresh token reuse detected — all sessions revoked');
  }
  if (stored.expires_at.getTime() < Date.now()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const user = await findUserById(stored.user_id);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists');
  }

  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [stored.id]);
  return toAuthResult(user);
}

/** Revoke one refresh token (logout). Unknown tokens are a no-op. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await getPool().query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashRefreshToken(raw)]
  );
}

export async function saveDeviceToken(userId: number, token: string): Promise<void> {
  await getPool().query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, userId]);
}
