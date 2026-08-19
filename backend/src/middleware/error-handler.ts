import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors';
import { isProduction } from '../config';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(isProduction ? {} : { details: err instanceof Error ? err.message : String(err) }),
  });
}
