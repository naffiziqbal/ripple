import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field, Wordmark } from '../../components/ui';
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
    <KeyboardAvoidingView className="flex-1 bg-abyss" behavior="padding">
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-7 py-12"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-12 items-center gap-3">
          <Image
            source={require('../../../assets/images/logo.png')}
            style={{ width: 132, height: 132 }}
            accessibilityIgnoresInvertColors
          />
          <View className="items-center gap-2">
            <Wordmark />
            <Text className="font-body text-base text-mist">Say it small. Watch it spread.</Text>
          </View>
        </View>

        <View className="gap-5">
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

        <View className="mt-8 flex-row justify-center gap-1.5">
          <Text className="font-body text-mist">New here?</Text>
          <Link href="/signup">
            <Text className="font-display text-glint">Create an account</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
