import { Pressable, Text, View } from 'react-native';
import { timeAgo } from '../lib/time';
import type { Post } from '../lib/types';

interface PostCardProps {
  post: Post;
  onToggleLike: (post: Post) => void;
  onOpenComments: (post: Post) => void;
  onPressAuthor?: (username: string) => void;
}

export function Avatar({ username, size = 'md' }: { username: string; size?: 'sm' | 'md' }) {
  const initial = username.charAt(0).toUpperCase();
  const box = size === 'md' ? 'h-10 w-10' : 'h-7 w-7';
  const text = size === 'md' ? 'text-base' : 'text-xs';
  return (
    <View className={`${box} items-center justify-center rounded-full bg-brand-light`}>
      <Text className={`${text} font-bold text-brand-dark`}>{initial}</Text>
    </View>
  );
}

export function PostCard({ post, onToggleLike, onOpenComments, onPressAuthor }: PostCardProps) {
  return (
    <View className="gap-3 rounded-2xl bg-surface p-4 shadow-sm shadow-slate-200">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => onPressAuthor?.(post.author.username)} hitSlop={8}>
          <Avatar username={post.author.username} />
        </Pressable>
        <View className="flex-1">
          <Pressable onPress={() => onPressAuthor?.(post.author.username)} hitSlop={8}>
            <Text className="text-base font-semibold text-ink">@{post.author.username}</Text>
          </Pressable>
          <Text className="text-xs text-ink-faint">{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      <Text className="text-base leading-6 text-ink">{post.content}</Text>

      <View className="flex-row items-center gap-6 border-t border-slate-100 pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Unlike' : 'Like'}
          onPress={() => onToggleLike(post)}
          hitSlop={8}
          className="flex-row items-center gap-1.5 active:opacity-60"
        >
          <Text className="text-lg">{post.likedByMe ? '❤️' : '🤍'}</Text>
          <Text
            className={`text-sm font-medium ${post.likedByMe ? 'text-red-500' : 'text-ink-soft'}`}
          >
            {post.likeCount}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          onPress={() => onOpenComments(post)}
          hitSlop={8}
          className="flex-row items-center gap-1.5 active:opacity-60"
        >
          <Text className="text-lg">💬</Text>
          <Text className="text-sm font-medium text-ink-soft">{post.commentCount}</Text>
        </Pressable>
      </View>

      {post.recentComments.length > 0 ? (
        <Pressable onPress={() => onOpenComments(post)} className="gap-2 rounded-xl bg-surface-muted p-3">
          {post.recentComments.map((comment) => (
            <View key={comment.id} className="flex-row gap-2">
              <Text className="text-sm font-semibold text-ink">@{comment.author.username}</Text>
              <Text className="flex-1 text-sm text-ink-soft" numberOfLines={2}>
                {comment.content}
              </Text>
            </View>
          ))}
          {post.commentCount > post.recentComments.length ? (
            <Text className="text-xs font-medium text-brand">
              View all {post.commentCount} comments
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
