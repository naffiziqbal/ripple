import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ErrorBanner } from '../../components/ui';
import { useCreatePost } from '../../hooks/use-posts';

const MAX_LENGTH = 500;

export default function CreatePostScreen() {
  const router = useRouter();
  const createPost = useCreatePost();
  const [content, setContent] = useState('');

  const remaining = MAX_LENGTH - content.length;
  const canPost = content.trim().length > 0 && remaining >= 0 && !createPost.isPending;

  function handlePost() {
    if (!canPost) return;
    createPost.mutate(content.trim(), {
      onSuccess: () => router.back(),
    });
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handlePost}
              disabled={!canPost}
              accessibilityRole="button"
              className={`rounded-full bg-brand px-4 py-1.5 ${canPost ? '' : 'opacity-40'}`}
            >
              <Text className="font-semibold text-white">
                {createPost.isPending ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 gap-3 p-4">
        <ErrorBanner
          message={
            createPost.isError
              ? createPost.error instanceof Error
                ? createPost.error.message
                : 'Failed to publish'
              : null
          }
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What's making waves?"
          placeholderTextColor="#94A3B8"
          multiline
          autoFocus
          maxLength={MAX_LENGTH + 50}
          textAlignVertical="top"
          className="flex-1 text-lg leading-7 text-ink"
        />
        <Text className={`text-right text-sm ${remaining < 0 ? 'text-red-500' : 'text-ink-faint'}`}>
          {remaining}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
