import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { auth, signupUser, useTestDb } from './helpers';

const app = createApp();

useTestDb();

let alice: { token: string };
let bob: { token: string };

beforeEach(async () => {
  alice = await signupUser(app, 'alice');
  bob = await signupUser(app, 'bob');
});

async function createPost(token: string, content: string): Promise<number> {
  const res = await request(app).post('/posts').set(auth(token)).send({ content });
  expect(res.status).toBe(201);
  return res.body.post.id;
}

describe('POST /posts', () => {
  it('creates a text post', async () => {
    const res = await request(app)
      .post('/posts')
      .set(auth(alice.token))
      .send({ content: 'Hello Ripple!' });

    expect(res.status).toBe(201);
    expect(res.body.post).toMatchObject({
      content: 'Hello Ripple!',
      likeCount: 0,
      commentCount: 0,
      likedByMe: false,
    });
    expect(res.body.post.author.username).toBe('alice');
  });

  it('rejects empty and oversized content', async () => {
    const empty = await request(app).post('/posts').set(auth(alice.token)).send({ content: '   ' });
    const oversized = await request(app)
      .post('/posts')
      .set(auth(alice.token))
      .send({ content: 'x'.repeat(501) });
    expect(empty.status).toBe(400);
    expect(oversized.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/posts').send({ content: 'hi' });
    expect(res.status).toBe(401);
  });
});

describe('GET /posts', () => {
  it('returns newest-first paginated feed', async () => {
    for (let i = 1; i <= 5; i++) {
      await createPost(alice.token, `post ${i}`);
    }

    const page1 = await request(app).get('/posts?page=1&limit=2').set(auth(bob.token));
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items[0].content).toBe('post 5');
    expect(page1.body.items[1].content).toBe('post 4');
    expect(page1.body.total).toBe(5);
    expect(page1.body.hasMore).toBe(true);

    const page3 = await request(app).get('/posts?page=3&limit=2').set(auth(bob.token));
    expect(page3.body.items).toHaveLength(1);
    expect(page3.body.hasMore).toBe(false);
  });

  it('filters the feed by username', async () => {
    await createPost(alice.token, 'from alice');
    await createPost(bob.token, 'from bob');

    const res = await request(app).get('/posts?username=alice').set(auth(bob.token));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].author.username).toBe('alice');
  });
});

describe('POST /posts/:id/like', () => {
  it('likes then unlikes on repeated calls', async () => {
    const postId = await createPost(alice.token, 'like me');

    const like = await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
    expect(like.status).toBe(200);
    expect(like.body).toEqual({ liked: true, likeCount: 1 });

    const unlike = await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));
    expect(unlike.body).toEqual({ liked: false, likeCount: 0 });
  });

  it('reflects likedByMe per viewer in the feed', async () => {
    const postId = await createPost(alice.token, 'like me');
    await request(app).post(`/posts/${postId}/like`).set(auth(bob.token));

    const bobFeed = await request(app).get('/posts').set(auth(bob.token));
    const aliceFeed = await request(app).get('/posts').set(auth(alice.token));
    expect(bobFeed.body.items[0].likedByMe).toBe(true);
    expect(aliceFeed.body.items[0].likedByMe).toBe(false);
  });

  it('404s on a missing post', async () => {
    const res = await request(app).post('/posts/9999/like').set(auth(bob.token));
    expect(res.status).toBe(404);
  });
});

describe('POST /posts/:id/comment', () => {
  it('adds a comment and surfaces it in the feed preview', async () => {
    const postId = await createPost(alice.token, 'discuss');

    const res = await request(app)
      .post(`/posts/${postId}/comment`)
      .set(auth(bob.token))
      .send({ content: 'Nice post!' });
    expect(res.status).toBe(201);
    expect(res.body.comment).toMatchObject({ content: 'Nice post!', postId });
    expect(res.body.comment.author.username).toBe('bob');

    const feed = await request(app).get('/posts').set(auth(alice.token));
    expect(feed.body.items[0].commentCount).toBe(1);
    expect(feed.body.items[0].recentComments[0].content).toBe('Nice post!');
  });

  it('lists comments oldest-first with pagination', async () => {
    const postId = await createPost(alice.token, 'discuss');
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post(`/posts/${postId}/comment`)
        .set(auth(i % 2 === 0 ? alice.token : bob.token))
        .send({ content: `comment ${i}` });
    }

    const page1 = await request(app)
      .get(`/posts/${postId}/comments?page=1&limit=2`)
      .set(auth(bob.token));
    expect(page1.status).toBe(200);
    expect(page1.body.items.map((c: { content: string }) => c.content)).toEqual([
      'comment 1',
      'comment 2',
    ]);
    expect(page1.body.total).toBe(5);
    expect(page1.body.hasMore).toBe(true);

    const page3 = await request(app)
      .get(`/posts/${postId}/comments?page=3&limit=2`)
      .set(auth(bob.token));
    expect(page3.body.items).toHaveLength(1);
    expect(page3.body.hasMore).toBe(false);
  });

  it('rejects empty comments', async () => {
    const postId = await createPost(alice.token, 'discuss');
    const res = await request(app)
      .post(`/posts/${postId}/comment`)
      .set(auth(bob.token))
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /posts/:id', () => {
  it('lets the owner delete their post', async () => {
    const postId = await createPost(alice.token, 'delete me');
    const res = await request(app).delete(`/posts/${postId}`).set(auth(alice.token));
    expect(res.status).toBe(200);

    const feed = await request(app).get('/posts').set(auth(alice.token));
    expect(feed.body.total).toBe(0);
  });

  it('forbids deleting someone else’s post', async () => {
    const postId = await createPost(alice.token, 'mine');
    const res = await request(app).delete(`/posts/${postId}`).set(auth(bob.token));
    expect(res.status).toBe(403);

    const feed = await request(app).get('/posts').set(auth(bob.token));
    expect(feed.body.total).toBe(1);
  });

  it('404s on a missing post', async () => {
    const res = await request(app).delete('/posts/9999').set(auth(alice.token));
    expect(res.status).toBe(404);
  });
});
