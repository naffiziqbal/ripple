import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field, Wordmark } from '../../components/ui';
import { api } from '../../lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = identifier.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(identifier.trim());
      router.push({ pathname: '/verify-otp', params: { identifier: identifier.trim() } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset code');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-abyss" behavior="padding">
      <ScrollView
        contentContainerClassName="w-full max-w-[480px] flex-grow justify-center self-center px-7 py-12"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-10 items-center gap-2">
          <Wordmark size={28} />
          <Text className="font-display text-xl text-foam">Reset your password</Text>
          <Text className="text-center font-body text-base leading-6 text-mist">
            Enter your username or email{'\n'}and we&apos;ll email you a 6-digit code.
          </Text>
        </View>

        <View className="gap-5">
          <ErrorBanner message={error} />
          <Field
            label="Username or email"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="yourname or you@example.com"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <Button
            title="Send code"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1.5">
          <Text className="font-body text-[15px] leading-5 text-mist">Remembered it?</Text>
          <Link href="/login">
            <Text className="font-display text-[15px] leading-5 text-glint">Back to log in</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
