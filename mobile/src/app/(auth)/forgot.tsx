import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field, Wordmark } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const RESEND_COOLDOWN_S = 30;

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const canSubmit = identifier.trim().length > 0 && !submitting;
  const sentToEmail = identifier.includes('@') ? identifier.trim() : null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.forgotPassword(identifier.trim());
      setSent(true);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset email');
    } finally {
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
        {sent ? (
          /* ——— Sent state: the email is on its way ——— */
          <View className="items-center">
            <Image
              source={require('../../../assets/images/logo.png')}
              style={{ width: 116, height: 116 }}
              accessibilityIgnoresInvertColors
            />
            <Text className="mt-2 font-display text-2xl text-foam">Check your inbox</Text>
            <Text className="mt-2 text-center font-body text-base leading-6 text-mist">
              {sentToEmail
                ? `We sent a password reset link to\n${sentToEmail}`
                : 'We sent a password reset link to the email on your account.'}
            </Text>

            <View className="mt-8 w-full flex-row items-center gap-3 rounded-2xl border border-glint/25 bg-depth p-4">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-glint/15">
                <Ionicons name="file-tray-outline" size={18} color={colors.glint} />
              </View>
              <Text className="flex-1 font-body text-sm leading-5 text-foam">
                Not seeing it? Check your <Text className="font-bodybold">spam folder</Text> — first
                emails from Ripple often land there.
              </Text>
            </View>

            <View className="mt-8 w-full gap-3">
              <Link href="/login" asChild>
                <Button title="Back to log in" />
              </Link>
              <Button
                variant="ghost"
                title={cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
                disabled={cooldown > 0}
                loading={submitting}
                onPress={handleSubmit}
              />
            </View>
          </View>
        ) : (
          /* ——— Request state: who are you? ——— */
          <>
            <View className="mb-10 items-center gap-2">
              <Wordmark size={28} />
              <Text className="font-display text-xl text-foam">Reset your password</Text>
              <Text className="text-center font-body text-base leading-6 text-mist">
                Enter your username or email{'\n'}and we&apos;ll send you a reset link.
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
                title="Send reset link"
                onPress={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
              />
            </View>

            <View className="mt-8 flex-row items-center justify-center gap-1.5">
              <Text className="font-body text-[15px] leading-5 text-mist">Remembered it?</Text>
              <Link href="/login">
                <Text className="font-display text-[15px] leading-5 text-glint">
                  Back to log in
                </Text>
              </Link>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
