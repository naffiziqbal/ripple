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
import { colors } from '../../lib/theme';

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
      className="flex-1 bg-abyss"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={handlePost}
              disabled={!canPost}
              accessibilityRole="button"
              className={`rounded-full bg-koi px-5 py-2 ${canPost ? 'active:bg-koi-deep' : 'opacity-40'}`}
            >
              <Text className="font-display text-sm text-abyss">
                {createPost.isPending ? 'Posting…' : 'Post'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 gap-4 p-5">
        <ErrorBanner
          message={
            createPost.isError
              ? createPost.error instanceof Error
                ? createPost.error.message
                : 'Post failed to publish'
              : null
          }
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What's on your mind?"
          placeholderTextColor="rgba(126,153,149,0.6)"
          selectionColor={colors.koi}
          keyboardAppearance="dark"
          multiline
          autoFocus
          maxLength={MAX_LENGTH + 50}
          textAlignVertical="top"
          className="flex-1 font-body text-xl leading-8 text-foam"
        />
        <Text
          className={`text-right font-displaymed text-sm ${
            remaining < 0 ? 'text-koi' : remaining < 50 ? 'text-glint' : 'text-mist'
          }`}
        >
          {remaining}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
