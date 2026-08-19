import type { Pool } from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      fcm_token TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Case-insensitive uniqueness for usernames.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('like', 'comment')),
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON likes (post_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, read, created_at DESC);
  `);
}
