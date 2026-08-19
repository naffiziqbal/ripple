import fs from 'node:fs';
import type { Messaging } from 'firebase-admin/messaging';
import { config, isTest } from '../../config';

interface PushRecipient {
  username: string;
  fcm_token: string | null;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string | number>;
}

/**
 * FCM is optional at runtime: without a service account file the service
 * degrades to console logging so the API stays fully usable in local dev.
 */
let messaging: Messaging | null = null;

export function initNotifications(): void {
  if (isTest) return;

  if (!fs.existsSync(config.FIREBASE_SERVICE_ACCOUNT)) {
    console.warn(
      `[notifications] No Firebase service account at ${config.FIREBASE_SERVICE_ACCOUNT} — running in log-only mode.`
    );
    return;
  }

  // Lazy-require so the (heavy) SDK only loads when actually configured.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(fs.readFileSync(config.FIREBASE_SERVICE_ACCOUNT, 'utf-8'))
    ),
  });
  messaging = admin.messaging();
  console.log('[notifications] Firebase Cloud Messaging initialized.');
}

async function sendToUser(recipient: PushRecipient, payload: PushPayload): Promise<void> {
  if (!recipient.fcm_token) return;

  if (!messaging) {
    if (!isTest) {
      console.log(
        `[notifications] (log-only) → ${recipient.username}: ${payload.title} — ${payload.body}`
      );
    }
    return;
  }

  try {
    await messaging.send({
      token: recipient.fcm_token,
      notification: { title: payload.title, body: payload.body },
      data: Object.fromEntries(
        Object.entries(payload.data ?? {}).map(([key, value]) => [key, String(value)])
      ),
    });
  } catch (err) {
    // Push delivery must never fail the originating API request.
    console.error(
      `[notifications] Failed to send to ${recipient.username}:`,
      err instanceof Error ? err.message : err
    );
  }
}

export function notifyPostLiked(args: {
  recipient: PushRecipient;
  actorUsername: string;
  postId: number;
}): Promise<void> {
  return sendToUser(args.recipient, {
    title: 'New like on Ripple',
    body: `${args.actorUsername} liked your post`,
    data: { type: 'like', postId: args.postId },
  });
}

export function notifyPostCommented(args: {
  recipient: PushRecipient;
  actorUsername: string;
  postId: number;
  commentPreview: string;
}): Promise<void> {
  return sendToUser(args.recipient, {
    title: 'New comment on Ripple',
    body: `${args.actorUsername} commented: ${args.commentPreview.slice(0, 80)}`,
    data: { type: 'comment', postId: args.postId },
  });
}
