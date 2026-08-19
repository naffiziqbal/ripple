import { Router } from 'express';
import { authUser, requireAuth } from '../../middleware/auth';
import { parseBody, parseIdParam, parseQuery } from '../../middleware/validate';
import {
  commentsQuerySchema,
  createCommentSchema,
  createPostSchema,
  feedQuerySchema,
} from './posts.schemas';
import * as postsService from './posts.service';

export const postsRouter = Router();

postsRouter.use(requireAuth);

/** GET /posts — paginated feed, newest first; ?username= filters by author. */
postsRouter.get('/', async (req, res) => {
  const query = parseQuery(feedQuerySchema, req);
  res.json(await postsService.getFeed(query, authUser(req)));
});

/** POST /posts — create a text-only post. */
postsRouter.post('/', async (req, res) => {
  const { content } = parseBody(createPostSchema, req);
  res.status(201).json({ post: await postsService.createPost(authUser(req), content) });
});

/** GET /posts/:id — single post with counts. */
postsRouter.get('/:id', async (req, res) => {
  res.json({ post: await postsService.getPost(parseIdParam(req), authUser(req)) });
});

/** DELETE /posts/:id — delete your own post. */
postsRouter.delete('/:id', async (req, res) => {
  await postsService.deletePost(parseIdParam(req), authUser(req));
  res.json({ ok: true });
});

/** POST /posts/:id/like — toggle like/unlike. */
postsRouter.post('/:id/like', async (req, res) => {
  res.json(await postsService.toggleLike(parseIdParam(req), authUser(req)));
});

/** POST /posts/:id/comment — add a comment. */
postsRouter.post('/:id/comment', async (req, res) => {
  const { content } = parseBody(createCommentSchema, req);
  res
    .status(201)
    .json({ comment: await postsService.addComment(parseIdParam(req), authUser(req), content) });
});

/** GET /posts/:id/comments — paginated comment list, oldest first. */
postsRouter.get('/:id/comments', async (req, res) => {
  const { page, limit } = parseQuery(commentsQuerySchema, req);
  res.json(await postsService.getComments(parseIdParam(req), page, limit));
});
