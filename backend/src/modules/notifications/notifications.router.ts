import { Router } from 'express';
import { z } from 'zod';
import { authUser, requireAuth } from '../../middleware/auth';
import { parseQuery } from '../../middleware/validate';
import * as center from './notifications.center';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

/** GET /notifications — the viewer's interaction history, newest first. */
notificationsRouter.get('/', async (req, res) => {
  const { page, limit } = parseQuery(listQuerySchema, req);
  res.json(await center.listNotifications(authUser(req), page, limit));
});

/** POST /notifications/read-all — clear the unread badge. */
notificationsRouter.post('/read-all', async (req, res) => {
  await center.markAllRead(authUser(req));
  res.json({ ok: true });
});
