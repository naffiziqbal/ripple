import { Router } from 'express';
import { ApiError } from '../../lib/errors';
import { authUser, requireAuth } from '../../middleware/auth';
import { parseBody } from '../../middleware/validate';
import {
  deviceTokenSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  signupSchema,
} from './auth.schemas';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const input = parseBody(signupSchema, req);
  const result = await authService.signup(input);
  res.status(201).json(result);
});

/** Log in with username or email as the identifier. */
authRouter.post('/login', async (req, res) => {
  const input = parseBody(loginSchema, req);
  const result = await authService.login(input);
  res.json(result);
});

/** Send Firebase's password-reset email. Always 200 (no account enumeration). */
authRouter.post('/forgot-password', async (req, res) => {
  const { identifier } = parseBody(forgotPasswordSchema, req);
  await authService.forgotPassword(identifier);
  res.json({ ok: true });
});

/** Exchange a valid refresh token for a fresh access + refresh pair. */
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = parseBody(refreshTokenSchema, req);
  res.json(await authService.rotateRefreshToken(refreshToken));
});

/** Revoke the session's refresh token. */
authRouter.post('/logout', async (req, res) => {
  const { refreshToken } = parseBody(refreshTokenSchema, req);
  await authService.revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await authService.findUserById(authUser(req).id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.json({ user: authService.toUserDto(user) });
});

/** Register the device's FCM token so the user can receive push notifications. */
authRouter.put('/device-token', requireAuth, async (req, res) => {
  const { token } = parseBody(deviceTokenSchema, req);
  await authService.saveDeviceToken(authUser(req).id, token);
  res.json({ ok: true });
});
