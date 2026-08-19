import type { IncomingMessage, Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import { config } from '../config';
import type { AuthUser } from '../types';
import { realtimeEvents, type RealtimeEvents } from './events';

interface Client {
  socket: WebSocket;
  userId: number;
  alive: boolean;
}

const HEARTBEAT_MS = 30_000;

function authenticate(req: IncomingMessage): AuthUser | null {
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return null;
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & AuthUser;
    return { id: payload.id, username: payload.username };
  } catch {
    return null;
  }
}

/** Attach the realtime WebSocket endpoint (`/realtime?token=<jwt>`) to an HTTP server. */
export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<Client>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== '/realtime') {
      socket.destroy();
      return;
    }
    const user = authenticate(req);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', (socket: WebSocket, _req: IncomingMessage, user: AuthUser) => {
    const client: Client = { socket, userId: user.id, alive: true };
    clients.add(client);
    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate();
        clients.delete(client);
        continue;
      }
      client.alive = false;
      client.socket.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  function send<K extends keyof RealtimeEvents>(
    event: K,
    payload: RealtimeEvents[K],
    filter?: (client: Client) => boolean
  ): void {
    const message = JSON.stringify({ event, ...payload });
    for (const client of clients) {
      if (filter && !filter(client)) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(message);
      }
    }
  }

  realtimeEvents.onEvent('post:new', (p) => send('post:new', p));
  realtimeEvents.onEvent('post:deleted', (p) => send('post:deleted', p));
  realtimeEvents.onEvent('post:liked', (p) => send('post:liked', p));
  realtimeEvents.onEvent('comment:new', (p) => send('comment:new', p));
  realtimeEvents.onEvent('notification:new', (p) =>
    send('notification:new', p, (client) => client.userId === p.recipientId)
  );
}
