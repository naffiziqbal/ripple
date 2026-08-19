import { z } from 'zod';

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Post content cannot be empty')
    .max(500, 'Post content is limited to 500 characters'),
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(300, 'Comments are limited to 300 characters'),
});

export const commentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const feedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  /** Optional feed filter: only posts authored by this username. */
  username: z.string().trim().min(1).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
