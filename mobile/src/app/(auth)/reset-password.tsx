import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resetToken = '' } = useLocalSearchParams<{ resetToken?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordError =
    password.length > 0 && password.length < 6 ? 'At least 6 characters' : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password ? 'Passwords do not match' : undefined;
  const canSubmit = password.length >= 6 && confirm === password && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.resetPassword(resetToken, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-abyss px-7"
        style={{ paddingTop: insets.top }}
      >
        <View className="h-16 w-16 items-center justify-center rounded-full bg-glint/15">
          <Ionicons name="checkmark" size={32} color={colors.glint} />
        </View>
        <Text className="font-display text-2xl text-foam">Password updated</Text>
        <Text className="text-center font-body text-base leading-6 text-mist">
          You&apos;re signed out everywhere.{'\n'}Log in with your new password.
        </Text>
        <View className="mt-4 w-full">
          <Button title="Log in" onPress={() => router.replace('/login')} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-abyss" behavior="padding">
      <ScrollView
        contentContainerClassName="w-full max-w-[480px] flex-grow justify-center self-center px-7 py-12"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center gap-2">
          <Text className="font-display text-xl text-foam">Choose a new password</Text>
          <Text className="text-center font-body text-base leading-6 text-mist">
            Code verified — set your new password below.
          </Text>
        </View>

        <View className="gap-5">
          <ErrorBanner message={error} />
          <Field
            label="New password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
          <Field
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            error={confirmError}
            secureTextEntry
            placeholder="Repeat your new password"
            onSubmitEditing={handleSubmit}
          />
          <Button
            title="Set new password"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
