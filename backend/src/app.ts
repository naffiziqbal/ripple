import cors from 'cors';
import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.router';
import { postsRouter } from './modules/posts/posts.router';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/posts', postsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
