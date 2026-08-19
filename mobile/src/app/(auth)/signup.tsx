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

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupScreen() {
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_RE.test(username)
      ? '3-20 characters: letters, numbers, underscore'
      : undefined;
  const passwordError =
    password.length > 0 && password.length < 6 ? 'At least 6 characters' : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password ? 'Passwords do not match' : undefined;

  const canSubmit =
    USERNAME_RE.test(username) && password.length >= 6 && confirm === password && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
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
          <Text className="text-3xl font-bold text-ink">Join Ripple</Text>
          <Text className="text-base text-ink-faint">It only takes a moment.</Text>
        </View>

        <View className="gap-4 rounded-3xl bg-surface p-6 shadow-sm shadow-slate-200">
          <ErrorBanner message={error} />
          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            error={usernameError}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            secureTextEntry
            autoComplete="new-password"
            placeholder="At least 6 characters"
          />
          <Field
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            error={confirmError}
            secureTextEntry
            placeholder="Repeat your password"
            onSubmitEditing={handleSubmit}
          />
          <Button title="Sign up" onPress={handleSubmit} loading={submitting} disabled={!canSubmit} />
        </View>

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-ink-soft">Already have an account?</Text>
          <Link href="/login" className="font-semibold text-brand">
            Log in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
