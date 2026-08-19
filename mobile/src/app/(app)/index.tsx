import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PostCard } from '../../components/post-card';
import { useToast } from '../../components/toast';
import { EmptyState, Wordmark } from '../../components/ui';
import { useAuth } from '../../context/auth-context';
import {
  useDeletePost,
  useFeed,
  useNotifications,
  useToggleLike,
} from '../../hooks/use-posts';
import { colors } from '../../lib/theme';
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
  const deletePost = useDeletePost();
  const notifications = useNotifications();
  const toast = useToast();

  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const unreadCount = notifications.data?.pages[0]?.unreadCount ?? 0;

  function confirmDelete(post: Post) {
    Alert.alert('Delete this thought?', 'It disappears for everyone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deletePost.mutate(post.id, {
            onSuccess: () => toast.show('Post deleted'),
            onError: (err) =>
              toast.show(err instanceof Error ? err.message : 'Delete failed', 'error'),
          }),
      },
    ]);
  }

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
    <View className="flex-1 bg-abyss">
      <Stack.Screen
        options={{
          headerTitle: () => <Wordmark size={22} />,
          headerRight: () => (
            <View className="flex-row items-center gap-5">
              <Pressable
                onPress={() => router.push('/notifications')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
                }
              >
                <Ionicons name="notifications-outline" size={21} color={colors.mist} />
                {unreadCount > 0 ? (
                  <View className="absolute -right-1.5 -top-1 min-w-[16px] items-center rounded-full bg-koi px-1">
                    <Text className="font-displaymed text-[10px] leading-4 text-abyss">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => void logout()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Log out ${user?.username ?? ''}`}
                className="flex-row items-center gap-2"
              >
                <Text className="font-displaymed text-xs text-mist">{user?.username}</Text>
                <Ionicons name="log-out-outline" size={20} color={colors.mist} />
              </Pressable>
            </View>
          ),
        }}
      />

      <View className="px-5 pb-3 pt-2">
        <View className="h-12 flex-row items-center gap-2.5 rounded-full border border-foam/10 bg-depth px-4">
          <Ionicons name="search" size={16} color={colors.mist} />
          <TextInput
            value={filterInput}
            onChangeText={setFilterInput}
            onSubmitEditing={applyFilter}
            placeholder="Filter by username"
            placeholderTextColor="rgba(126,153,149,0.6)"
            selectionColor={colors.koi}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 font-body text-[15px] text-foam"
          />
          {filterInput.length > 0 || filter ? (
            <Pressable onPress={clearFilter} hitSlop={10} accessibilityLabel="Clear filter">
              <Ionicons name="close-circle" size={18} color={colors.mist} />
            </Pressable>
          ) : null}
        </View>
        {filter ? (
          <Text className="mt-2 px-1 font-displaymed text-xs text-glint">
            Showing thoughts from {filter}
          </Text>
        ) : null}
      </View>

      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.glint} />
        </View>
      ) : feed.isError ? (
        <EmptyState
          title="The feed didn't load"
          subtitle={
            feed.error instanceof Error ? feed.error.message : 'Check your connection and retry.'
          }
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
              {...(item.author.id === user?.id ? { onDelete: confirmDelete } : {})}
            />
          )}
          contentContainerClassName="gap-3.5 px-5 pb-32 pt-1"
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => void feed.refetch()}
              tintColor={colors.glint}
              colors={[colors.glint]}
              progressBackgroundColor={colors.depth}
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
              title={filter ? `Nothing from ${filter} yet` : 'Still water'}
              subtitle={
                filter ? 'Try another username.' : 'Drop the first thought and watch it spread.'
              }
            />
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator className="py-4" color={colors.glint} />
            ) : null
          }
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="New thought"
        onPress={() => router.push('/create')}
        className="absolute bottom-9 right-6 h-16 w-16 items-center justify-center rounded-full bg-koi active:bg-koi-deep"
        style={{
          shadowColor: colors.koi,
          shadowOpacity: 0.45,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}
      >
        <Ionicons name="add" size={30} color={colors.abyss} />
      </Pressable>
    </View>
  );
}
