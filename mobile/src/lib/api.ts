import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AuthResponse,
  Comment,
  LikeResponse,
  NotificationsPage,
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

/** ws:// twin of the API base, for the /realtime socket. */
export function realtimeUrl(token: string): string {
  return `${API_URL.replace(/^http/, 'ws')}/realtime?token=${encodeURIComponent(token)}`;
}

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

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

type SessionProvider = () => SessionTokens | null;

let getSession: SessionProvider = () => null;
let onSessionRefreshed: (tokens: SessionTokens) => void = () => undefined;
let onSessionExpired: () => void = () => undefined;

/** Called once by the auth provider so the client can read/renew the session. */
export function configureApiAuth(handlers: {
  getSession: SessionProvider;
  onSessionRefreshed: (tokens: SessionTokens) => void;
  onSessionExpired: () => void;
}): void {
  getSession = handlers.getSession;
  onSessionRefreshed = handlers.onSessionRefreshed;
  onSessionExpired = handlers.onSessionExpired;
}

async function rawRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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

/** Single-flight refresh: concurrent 401s share one rotation. */
let refreshInFlight: Promise<SessionTokens | null> | null = null;

function refreshSession(refreshToken: string): Promise<SessionTokens | null> {
  refreshInFlight ??= rawRequest<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  })
    .then((auth) => {
      const tokens = { token: auth.token, refreshToken: auth.refreshToken };
      onSessionRefreshed(tokens);
      return tokens;
    })
    .catch(() => {
      onSessionExpired();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const session = getSession();
  try {
    return await rawRequest<T>(path, { ...options, token: session?.token ?? null });
  } catch (err) {
    // Access token expired mid-session: rotate the refresh token and retry once.
    if (err instanceof ApiError && err.status === 401 && session?.refreshToken) {
      const renewed = await refreshSession(session.refreshToken);
      if (renewed) {
        return rawRequest<T>(path, { ...options, token: renewed.token });
      }
    }
    throw err;
  }
}

export const api = {
  signup: (username: string, email: string, password: string) =>
    rawRequest<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: { username, email, password },
    }),

  /** identifier = username or email. */
  login: (identifier: string, password: string) =>
    rawRequest<AuthResponse>('/auth/login', { method: 'POST', body: { identifier, password } }),

  /** Step 1: emails a 6-digit reset code. identifier = username or email. */
  forgotPassword: (identifier: string) =>
    rawRequest<{ ok: boolean }>('/auth/forgot-password', {
      method: 'POST',
      body: { identifier },
    }),

  /** Step 2: verify the emailed code → short-lived reset token. */
  verifyResetOtp: (identifier: string, otp: string) =>
    rawRequest<{ resetToken: string }>('/auth/verify-reset-otp', {
      method: 'POST',
      body: { identifier, otp },
    }),

  /** Step 3: set the new password (revokes all sessions). */
  resetPassword: (resetToken: string, password: string) =>
    rawRequest<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: { resetToken, password },
    }),

  logout: (refreshToken: string) =>
    rawRequest<{ ok: boolean }>('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(
      () => ({ ok: false })
    ),

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

  deletePost: (postId: number) => request<{ ok: boolean }>(`/posts/${postId}`, { method: 'DELETE' }),

  getPost: (postId: number) => request<{ post: Post }>(`/posts/${postId}`),

  toggleLike: (postId: number) =>
    request<LikeResponse>(`/posts/${postId}/like`, { method: 'POST' }),

  addComment: (postId: number, content: string) =>
    request<{ comment: Comment }>(`/posts/${postId}/comment`, {
      method: 'POST',
      body: { content },
    }),

  getComments: (postId: number, page: number, limit = 30) =>
    request<Paginated<Comment>>(`/posts/${postId}/comments?page=${page}&limit=${limit}`),

  getNotifications: (page = 1, limit = 20) =>
    request<NotificationsPage>(`/notifications?page=${page}&limit=${limit}`),

  markNotificationsRead: () =>
    request<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
};
