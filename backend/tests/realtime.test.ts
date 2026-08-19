import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createApp } from '../src/app';
import { attachRealtime } from '../src/realtime/ws-server';
import { auth, signupUser, useTestDb } from './helpers';

const app = createApp();

useTestDb();

let server: http.Server;
let wsUrl: string;

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  wsUrl = `ws://127.0.0.1:${port}/realtime`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function nextMessage(socket: WebSocket, timeoutMs = 3000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for ws message')), timeoutMs);
    socket.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(data)));
    });
  });
}

function connect(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsUrl}?token=${token}`);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

describe('realtime WebSocket', () => {
  it('rejects connections without a valid token', async () => {
    await expect(connect('garbage')).rejects.toThrow();
  });

  it('broadcasts post events and targets notifications to the recipient', async () => {
    const alice = await signupUser(app, 'alice');
    const bob = await signupUser(app, 'bob');

    const aliceSocket = await connect(alice.token);
    const bobSocket = await connect(bob.token);
    try {
      // Post creation is broadcast to everyone.
      const broadcast = nextMessage(bobSocket);
      const postRes = await request(app)
        .post('/posts')
        .set(auth(alice.token))
        .send({ content: 'live!' });
      const postId = postRes.body.post.id;
      expect(await broadcast).toMatchObject({ event: 'post:new', postId });

      // Bob liking Alice's post → Alice gets a targeted notification event
      // (plus everyone gets the like broadcast).
      const aliceEvents: Record<string, unknown>[] = [];
      aliceSocket.on('message', (data) => aliceEvents.push(JSON.parse(String(data))));
      await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
      await new Promise((resolve) => setTimeout(resolve, 300));

      const eventNames = aliceEvents.map((e) => e.event);
      expect(eventNames).toContain('notification:new');
      expect(eventNames).toContain('post:liked');
    } finally {
      aliceSocket.close();
      bobSocket.close();
    }
  });
});
