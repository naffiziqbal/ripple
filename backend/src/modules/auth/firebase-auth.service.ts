import { config, isTest } from '../../config';
import { ApiError } from '../../lib/errors';

/**
 * Firebase Authentication via the Identity Toolkit REST API.
 *
 * Firebase owns credentials (email + password) so its templated emails —
 * account-creation and password-reset — do the real work; Postgres keeps the
 * profile (username, firebase_uid) and our JWT/refresh session layer is
 * unchanged. When no FIREBASE_WEB_API_KEY is configured (tests, bare dev)
 * auth falls back to local bcrypt, mirroring the FCM log-only pattern.
 */
const BASE = 'https://identitytoolkit.googleapis.com/v1';

export function isFirebaseAuthEnabled(): boolean {
  return Boolean(config.FIREBASE_WEB_API_KEY) && !isTest;
}

interface IdentityToolkitError {
  error?: { message?: string };
}

async function identityToolkit<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}/${endpoint}?key=${config.FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as T & IdentityToolkitError;
  if (!res.ok) {
    const code = payload.error?.message ?? 'UNKNOWN';
    if (code === 'OPERATION_NOT_ALLOWED') {
      console.error(
        '[firebase-auth] Email/Password sign-in is disabled — enable it in ' +
          'Firebase console → Authentication → Sign-in method.'
      );
    }
    throw new FirebaseAuthError(code);
  }
  return payload;
}

export class FirebaseAuthError extends Error {
  constructor(public readonly code: string) {
    super(`Firebase auth error: ${code}`);
    this.name = 'FirebaseAuthError';
  }

  get isConfigProblem(): boolean {
    return this.code === 'CONFIGURATION_NOT_FOUND' || this.code.startsWith('OPERATION_NOT_ALLOWED');
  }
}

function configUnavailable(): ApiError {
  return new ApiError(
    503,
    'Email sign-in is not enabled for this Firebase project (console → Authentication → Sign-in method → Email/Password)'
  );
}

/** Create the Firebase account. Returns its uid + a fresh idToken. */
export async function createFirebaseUser(
  email: string,
  password: string
): Promise<{ uid: string; idToken: string }> {
  try {
    const result = await identityToolkit<{ localId: string; idToken: string }>('accounts:signUp', {
      email,
      password,
      returnSecureToken: true,
    });
    return { uid: result.localId, idToken: result.idToken };
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      if (err.code.startsWith('EMAIL_EXISTS')) {
        throw ApiError.conflict('Email already registered');
      }
      if (err.isConfigProblem) {
        throw configUnavailable();
      }
    }
    throw err;
  }
}

/** Validate email + password against Firebase. Returns the uid, or null when wrong. */
export async function verifyFirebasePassword(
  email: string,
  password: string
): Promise<string | null> {
  try {
    const result = await identityToolkit<{ localId: string }>('accounts:signInWithPassword', {
      email,
      password,
      returnSecureToken: true,
    });
    return result.localId;
  } catch (err) {
    if (err instanceof FirebaseAuthError) {
      if (err.isConfigProblem) {
        throw configUnavailable(); // server misconfig must not read as "wrong password"
      }
      return null; // wrong password / not found — caller replies 401
    }
    throw err;
  }
}

/**
 * The account-creation email. Firebase has no plain "welcome" template, so we
 * send its verify-email mail — login never checks verified status, it purely
 * serves as the "your Ripple account was created" message.
 */
export function sendAccountCreationEmail(idToken: string): void {
  identityToolkit('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken }).catch((err) =>
    console.warn('[firebase-auth] account-creation email failed:', err)
  );
}

/** Best-effort cleanup when the local insert fails after Firebase signup. */
export function deleteFirebaseUser(idToken: string): void {
  identityToolkit('accounts:delete', { idToken }).catch((err) =>
    console.warn('[firebase-auth] orphan cleanup failed:', err)
  );
}

/** Firebase sends its templated password-reset email with the reset link. */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  await identityToolkit('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email });
}
