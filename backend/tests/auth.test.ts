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

describe('password reset via OTP', () => {
  async function requestOtp(identifier: string): Promise<string | undefined> {
    const res = await request(app).post('/auth/forgot-password').send({ identifier });
    expect(res.status).toBe(200);
    return res.body.devOtp;
  }

  it('completes the full flow: request → verify → reset → login with new password', async () => {
    await signupUser(app, 'alice', 'password123', 'alice@test.local');
    const otp = await requestOtp('alice');
    expect(otp).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post('/auth/verify-reset-otp')
      .send({ identifier: 'alice', otp });
    expect(verify.status).toBe(200);
    const { resetToken } = verify.body;

    const reset = await request(app)
      .post('/auth/reset-password')
      .send({ resetToken, password: 'newpassword456' });
    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'newpassword456' });
    expect(newLogin.status).toBe(200);
  });

  it('revokes existing sessions on reset', async () => {
    const { token: _ } = await signupUser(app, 'alice');
    const session = await request(app)
      .post('/auth/login')
      .send({ identifier: 'alice', password: 'password123' });
    const otp = await requestOtp('alice');
    const { resetToken } = (
      await request(app).post('/auth/verify-reset-otp').send({ identifier: 'alice', otp })
    ).body;
    await request(app).post('/auth/reset-password').send({ resetToken, password: 'newpassword456' });

    const refresh = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: session.body.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('locks the code after five wrong attempts', async () => {
    await signupUser(app, 'alice');
    const otp = await requestOtp('alice');
    const wrong = otp === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/auth/verify-reset-otp')
        .send({ identifier: 'alice', otp: wrong });
      expect(res.status).toBe(401);
    }
    // Even the right code is now refused.
    const res = await request(app)
      .post('/auth/verify-reset-otp')
      .send({ identifier: 'alice', otp });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/attempts/i);
  });

  it('consumes the code on success', async () => {
    await signupUser(app, 'alice');
    const otp = await requestOtp('alice');
    await request(app).post('/auth/verify-reset-otp').send({ identifier: 'alice', otp });
    const replay = await request(app)
      .post('/auth/verify-reset-otp')
      .send({ identifier: 'alice', otp });
    expect(replay.status).toBe(401);
  });

  it('tells the user when no account matches the identifier', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ identifier: 'ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no account found/i);
  });

  it('rejects reset with a bad or non-reset token', async () => {
    const { token } = await signupUser(app, 'alice'); // ordinary access token
    const badToken = await request(app)
      .post('/auth/reset-password')
      .send({ resetToken: 'garbage', password: 'newpassword456' });
    const wrongPurpose = await request(app)
      .post('/auth/reset-password')
      .send({ resetToken: token, password: 'newpassword456' });
    expect(badToken.status).toBe(401);
    expect(wrongPurpose.status).toBe(401);
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
