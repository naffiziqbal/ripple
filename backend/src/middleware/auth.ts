import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../lib/errors';
import type { AuthUser } from '../types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, username: user.username }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    throw ApiError.unauthorized('Missing bearer token');
  }
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload & AuthUser;
    req.user = { id: payload.id, username: payload.username };
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  next();
}

/** Narrowing helper so route handlers get a non-optional user after requireAuth. */
export function authUser(req: Request): AuthUser {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
}
