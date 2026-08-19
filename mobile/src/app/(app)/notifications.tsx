import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Avatar } from '../../components/post-card';
import { EmptyState } from '../../components/ui';
import { useMarkNotificationsRead, useNotifications } from '../../hooks/use-posts';
import { colors } from '../../lib/theme';
import { timeAgo } from '../../lib/time';
import type { AppNotification } from '../../lib/types';

function NotificationRow({
  notification,
  onPress,
}: {
  notification: AppNotification;
  onPress: () => void;
}) {
  const verb = notification.type === 'like' ? 'liked your post' : 'commented on your post';
  const icon = notification.type === 'like' ? 'heart' : 'chatbubble';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-70 ${
        notification.read ? 'border-foam/5 bg-depth' : 'border-koi/20 bg-raised'
      }`}
    >
      <View>
        <Avatar username={notification.actor.username} />
        <View className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full bg-abyss">
          <Ionicons
            name={icon}
            size={11}
            color={notification.type === 'like' ? colors.koi : colors.glint}
          />
        </View>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-body text-[15px] leading-5 text-foam">
          <Text className="font-bodybold">{notification.actor.username}</Text> {verb}
        </Text>
        <Text className="font-body text-sm text-mist" numberOfLines={1}>
          “{notification.postPreview}”
        </Text>
      </View>
      <Text className="font-displaymed text-xs text-mist">{timeAgo(notification.createdAt)}</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();

  const items = useMemo(
    () => notifications.data?.pages.flatMap((page) => page.items) ?? [],
    [notifications.data]
  );

  // Opening the screen clears the unread badge.
  useEffect(() => {
    if ((notifications.data?.pages[0]?.unreadCount ?? 0) > 0) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.data?.pages[0]?.unreadCount]);

  if (notifications.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-abyss">
        <ActivityIndicator size="large" color={colors.glint} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-abyss">
      <FlatList
        data={items}
        keyExtractor={(notification) => String(notification.id)}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onPress={() =>
              router.push({ pathname: '/post/[id]', params: { id: String(item.postId) } })
            }
          />
        )}
        contentContainerClassName="gap-3 p-5"
        onEndReached={() => {
          if (notifications.hasNextPage && !notifications.isFetchingNextPage) {
            void notifications.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <EmptyState
            title="All quiet on the water"
            subtitle="Likes and comments on your posts land here."
          />
        }
        ListFooterComponent={
          notifications.isFetchingNextPage ? (
            <ActivityIndicator className="py-4" color={colors.glint} />
          ) : null
        }
      />
    </View>
  );
}
