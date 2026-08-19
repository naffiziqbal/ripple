import type { Request } from 'express';
import type { z } from 'zod';
import { ApiError } from '../lib/errors';

/** Parse and type a request body against a Zod schema, 400 on failure. */
export function parseBody<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw ApiError.badRequest('Validation failed', result.error.flatten().fieldErrors);
  }
  return result.data;
}

/** Parse and type request query params against a Zod schema, 400 on failure. */
export function parseQuery<T extends z.ZodTypeAny>(schema: T, req: Request): z.infer<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw ApiError.badRequest('Invalid query parameters', result.error.flatten().fieldErrors);
  }
  return result.data;
}

/** Parse a numeric route param (e.g. /posts/:id), 400 on non-numeric input. */
export function parseIdParam(req: Request, name = 'id'): number {
  const raw = req.params[name];
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(`Route parameter "${name}" must be a positive integer`);
  }
  return id;
}
