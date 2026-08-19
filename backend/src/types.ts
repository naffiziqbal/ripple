/** Database row shapes (snake_case mirrors PostgreSQL columns). */

export interface UserRow {
  id: number;
  username: string;
  password_hash: string | null;
  email: string | null;
  firebase_uid: string | null;
  fcm_token: string | null;
  created_at: Date;
}

export interface PostRow {
  id: number;
  user_id: number;
  content: string;
  created_at: Date;
}

/** API response shapes (camelCase, safe to expose). */

export interface UserDto {
  id: number;
  username: string;
  /** Present only on the viewer's own profile (signup/login//auth/me) — never on feed authors. */
  email?: string | null;
  createdAt: string;
}

export interface CommentDto {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author: UserDto;
}

export interface PostDto {
  id: number;
  content: string;
  createdAt: string;
  author: UserDto;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /** Newest few comments for feed preview; full list via GET /posts/:id/comments. */
  recentComments: CommentDto[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/** JWT payload attached to authenticated requests. */
export interface AuthUser {
  id: number;
  username: string;
}
