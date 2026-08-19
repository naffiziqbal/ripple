import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { auth, signupUser, useTestDb } from './helpers';

const app = createApp();

useTestDb();

describe('POST /auth/signup', () => {
  it('creates a user and returns a token', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'alice', email: 'alice@test.local', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ username: 'alice', email: 'alice@test.local' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate usernames case-insensitively', async () => {
    await signupUser(app, 'alice');
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'ALICE', email: 'other@test.local', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await signupUser(app, 'alice', 'password123', 'alice@test.local');
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'someoneelse', email: 'ALICE@test.local', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/email/i);
  });

  it('requires an email and rejects invalid ones', async () => {
    const missing = await request(app)
      .post('/auth/signup')
      .send({ username: 'alice', password: 'password123' });
    const invalid = await request(app)
      .post('/auth/signup')
      .send({ username: 'alice', email: 'not-an-email', password: 'password123' });
    expect(missing.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it('rejects invalid usernames and short passwords', async () => {
    const badUsername = await request(app)
      .post('/auth/signup')
      .send({ username: 'a b!', email: 'a@test.local', password: 'password123' });
    expect(badUsername.status).toBe(400);

    const shortPassword = await request(app)
      .post('/auth/signup')
      .send({ username: 'alice', email: 'a@test.local', password: '123' });
    expect(shortPassword.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with the username', async () => {
    await signupUser(app, 'alice', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
  });

  it('logs in with the email address', async () => {
    await signupUser(app, 'alice', 'password123', 'alice@test.local');
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'Alice@Test.Local', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
  });

  it('rejects wrong password and unknown user with the same error', async () => {
    await signupUser(app, 'alice', 'password123');
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'wrong-password' });
    const unknownUser = await request(app)
      .post('/auth/login')
      .send({ identifier: 'nobody', password: 'password123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
  });
});

describe('POST /auth/forgot-password', () => {
  it('returns 503 when Firebase email auth is not configured (test env)', async () => {
    await signupUser(app, 'alice');
    const res = await request(app).post('/auth/forgot-password').send({ identifier: 'alice' });
    expect(res.status).toBe(503);
  });
});

describe('GET /auth/me', () => {
  it('returns the current user for a valid token', async () => {
    const { token } = await signupUser(app, 'alice');
    const res = await request(app).get('/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('alice');
  });

  it('rejects missing or malformed tokens', async () => {
    const missing = await request(app).get('/auth/me');
    const malformed = await request(app).get('/auth/me').set(auth('not-a-jwt'));
    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  async function loginPair() {
    await signupUser(app, 'alice', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'password123' });
    return res.body as { token: string; refreshToken: string };
  }

  it('rotates a valid refresh token into a new pair', async () => {
    const session = await loginPair();
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
    expect(res.body.refreshToken).not.toBe(session.refreshToken);

    const me = await request(app).get('/auth/me').set(auth(res.body.token));
    expect(me.status).toBe(200);
  });

  it('rejects garbage refresh tokens', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-token' });
    expect(res.status).toBe(401);
  });

  it('detects reuse of a rotated token and revokes all sessions', async () => {
    const session = await loginPair();
    const first = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(first.status).toBe(200);

    // Replaying the already-rotated token must fail…
    const replay = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(replay.status).toBe(401);

    // …and must also kill the token issued by the successful rotation.
    const cascade = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken });
    expect(cascade.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const session = await loginPair();
    const out = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: session.refreshToken });
    expect(out.status).toBe(200);

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });
});

describe('PUT /auth/device-token', () => {
  it('stores the FCM device token', async () => {
    const { token } = await signupUser(app, 'alice');
    const res = await request(app)
      .put('/auth/device-token')
      .set(auth(token))
      .send({ token: 'fcm-token-abc' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
