import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { getNotificationsModule } from '../../lib/notifications';
import { colors, fonts } from '../../lib/theme';

export default function AppLayout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Push notifications (dev builds only — Expo Go and web can't receive them):
  // a push arriving means someone interacted, so refresh server state right away;
  // tapping a push opens the relevant post.
  useEffect(() => {
    const notifications = getNotificationsModule();
    if (!notifications) return;

    const received = notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries();
    });
    const tapped = notifications.addNotificationResponseReceivedListener((response) => {
      const postId = response.notification.request.content.data?.postId;
      if (postId) {
        router.push({ pathname: '/post/[id]', params: { id: String(postId) } });
      }
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [router, queryClient]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.abyss },
        headerShadowVisible: false,
        headerTintColor: colors.foam,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 17, color: colors.foam },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.abyss },
      }}
    >
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="create" options={{ title: 'New thought', presentation: 'modal' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Thread' }} />
    </Stack>
  );
}
