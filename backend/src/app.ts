import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { isTest } from './config';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { notificationsRouter } from './modules/notifications/notifications.router';
import { postsRouter } from './modules/posts/posts.router';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  if (!isTest) {
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
      })
    );
    // Tighter guard on credential endpoints against brute-forcing.
    const authLimiter = rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Too many attempts, try again in a minute' },
    });
    app.use('/auth/login', authLimiter);
    app.use('/auth/signup', authLimiter);
    app.use('/auth/forgot-password', authLimiter);
    app.use('/auth/verify-reset-otp', authLimiter);
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/posts', postsRouter);
  app.use('/notifications', notificationsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
