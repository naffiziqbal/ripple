import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { getPool } from '../../db';
import { ApiError } from '../../lib/errors';
import { setFirebasePassword } from '../../lib/firebase-admin';
import { sendPasswordResetOtp } from '../../lib/mailer';
import { signToken } from '../../middleware/auth';
import type { UserDto, UserRow } from '../../types';
import type { LoginInput, SignupInput } from './auth.schemas';
import {
  createFirebaseUser,
  deleteFirebaseUser,
  isFirebaseAuthEnabled,
  sendAccountCreationEmail,
  verifyFirebasePassword,
} from './firebase-auth.service';

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
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

/** Look up by username or email, case-insensitively. */
async function findUserByIdentifier(identifier: string): Promise<UserRow | undefined> {
  const { rows } = await getPool().query<UserRow>(
    'SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)',
    [identifier]
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

function conflictFrom(err: unknown): ApiError | null {
  if (err instanceof Error && 'code' in err && err.code === '23505') {
    const constraint = 'constraint' in err ? String(err.constraint) : '';
    return ApiError.conflict(
      constraint.includes('email') ? 'Email already registered' : 'Username already taken'
    );
  }
  return null;
}

/**
 * Firebase owns credentials when configured: the account is created there
 * (which also triggers the account-creation email) and Postgres stores the
 * profile keyed by firebase_uid. Without Firebase (tests / bare dev) the
 * password is bcrypt-hashed locally instead.
 */
export async function signup({ username, email, password }: SignupInput): Promise<AuthResult> {
  let firebase: { uid: string; idToken: string } | null = null;
  let passwordHash: string | null = null;

  if (isFirebaseAuthEnabled()) {
    // Cheap pre-check so an obviously taken username doesn't create an
    // orphan Firebase account (the unique index still guards races).
    const existing = await findUserByIdentifier(username);
    if (existing) {
      throw ApiError.conflict('Username already taken');
    }
    firebase = await createFirebaseUser(email, password);
  } else {
    passwordHash = await bcrypt.hash(password, 10);
  }

  let user: UserRow;
  try {
    const { rows } = await getPool().query<UserRow>(
      `INSERT INTO users (username, email, password_hash, firebase_uid)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [username, email, passwordHash, firebase?.uid ?? null]
    );
    user = rows[0]!;
  } catch (err) {
    if (firebase) {
      deleteFirebaseUser(firebase.idToken);
    }
    throw conflictFrom(err) ?? err;
  }

  if (firebase) {
    sendAccountCreationEmail(firebase.idToken); // fire-and-forget welcome mail
  }
  return toAuthResult(user);
}

export async function login({ identifier, password }: LoginInput): Promise<AuthResult> {
  const user = await findUserByIdentifier(identifier);

  let valid = false;
  if (user?.firebase_uid && user.email && isFirebaseAuthEnabled()) {
    const uid = await verifyFirebasePassword(user.email, password);
    valid = uid === user.firebase_uid;
  } else {
    // Legacy/local path. Compare against a dummy hash on unknown users to
    // keep timing uniform.
    const hash =
      user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    valid = (await bcrypt.compare(password, hash)) && Boolean(user?.password_hash);
  }

  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  return toAuthResult(user);
}

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL = '10m';

interface OtpRow {
  user_id: number;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
}

/**
 * In-app password reset, step 1: generate a 6-digit OTP, store its hash
 * (one active code per user) and email it. Unknown accounts get an explicit
 * 404 — a deliberate UX-over-enumeration tradeoff so typos don't send users
 * to an inbox that will never fill (usernames are public in the feed anyway).
 * Returns the OTP so the test env can exercise the flow; never expose it
 * in responses outside tests.
 */
export async function requestPasswordResetOtp(identifier: string): Promise<string | null> {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    throw ApiError.notFound('No account found with that username or email');
  }
  if (!user.email) {
    throw ApiError.badRequest('This account has no email on file, so it cannot be reset');
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await getPool().query(
    `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at, attempts)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id)
     DO UPDATE SET otp_hash = $2, expires_at = $3, attempts = 0, created_at = now()`,
    [user.id, createHash('sha256').update(otp).digest('hex'), new Date(Date.now() + OTP_TTL_MS)]
  );

  try {
    await sendPasswordResetOtp(user.email, otp);
  } catch (err) {
    console.error('[auth] reset OTP email failed:', err);
  }
  return otp;
}

/**
 * Step 2: check the OTP (max 5 attempts, 10-minute expiry). Success consumes
 * the code and returns a short-lived single-purpose reset token.
 */
export async function verifyResetOtp(identifier: string, otp: string): Promise<string> {
  const invalid = ApiError.unauthorized('Invalid or expired code');
  const user = await findUserByIdentifier(identifier);
  if (!user) throw invalid;

  const pool = getPool();
  const { rows } = await pool.query<OtpRow>(
    'SELECT * FROM password_reset_otps WHERE user_id = $1',
    [user.id]
  );
  const row = rows[0];
  if (!row || row.expires_at.getTime() < Date.now()) throw invalid;
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw ApiError.unauthorized('Too many attempts — request a new code');
  }

  const matches = row.otp_hash === createHash('sha256').update(otp).digest('hex');
  if (!matches) {
    await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE user_id = $1', [
      user.id,
    ]);
    throw invalid;
  }

  await pool.query('DELETE FROM password_reset_otps WHERE user_id = $1', [user.id]);
  return jwt.sign({ id: user.id, purpose: 'password-reset' }, config.JWT_SECRET, {
    expiresIn: RESET_TOKEN_TTL,
  });
}

/**
 * Step 3: set the new password — in Firebase for Firebase-backed accounts,
 * bcrypt locally for legacy ones — and revoke every session.
 */
export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  let payload: jwt.JwtPayload & { id: number; purpose?: string };
  try {
    payload = jwt.verify(resetToken, config.JWT_SECRET) as typeof payload;
  } catch {
    throw ApiError.unauthorized('Reset session expired — request a new code');
  }
  if (payload.purpose !== 'password-reset') {
    throw ApiError.unauthorized('Invalid reset token');
  }

  const user = await findUserById(payload.id);
  if (!user) throw ApiError.unauthorized('User no longer exists');

  if (user.firebase_uid && isFirebaseAuthEnabled()) {
    // Firebase is this account's credential store — the update must land there.
    if (!(await setFirebasePassword(user.firebase_uid, newPassword))) {
      throw new ApiError(503, 'Password reset is temporarily unavailable');
    }
  } else {
    const hash = await bcrypt.hash(newPassword, 10);
    await getPool().query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  }

  // Force re-login everywhere with the new password.
  await getPool().query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [user.id]
  );
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
