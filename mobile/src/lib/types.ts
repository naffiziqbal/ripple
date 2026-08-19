/** API contracts — mirrors the Ripple backend response DTOs. */

export interface User {
  id: number;
  username: string;
  /** Present only on the viewer's own profile — never on feed authors. */
  email?: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author: User;
}

export interface Post {
  id: number;
  content: string;
  createdAt: string;
  author: User;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  recentComments: Comment[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}

export interface AppNotification {
  id: number;
  type: 'like' | 'comment';
  postId: number;
  postPreview: string;
  actor: { id: number; username: string };
  read: boolean;
  createdAt: string;
}

export type NotificationsPage = Paginated<AppNotification> & { unreadCount: number };

/** Server → client realtime messages over /realtime. */
export interface RealtimeMessage {
  event: 'post:new' | 'post:deleted' | 'post:liked' | 'comment:new' | 'notification:new';
  postId?: number;
  likeCount?: number;
  recipientId?: number;
}
