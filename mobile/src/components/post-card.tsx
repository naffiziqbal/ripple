import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { timeAgo } from '../lib/time';
import { colors } from '../lib/theme';
import type { Post } from '../lib/types';
import { LikeButton } from './like-button';

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
    <View
      className={`${box} items-center justify-center rounded-full border border-foam/10 bg-raised`}
    >
      <Text className={`${text} font-display text-foam`}>{initial}</Text>
    </View>
  );
}

export function PostCard({ post, onToggleLike, onOpenComments, onPressAuthor }: PostCardProps) {
  return (
    <View className="gap-4 rounded-3xl border border-foam/5 bg-depth p-5">
      <View className="flex-row items-center gap-3">
        <Pressable onPress={() => onPressAuthor?.(post.author.username)} hitSlop={8}>
          <Avatar username={post.author.username} />
        </Pressable>
        <View className="flex-1 flex-row items-baseline gap-2">
          <Pressable onPress={() => onPressAuthor?.(post.author.username)} hitSlop={8}>
            <Text className="font-display text-[15px] text-foam">{post.author.username}</Text>
          </Pressable>
          <Text className="font-displaymed text-xs text-mist">· {timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      <Text className="font-body text-[17px] leading-[26px] text-foam">{post.content}</Text>

      <View className="flex-row items-center gap-7">
        <LikeButton
          liked={post.likedByMe}
          count={post.likeCount}
          onPress={() => onToggleLike(post)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          onPress={() => onOpenComments(post)}
          hitSlop={10}
          className="flex-row items-center gap-2"
        >
          <Ionicons name="chatbubble-outline" size={20} color={colors.mist} />
          <Text className="font-displaymed text-sm text-mist">{post.commentCount}</Text>
        </Pressable>
      </View>

      {post.recentComments.length > 0 ? (
        <Pressable
          onPress={() => onOpenComments(post)}
          className="gap-2.5 rounded-2xl bg-abyss/60 p-4"
        >
          {post.recentComments.map((comment) => (
            <View key={comment.id} className="flex-row gap-2">
              <Text className="font-bodybold text-sm text-foam">{comment.author.username}</Text>
              <Text className="flex-1 font-body text-sm leading-5 text-mist" numberOfLines={2}>
                {comment.content}
              </Text>
            </View>
          ))}
          {post.commentCount > post.recentComments.length ? (
            <Text className="font-displaymed text-xs text-glint">
              View all {post.commentCount} comments
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}
