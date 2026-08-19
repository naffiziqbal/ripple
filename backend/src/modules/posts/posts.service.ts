import { getPool } from '../../db';
import { ApiError } from '../../lib/errors';
import type { AuthUser, CommentDto, Paginated, PostDto, PostRow, UserRow } from '../../types';
import { findUserById } from '../auth/auth.service';
import { notifyPostCommented, notifyPostLiked } from '../notifications/notifications.service';
import type { FeedQuery } from './posts.schemas';

const RECENT_COMMENTS_PER_POST = 2;

interface FeedRow {
  id: number;
  user_id: number;
  content: string;
  created_at: Date;
  author_username: string;
  author_created_at: Date;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface CommentWithAuthorRow {
  id: number;
  post_id: number;
  content: string;
  created_at: Date;
  author_id: number;
  author_username: string;
  author_created_at: Date;
}

const COMMENT_SELECT = `
  SELECT c.id, c.post_id, c.content, c.created_at,
         u.id AS author_id, u.username AS author_username, u.created_at AS author_created_at
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

function toCommentDto(row: CommentWithAuthorRow): CommentDto {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    author: {
      id: row.author_id,
      username: row.author_username,
      createdAt: row.author_created_at.toISOString(),
    },
  };
}

function toPostDto(row: FeedRow, recentComments: CommentDto[]): PostDto {
  return {
    id: row.id,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    author: {
      id: row.user_id,
      username: row.author_username,
      createdAt: row.author_created_at.toISOString(),
    },
    likeCount: row.like_count,
    commentCount: row.comment_count,
    likedByMe: row.liked_by_me,
    recentComments,
  };
}

/** $1 is always the viewer id so liked_by_me can be computed per request. */
const FEED_SELECT = `
  SELECT
    p.id, p.user_id, p.content, p.created_at,
    u.username AS author_username,
    u.created_at AS author_created_at,
    (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
    EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked_by_me
  FROM posts p
  JOIN users u ON u.id = p.user_id
`;

/**
 * Newest few preview comments for a set of posts in one query
 * (row_number window caps the per-post count in SQL).
 */
async function recentCommentsFor(postIds: number[]): Promise<Map<number, CommentDto[]>> {
  const grouped = new Map<number, CommentDto[]>();
  if (postIds.length === 0) return grouped;

  const { rows } = await getPool().query<CommentWithAuthorRow>(
    `SELECT * FROM (
       SELECT c.id, c.post_id, c.content, c.created_at,
              u.id AS author_id, u.username AS author_username, u.created_at AS author_created_at,
              ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.created_at DESC, c.id DESC) AS rn
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ANY($1::int[])
     ) ranked
     WHERE rn <= $2
     ORDER BY created_at DESC, id DESC`,
    [postIds, RECENT_COMMENTS_PER_POST]
  );

  for (const row of rows) {
    const bucket = grouped.get(row.post_id) ?? [];
    bucket.push(toCommentDto(row));
    grouped.set(row.post_id, bucket);
  }
  return grouped;
}

export async function getFeed(query: FeedQuery, viewer: AuthUser): Promise<Paginated<PostDto>> {
  const pool = getPool();
  const where = query.username ? 'WHERE LOWER(u.username) = LOWER($2)' : '';
  const filterParams = query.username ? [query.username] : [];

  const totalResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM posts p JOIN users u ON u.id = p.user_id
     ${query.username ? 'WHERE LOWER(u.username) = LOWER($1)' : ''}`,
    filterParams
  );
  const total = totalResult.rows[0]!.count;

  const offsetParam = filterParams.length + 2;
  const limitParam = filterParams.length + 3;
  const { rows } = await pool.query<FeedRow>(
    `${FEED_SELECT} ${where}
     ORDER BY p.created_at DESC, p.id DESC
     OFFSET $${offsetParam} LIMIT $${limitParam}`,
    [viewer.id, ...filterParams, (query.page - 1) * query.limit, query.limit]
  );

  const comments = await recentCommentsFor(rows.map((row) => row.id));
  return {
    items: rows.map((row) => toPostDto(row, comments.get(row.id) ?? [])),
    page: query.page,
    limit: query.limit,
    total,
    hasMore: query.page * query.limit < total,
  };
}

export async function getPost(postId: number, viewer: AuthUser): Promise<PostDto> {
  const { rows } = await getPool().query<FeedRow>(`${FEED_SELECT} WHERE p.id = $2`, [
    viewer.id,
    postId,
  ]);
  const row = rows[0];
  if (!row) {
    throw ApiError.notFound('Post not found');
  }
  const comments = await recentCommentsFor([row.id]);
  return toPostDto(row, comments.get(row.id) ?? []);
}

export async function createPost(author: AuthUser, content: string): Promise<PostDto> {
  const { rows } = await getPool().query<{ id: number }>(
    'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING id',
    [author.id, content]
  );
  return getPost(rows[0]!.id, author);
}

async function requirePostRow(postId: number): Promise<PostRow> {
  const { rows } = await getPool().query<PostRow>('SELECT * FROM posts WHERE id = $1', [postId]);
  const row = rows[0];
  if (!row) {
    throw ApiError.notFound('Post not found');
  }
  return row;
}

function notifyOwner(
  post: PostRow,
  actor: AuthUser,
  notify: (owner: UserRow) => Promise<void>
): void {
  if (post.user_id === actor.id) return; // no self-notifications
  // Fire-and-forget: push delivery must never block or fail the API response.
  void findUserById(post.user_id)
    .then((owner) => (owner ? notify(owner) : undefined))
    .catch(() => undefined);
}

/** Toggles the viewer's like. Returns the new state plus updated count. */
export async function toggleLike(
  postId: number,
  actor: AuthUser
): Promise<{ liked: boolean; likeCount: number }> {
  const pool = getPool();
  const post = await requirePostRow(postId);

  // Delete-first toggle: if nothing was deleted, this is a new like.
  const deleted = await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [
    postId,
    actor.id,
  ]);
  const liked = deleted.rowCount === 0;

  if (liked) {
    await pool.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [postId, actor.id]
    );
    notifyOwner(post, actor, (owner) =>
      notifyPostLiked({ recipient: owner, actorUsername: actor.username, postId })
    );
  }

  const { rows } = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1',
    [postId]
  );
  return { liked, likeCount: rows[0]!.count };
}

export async function addComment(
  postId: number,
  actor: AuthUser,
  content: string
): Promise<CommentDto> {
  const post = await requirePostRow(postId);

  const { rows } = await getPool().query<CommentWithAuthorRow>(
    `WITH inserted AS (
       INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, content, created_at
     )
     SELECT i.id, i.post_id, i.content, i.created_at,
            u.id AS author_id, u.username AS author_username, u.created_at AS author_created_at
     FROM inserted i JOIN users u ON u.id = i.user_id`,
    [postId, actor.id, content]
  );

  notifyOwner(post, actor, (owner) =>
    notifyPostCommented({
      recipient: owner,
      actorUsername: actor.username,
      postId,
      commentPreview: content,
    })
  );

  return toCommentDto(rows[0]!);
}

export async function getComments(postId: number): Promise<CommentDto[]> {
  await requirePostRow(postId);
  const { rows } = await getPool().query<CommentWithAuthorRow>(
    `${COMMENT_SELECT} WHERE c.post_id = $1 ORDER BY c.created_at ASC, c.id ASC`,
    [postId]
  );
  return rows.map(toCommentDto);
}
