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
      .send({ username: 'alice', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user).toMatchObject({ username: 'alice' });
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rejects duplicate usernames case-insensitively', async () => {
    await signupUser(app, 'alice');
    const res = await request(app)
      .post('/auth/signup')
      .send({ username: 'ALICE', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid usernames and short passwords', async () => {
    const badUsername = await request(app)
      .post('/auth/signup')
      .send({ username: 'a b!', password: 'password123' });
    expect(badUsername.status).toBe(400);

    const shortPassword = await request(app)
      .post('/auth/signup')
      .send({ username: 'alice', password: '123' });
    expect(shortPassword.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials', async () => {
    await signupUser(app, 'alice', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
  });

  it('rejects wrong password and unknown user with the same error', async () => {
    await signupUser(app, 'alice', 'password123');
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ username: 'alice', password: 'wrong-password' });
    const unknownUser = await request(app)
      .post('/auth/login')
      .send({ username: 'nobody', password: 'password123' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownUser.body.error);
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
