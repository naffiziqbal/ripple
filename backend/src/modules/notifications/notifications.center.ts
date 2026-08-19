import { getPool } from '../../db';
import { realtimeEvents } from '../../realtime/events';
import type { AuthUser, Paginated } from '../../types';

export type NotificationType = 'like' | 'comment';

export interface NotificationDto {
  id: number;
  type: NotificationType;
  postId: number;
  postPreview: string;
  actor: { id: number; username: string };
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: number;
  type: NotificationType;
  post_id: number;
  post_preview: string;
  actor_id: number;
  actor_username: string;
  read: boolean;
  created_at: Date;
}

function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    postId: row.post_id,
    postPreview: row.post_preview,
    actor: { id: row.actor_id, username: row.actor_username },
    read: row.read,
    createdAt: row.created_at.toISOString(),
  };
}

/** Persist an interaction notification and announce it over the realtime bus. */
export async function recordNotification(args: {
  recipientId: number;
  actorId: number;
  type: NotificationType;
  postId: number;
}): Promise<void> {
  await getPool().query(
    'INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4)',
    [args.recipientId, args.actorId, args.type, args.postId]
  );
  realtimeEvents.emitEvent('notification:new', { recipientId: args.recipientId });
}

export async function listNotifications(
  viewer: AuthUser,
  page: number,
  limit: number
): Promise<Paginated<NotificationDto> & { unreadCount: number }> {
  const pool = getPool();

  const counts = await pool.query<{ total: number; unread: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE NOT read)::int AS unread
     FROM notifications WHERE recipient_id = $1`,
    [viewer.id]
  );
  const { total, unread } = counts.rows[0]!;

  const { rows } = await pool.query<NotificationRow>(
    `SELECT n.id, n.type, n.post_id, n.read, n.created_at,
            LEFT(p.content, 80) AS post_preview,
            u.id AS actor_id, u.username AS actor_username
     FROM notifications n
     JOIN users u ON u.id = n.actor_id
     JOIN posts p ON p.id = n.post_id
     WHERE n.recipient_id = $1
     ORDER BY n.created_at DESC, n.id DESC
     OFFSET $2 LIMIT $3`,
    [viewer.id, (page - 1) * limit, limit]
  );

  return {
    items: rows.map(toDto),
    page,
    limit,
    total,
    hasMore: page * limit < total,
    unreadCount: unread,
  };
}

export async function markAllRead(viewer: AuthUser): Promise<void> {
  await getPool().query('UPDATE notifications SET read = true WHERE recipient_id = $1 AND NOT read', [
    viewer.id,
  ]);
}
