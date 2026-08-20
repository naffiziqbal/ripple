import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { confirmDestructive } from '../../../lib/confirm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, PostCard } from '../../../components/post-card';
import { useToast } from '../../../components/toast';
import { EmptyState } from '../../../components/ui';
import { useAuth } from '../../../context/auth-context';
import { useHeaderOffset } from '../../../lib/layout';
import {
  useAddComment,
  useComments,
  useDeletePost,
  usePost,
  useToggleLike,
} from '../../../hooks/use-posts';
import { colors } from '../../../lib/theme';
import { timeAgo } from '../../../lib/time';
import type { Comment, Post } from '../../../lib/types';

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <View className="flex-row gap-3 rounded-2xl border border-foam/5 bg-depth p-4">
      <Avatar username={comment.author.username} size="sm" />
      <View className="flex-1 gap-1">
        <View className="flex-row items-baseline gap-2">
          <Text className="font-display text-sm text-foam">{comment.author.username}</Text>
          <Text className="font-displaymed text-xs text-mist">{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text className="font-body text-[15px] leading-[22px] text-foam">{comment.content}</Text>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderOffset();
  const toast = useToast();
  const { user } = useAuth();

  const post = usePost(postId);
  const comments = useComments(postId);
  const toggleLike = useToggleLike();
  const deletePost = useDeletePost();
  const addComment = useAddComment(postId);
  const [draft, setDraft] = useState('');

  const commentItems = useMemo(
    () => comments.data?.pages.flatMap((page) => page.items) ?? [],
    [comments.data]
  );

  const canSend = draft.trim().length > 0 && !addComment.isPending;

  function handleSend() {
    if (!canSend) return;
    addComment.mutate(draft.trim(), {
      onSuccess: () => setDraft(''),
      onError: (err) =>
        toast.show(err instanceof Error ? err.message : 'Comment failed to send', 'error'),
    });
  }

  function confirmDelete(target: Post) {
    confirmDestructive({
      title: 'Delete this thought?',
      message: 'It disappears for everyone.',
      confirmLabel: 'Delete',
      onConfirm: () =>
        deletePost.mutate(target.id, {
          onSuccess: () => {
            toast.show('Post deleted');
            router.back();
          },
          onError: (err) =>
            toast.show(err instanceof Error ? err.message : 'Delete failed', 'error'),
        }),
    });
  }

  if (post.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-abyss">
        <ActivityIndicator size="large" color={colors.glint} />
      </View>
    );
  }

  if (post.isError || !post.data) {
    return (
      <View className="flex-1 bg-abyss">
        <EmptyState
          title="This post is gone"
          subtitle={post.error instanceof Error ? post.error.message : undefined}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-abyss"
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        data={commentItems}
        keyExtractor={(comment) => String(comment.id)}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerClassName="w-full max-w-[640px] gap-3 self-center px-5 py-4"
        ListHeaderComponent={
          <View className="mb-2 gap-4">
            <PostCard
              post={{ ...post.data, recentComments: [] }}
              onToggleLike={(p) => toggleLike.mutate(p)}
              onOpenComments={() => undefined}
              onPressAuthor={(username) => router.navigate({ pathname: '/', params: { username } })}
              {...(post.data.author.id === user?.id ? { onDelete: confirmDelete } : {})}
            />
            <Text className="px-1 font-displaymed text-xs uppercase tracking-[2px] text-mist">
              Comments · {post.data.commentCount}
            </Text>
          </View>
        }
        ListEmptyComponent={
          comments.isLoading ? (
            <ActivityIndicator className="py-6" color={colors.glint} />
          ) : (
            <EmptyState title="No comments yet" subtitle="Say the first thing." />
          )
        }
        ListFooterComponent={
          comments.hasNextPage ? (
            <Pressable
              onPress={() => void comments.fetchNextPage()}
              disabled={comments.isFetchingNextPage}
              accessibilityRole="button"
              className="items-center rounded-2xl border border-foam/10 py-3 active:bg-foam/5"
            >
              {comments.isFetchingNextPage ? (
                <ActivityIndicator color={colors.glint} />
              ) : (
                <Text className="font-display text-sm text-glint">Show more comments</Text>
              )}
            </Pressable>
          ) : null
        }
      />

      <View
        className="border-t border-foam/10 bg-abyss px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}
      >
        <View className="w-full max-w-[640px] flex-row items-end gap-3 self-center">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment"
          placeholderTextColor="rgba(126,153,149,0.6)"
          selectionColor={colors.koi}
          keyboardAppearance="dark"
          multiline
          maxLength={300}
          className="max-h-28 flex-1 rounded-3xl border border-foam/10 bg-depth px-4 py-3 font-body text-[15px] text-foam"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          className={`h-12 w-12 items-center justify-center rounded-full bg-koi ${
            canSend ? 'active:bg-koi-deep' : 'opacity-40'
          }`}
        >
          {addComment.isPending ? (
            <ActivityIndicator size="small" color={colors.abyss} />
          ) : (
            <Ionicons name="arrow-up" size={22} color={colors.abyss} />
          )}
        </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
