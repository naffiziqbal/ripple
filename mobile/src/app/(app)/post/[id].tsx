import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, PostCard } from '../../../components/post-card';
import { EmptyState } from '../../../components/ui';
import { useAddComment, useComments, usePost, useToggleLike } from '../../../hooks/use-posts';
import { timeAgo } from '../../../lib/time';
import type { Comment } from '../../../lib/types';

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <View className="flex-row gap-3 rounded-2xl bg-surface p-4">
      <Avatar username={comment.author.username} size="sm" />
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-sm font-semibold text-ink">@{comment.author.username}</Text>
          <Text className="text-xs text-ink-faint">{timeAgo(comment.createdAt)}</Text>
        </View>
        <Text className="text-base leading-6 text-ink">{comment.content}</Text>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const post = usePost(postId);
  const comments = useComments(postId);
  const toggleLike = useToggleLike();
  const addComment = useAddComment(postId);
  const [draft, setDraft] = useState('');

  const canSend = draft.trim().length > 0 && !addComment.isPending;

  function handleSend() {
    if (!canSend) return;
    addComment.mutate(draft.trim(), { onSuccess: () => setDraft('') });
  }

  if (post.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-muted">
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  if (post.isError || !post.data) {
    return (
      <View className="flex-1 bg-surface-muted">
        <EmptyState
          title="Post not found"
          subtitle={post.error instanceof Error ? post.error.message : undefined}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-muted"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(comment) => String(comment.id)}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerClassName="gap-3 p-4"
        ListHeaderComponent={
          <View className="mb-1 gap-3">
            <PostCard
              post={{ ...post.data, recentComments: [] }}
              onToggleLike={(p) => toggleLike.mutate(p)}
              onOpenComments={() => undefined}
              onPressAuthor={(username) =>
                router.navigate({ pathname: '/', params: { username } })
              }
            />
            <Text className="px-1 text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Comments ({post.data.commentCount})
            </Text>
          </View>
        }
        ListEmptyComponent={
          comments.isLoading ? (
            <ActivityIndicator className="py-6" color="#0EA5E9" />
          ) : (
            <EmptyState title="No comments yet" subtitle="Start the conversation." />
          )
        }
      />

      <View
        className="flex-row items-end gap-2 border-t border-slate-200 bg-surface px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor="#94A3B8"
          multiline
          maxLength={300}
          className="max-h-28 flex-1 rounded-2xl bg-surface-muted px-4 py-3 text-base text-ink"
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          className={`h-11 items-center justify-center rounded-full bg-brand px-5 ${canSend ? 'active:bg-brand-dark' : 'opacity-40'}`}
        >
          <Text className="font-semibold text-white">
            {addComment.isPending ? '…' : 'Send'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
