import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PostCard } from '../../components/post-card';
import { EmptyState } from '../../components/ui';
import { useAuth } from '../../context/auth-context';
import { useFeed, useToggleLike } from '../../hooks/use-posts';
import type { Post } from '../../lib/types';

export default function FeedScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [filterInput, setFilterInput] = useState('');
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const params = useLocalSearchParams<{ username?: string }>();

  // Support deep-linking into a filtered feed (e.g. tapping an author elsewhere).
  useEffect(() => {
    if (params.username) {
      setFilterInput(params.username);
      setFilter(params.username);
    }
  }, [params.username]);

  const feed = useFeed(filter);
  const toggleLike = useToggleLike();

  const posts = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data]
  );

  function applyFilter() {
    const value = filterInput.trim().replace(/^@/, '');
    setFilter(value.length > 0 ? value : undefined);
  }

  function clearFilter() {
    setFilterInput('');
    setFilter(undefined);
  }

  function openComments(post: Post) {
    router.push({ pathname: '/post/[id]', params: { id: String(post.id) } });
  }

  return (
    <View className="flex-1 bg-surface-muted">
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => void logout()} hitSlop={8} accessibilityRole="button">
              <Text className="text-sm font-semibold text-ink-faint">
                @{user?.username} · Log out
              </Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <TextInput
          value={filterInput}
          onChangeText={setFilterInput}
          onSubmitEditing={applyFilter}
          placeholder="Filter by username…"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-surface px-4 text-base text-ink"
        />
        {filter ? (
          <Pressable
            onPress={clearFilter}
            className="h-11 items-center justify-center rounded-xl bg-slate-200 px-4 active:opacity-70"
          >
            <Text className="font-semibold text-ink-soft">Clear</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={applyFilter}
            className="h-11 items-center justify-center rounded-xl bg-brand px-4 active:bg-brand-dark"
          >
            <Text className="font-semibold text-white">Filter</Text>
          </Pressable>
        )}
      </View>

      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0EA5E9" />
        </View>
      ) : feed.isError ? (
        <EmptyState
          title="Couldn't load the feed"
          subtitle={feed.error instanceof Error ? feed.error.message : 'Please try again.'}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => String(post.id)}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={(post) => toggleLike.mutate(post)}
              onOpenComments={openComments}
              onPressAuthor={(username) => {
                setFilterInput(username);
                setFilter(username);
              }}
            />
          )}
          contentContainerClassName="gap-3 p-4 pb-28"
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor="#0EA5E9"
            />
          }
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) {
              void feed.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <EmptyState
              title={filter ? `No posts by @${filter}` : 'No posts yet'}
              subtitle={filter ? 'Try another username.' : 'Be the first to make a ripple!'}
            />
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator className="py-4" color="#0EA5E9" />
            ) : null
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create post"
        onPress={() => router.push('/create')}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-brand shadow-lg shadow-sky-300 active:bg-brand-dark"
      >
        <Text className="text-3xl leading-9 text-white">+</Text>
      </Pressable>
    </View>
  );
}
