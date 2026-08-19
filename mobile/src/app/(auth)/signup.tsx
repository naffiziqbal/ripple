import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field, Wordmark } from '../../components/ui';
import { useAuth } from '../../context/auth-context';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const usernameError =
    username.length > 0 && !USERNAME_RE.test(username)
      ? '3–20 characters: letters, numbers, underscore'
      : undefined;
  const emailError =
    email.length > 0 && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : undefined;
  const passwordError =
    password.length > 0 && password.length < 6 ? 'At least 6 characters' : undefined;
  const confirmError =
    confirm.length > 0 && confirm !== password ? 'Passwords do not match' : undefined;

  const canSubmit =
    USERNAME_RE.test(username) &&
    EMAIL_RE.test(email.trim()) &&
    password.length >= 6 &&
    confirm === password &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup(username, email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-abyss" behavior="padding">
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-7 py-12"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center gap-2">
          <Wordmark size={28} />
          <Text className="font-display text-xl text-foam">Create your account</Text>
          <Text className="font-body text-base text-mist">First thought's on you.</Text>
        </View>

        <View className="gap-5">
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
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={emailError}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
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
          <Button
            title="Sign up"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1.5">
          <Text className="font-body text-[15px] leading-5 text-mist">
            Already have an account?
          </Text>
          <Link href="/login">
            <Text className="font-display text-[15px] leading-5 text-glint">Log in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
