import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function AppLayout() {
  const router = useRouter();

  // Tapping a like/comment push opens the relevant post.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const postId = response.notification.request.content.data?.postId;
      if (postId) {
        router.push({ pathname: '/post/[id]', params: { id: String(postId) } });
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#F1F5F9' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ripple' }} />
      <Stack.Screen name="create" options={{ title: 'New post', presentation: 'modal' }} />
      <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
    </Stack>
  );
}
