import { Router } from 'express';
import { ApiError } from '../../lib/errors';
import { authUser, requireAuth } from '../../middleware/auth';
import { parseBody } from '../../middleware/validate';
import { isTest } from '../../config';
import {
  deviceTokenSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
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

/** Step 1: email a 6-digit reset code. 404 when no such account exists. */
authRouter.post('/forgot-password', async (req, res) => {
  const { identifier } = parseBody(forgotPasswordSchema, req);
  const otp = await authService.requestPasswordResetOtp(identifier);
  // The OTP is only ever exposed to the test environment.
  res.json({ ok: true, ...(isTest && otp ? { devOtp: otp } : {}) });
});

/** Step 2: verify the code → short-lived reset token. */
authRouter.post('/verify-reset-otp', async (req, res) => {
  const { identifier, otp } = parseBody(verifyOtpSchema, req);
  res.json({ resetToken: await authService.verifyResetOtp(identifier, otp) });
});

/** Step 3: set the new password; all sessions are revoked. */
authRouter.post('/reset-password', async (req, res) => {
  const { resetToken, password } = parseBody(resetPasswordSchema, req);
  await authService.resetPassword(resetToken, password);
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
