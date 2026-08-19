import { Ionicons } from '@expo/vector-icons';
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
import { colors } from '../../../lib/theme';
import { timeAgo } from '../../../lib/time';
import type { Comment } from '../../../lib/types';

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={comments.data ?? []}
        keyExtractor={(comment) => String(comment.id)}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerClassName="gap-3 px-5 py-4"
        ListHeaderComponent={
          <View className="mb-2 gap-4">
            <PostCard
              post={{ ...post.data, recentComments: [] }}
              onToggleLike={(p) => toggleLike.mutate(p)}
              onOpenComments={() => undefined}
              onPressAuthor={(username) => router.navigate({ pathname: '/', params: { username } })}
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
      />

      <View
        className="flex-row items-end gap-3 border-t border-foam/10 bg-abyss px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}
      >
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
    </KeyboardAvoidingView>
  );
}
