import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, Post } from '../lib/types';

const PAGE_SIZE = 10;

const postKeys = {
  feeds: ['feed'] as const,
  feed: (username?: string) => ['feed', username?.toLowerCase() ?? 'all'] as const,
  post: (id: number) => ['post', id] as const,
  comments: (id: number) => ['comments', id] as const,
};

export function useFeed(username?: string) {
  return useInfiniteQuery({
    queryKey: postKeys.feed(username),
    queryFn: ({ pageParam }) =>
      api.getFeed({ page: pageParam, limit: PAGE_SIZE, ...(username ? { username } : {}) }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    // Keep the shared feed fresh: other users' posts/likes/comments show up
    // within seconds without a manual pull-to-refresh.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function usePost(postId: number) {
  return useQuery({
    queryKey: postKeys.post(postId),
    queryFn: () => api.getPost(postId),
    select: (data) => data.post,
  });
}

export function useComments(postId: number) {
  return useQuery({
    queryKey: postKeys.comments(postId),
    queryFn: () => api.getComments(postId),
    select: (data) => data.comments,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.createPost(content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: postKeys.feeds }),
  });
}

type FeedData = InfiniteData<Paginated<Post>>;

function patchPost(post: Post, liked: boolean): Post {
  return {
    ...post,
    likedByMe: liked,
    likeCount: post.likeCount + (liked ? 1 : -1),
  };
}

/** Like/unlike with optimistic updates across every cached feed and the post detail. */
export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (post: Post) => api.toggleLike(post.id),

    onMutate: async (post) => {
      const liked = !post.likedByMe;
      await queryClient.cancelQueries({ queryKey: postKeys.feeds });
      await queryClient.cancelQueries({ queryKey: postKeys.post(post.id) });

      const previousFeeds = queryClient.getQueriesData<FeedData>({ queryKey: postKeys.feeds });
      const previousPost = queryClient.getQueryData<{ post: Post }>(postKeys.post(post.id));

      queryClient.setQueriesData<FeedData>({ queryKey: postKeys.feeds }, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.map((item) =>
                  item.id === post.id ? patchPost(item, liked) : item
                ),
              })),
            }
          : data
      );
      if (previousPost) {
        queryClient.setQueryData(postKeys.post(post.id), {
          post: patchPost(previousPost.post, liked),
        });
      }

      return { previousFeeds, previousPost };
    },

    onError: (_err, post, context) => {
      context?.previousFeeds?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (context?.previousPost) {
        queryClient.setQueryData(postKeys.post(post.id), context.previousPost);
      }
    },

    onSettled: (_data, _err, post) => {
      void queryClient.invalidateQueries({ queryKey: postKeys.feeds });
      void queryClient.invalidateQueries({ queryKey: postKeys.post(post.id) });
    },
  });
}

export function useAddComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.addComment(postId, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: postKeys.comments(postId) });
      void queryClient.invalidateQueries({ queryKey: postKeys.post(postId) });
      void queryClient.invalidateQueries({ queryKey: postKeys.feeds });
    },
  });
}
