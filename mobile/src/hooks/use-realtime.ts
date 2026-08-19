import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { realtimeUrl } from '../lib/api';
import type { RealtimeMessage } from '../lib/types';
import { postKeys } from './use-posts';

const MAX_BACKOFF_MS = 30_000;

/**
 * Live updates over the /realtime WebSocket (React Native ships a native
 * WebSocket client). On any event the affected queries are invalidated, so
 * feeds, threads, and the notification badge update within a second of the
 * action happening — no pull-to-refresh. Reconnects with capped backoff and
 * pauses while the app is backgrounded.
 */
export function useRealtime(accessToken: string | null): void {
  const queryClient = useQueryClient();
  const backoff = useRef(1000);

  useEffect(() => {
    if (!accessToken) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handleMessage = (raw: string) => {
      let message: RealtimeMessage;
      try {
        message = JSON.parse(raw) as RealtimeMessage;
      } catch {
        return;
      }
      switch (message.event) {
        case 'post:new':
        case 'post:deleted':
          void queryClient.invalidateQueries({ queryKey: postKeys.feeds });
          break;
        case 'post:liked':
          void queryClient.invalidateQueries({ queryKey: postKeys.feeds });
          if (message.postId) {
            void queryClient.invalidateQueries({ queryKey: postKeys.post(message.postId) });
          }
          break;
        case 'comment:new':
          void queryClient.invalidateQueries({ queryKey: postKeys.feeds });
          if (message.postId) {
            void queryClient.invalidateQueries({ queryKey: postKeys.post(message.postId) });
            void queryClient.invalidateQueries({ queryKey: postKeys.comments(message.postId) });
          }
          break;
        case 'notification:new':
          void queryClient.invalidateQueries({ queryKey: postKeys.notifications });
          break;
      }
    };

    const connect = () => {
      if (disposed || AppState.currentState !== 'active') return;
      socket = new WebSocket(realtimeUrl(accessToken));
      socket.onopen = () => {
        backoff.current = 1000;
      };
      socket.onmessage = (event) => handleMessage(String(event.data));
      socket.onclose = () => {
        if (disposed) return;
        reconnectTimer = setTimeout(connect, backoff.current);
        backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS);
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    // Drop the socket in the background; reconnect (and refetch) on return.
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        if (!socket || socket.readyState === WebSocket.CLOSED) connect();
      } else {
        socket?.close();
      }
    });

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      appState.remove();
      socket?.close();
    };
  }, [accessToken, queryClient]);
}
