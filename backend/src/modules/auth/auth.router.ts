import { Router } from 'express';
import { ApiError } from '../../lib/errors';
import { authUser, requireAuth } from '../../middleware/auth';
import { parseBody } from '../../middleware/validate';
import { credentialsSchema, deviceTokenSchema, loginSchema } from './auth.schemas';
import * as authService from './auth.service';

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const credentials = parseBody(credentialsSchema, req);
  const result = await authService.signup(credentials);
  res.status(201).json(result);
});

authRouter.post('/login', async (req, res) => {
  const credentials = parseBody(loginSchema, req);
  const result = await authService.login(credentials);
  res.json(result);
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
