import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AuthResponse,
  Comment,
  LikeResponse,
  Paginated,
  Post,
} from './types';

/**
 * Resolve the API base URL:
 * 1. EXPO_PUBLIC_API_URL when set (physical devices / production builds)
 * 2. The Metro bundler host (works automatically in Expo Go on the same LAN)
 * 3. localhost as a last resort (iOS simulator / web)
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:4000`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

const API_URL = resolveBaseUrl();

class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenProvider = () => string | null;

let getToken: TokenProvider = () => null;

/** Called once by the auth provider so the client can attach the JWT. */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, payload?.details);
  }
  return payload as T;
}

export const api = {
  signup: (username: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: { username, password } }),

  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { username, password } }),

  registerDeviceToken: (token: string) =>
    request<{ ok: boolean }>('/auth/device-token', { method: 'PUT', body: { token } }),

  getFeed: (params: { page: number; limit?: number; username?: string }) => {
    const query = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit ?? 10),
      ...(params.username ? { username: params.username } : {}),
    });
    return request<Paginated<Post>>(`/posts?${query}`);
  },

  createPost: (content: string) =>
    request<{ post: Post }>('/posts', { method: 'POST', body: { content } }),

  getPost: (postId: number) => request<{ post: Post }>(`/posts/${postId}`),

  toggleLike: (postId: number) =>
    request<LikeResponse>(`/posts/${postId}/like`, { method: 'POST' }),

  addComment: (postId: number, content: string) =>
    request<{ comment: Comment }>(`/posts/${postId}/comment`, {
      method: 'POST',
      body: { content },
    }),

  getComments: (postId: number) => request<{ comments: Comment[] }>(`/posts/${postId}/comments`),
};
