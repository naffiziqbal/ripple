import { EventEmitter } from 'node:events';

/**
 * In-process event bus decoupling domain services from the WebSocket layer.
 * Broadcast events go to every connected client; `notification:new`
 * is delivered only to the recipient's sockets.
 */
export interface RealtimeEvents {
  'post:new': { postId: number };
  'post:deleted': { postId: number };
  'post:liked': { postId: number; likeCount: number };
  'comment:new': { postId: number };
  'notification:new': { recipientId: number };
}

class RealtimeEmitter extends EventEmitter {
  emitEvent<K extends keyof RealtimeEvents>(event: K, payload: RealtimeEvents[K]): void {
    this.emit(event, payload);
  }

  onEvent<K extends keyof RealtimeEvents>(
    event: K,
    listener: (payload: RealtimeEvents[K]) => void
  ): void {
    this.on(event, listener);
  }
}

export const realtimeEvents = new RealtimeEmitter();
