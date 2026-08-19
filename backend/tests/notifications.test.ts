import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { auth, signupUser, useTestDb } from './helpers';

const app = createApp();

useTestDb();

let alice: { token: string };
let bob: { token: string };
let postId: number;

beforeEach(async () => {
  alice = await signupUser(app, 'alice');
  bob = await signupUser(app, 'bob');
  const res = await request(app)
    .post('/posts')
    .set(auth(alice.token))
    .send({ content: 'notify me' });
  postId = res.body.post.id;
});

describe('GET /notifications', () => {
  it('records like and comment notifications for the post owner', async () => {
    await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
    await request(app)
      .post(`/posts/${postId}/comment`)
      .set(auth(bob.token))
      .send({ content: 'hello!' });

    const res = await request(app).get('/notifications').set(auth(alice.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.unreadCount).toBe(2);

    const types = res.body.items.map((n: { type: string }) => n.type);
    expect(types).toEqual(['comment', 'like']); // newest first
    expect(res.body.items[0].actor.username).toBe('bob');
    expect(res.body.items[0].postId).toBe(postId);
    expect(res.body.items[0].postPreview).toBe('notify me');
    expect(res.body.items[0].read).toBe(false);
  });

  it('does not notify on self-interactions', async () => {
    await request(app).post(`/posts/${postId}/like`).set(auth(alice.token));
    await request(app)
      .post(`/posts/${postId}/comment`)
      .set(auth(alice.token))
      .send({ content: 'talking to myself' });

    const res = await request(app).get('/notifications').set(auth(alice.token));
    expect(res.body.total).toBe(0);
  });

  it('does not leak notifications to the actor', async () => {
    await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
    const res = await request(app).get('/notifications').set(auth(bob.token));
    expect(res.body.total).toBe(0);
  });
});

describe('POST /notifications/read-all', () => {
  it('clears the unread count', async () => {
    await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));

    const read = await request(app).post('/notifications/read-all').set(auth(alice.token));
    expect(read.status).toBe(200);

    const res = await request(app).get('/notifications').set(auth(alice.token));
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].read).toBe(true);
  });
});

describe('cascade cleanup', () => {
  it('deleting a post removes its notifications', async () => {
    await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
    await request(app).delete(`/posts/${postId}`).set(auth(alice.token));

    const res = await request(app).get('/notifications').set(auth(alice.token));
    expect(res.body.total).toBe(0);
  });
});
