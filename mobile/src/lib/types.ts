/** API contracts — mirrors the Ripple backend response DTOs. */

export interface User {
  id: number;
  username: string;
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
  user: User;
}

export interface LikeResponse {
  liked: boolean;
  likeCount: number;
}
