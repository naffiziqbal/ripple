import fs from 'node:fs';
import { config } from '../config';

/**
 * Shared lazy Firebase Admin access. Reuses the app initialized by the
 * notifications service when present; initializes it itself otherwise.
 * Returns null when no service account is configured.
 */
export function getFirebaseAdmin(): typeof import('firebase-admin') | null {
  if (!fs.existsSync(config.FIREBASE_SERVICE_ACCOUNT)) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(
        JSON.parse(fs.readFileSync(config.FIREBASE_SERVICE_ACCOUNT, 'utf-8'))
      ),
    });
  }
  return admin;
}

/** Set a Firebase user's password (used by the OTP reset flow). */
export async function setFirebasePassword(uid: string, password: string): Promise<boolean> {
  const admin = getFirebaseAdmin();
  if (!admin) return false;
  await admin.auth().updateUser(uid, { password });
  return true;
}
