import { Link } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field } from '../../components/ui';
import { useAuth } from '../../context/auth-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
      // Navigation is handled by the protected stack once `user` is set.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-muted"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-10"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center gap-2">
          <Text className="text-5xl">🌊</Text>
          <Text className="text-3xl font-bold text-ink">Ripple</Text>
          <Text className="text-base text-ink-faint">Small posts, big waves.</Text>
        </View>

        <View className="gap-4 rounded-3xl bg-surface p-6 shadow-sm shadow-slate-200">
          <ErrorBanner message={error} />
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            placeholder="yourname"
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <Button title="Log in" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-ink-soft">New to Ripple?</Text>
          <Link href="/signup" className="font-semibold text-brand">
            Create an account
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
