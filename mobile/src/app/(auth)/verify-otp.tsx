import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ErrorBanner } from '../../components/ui';
import { api } from '../../lib/api';
import { colors } from '../../lib/theme';

const RESEND_COOLDOWN_S = 30;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { identifier = '' } = useLocalSearchParams<{ identifier?: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sentToEmail = identifier.includes('@') ? identifier : null;
  const canVerify = /^\d{6}$/.test(otp) && !submitting;

  async function handleVerify() {
    if (!canVerify) return;
    setSubmitting(true);
    setError(null);
    try {
      const { resetToken } = await api.verifyResetOtp(identifier, otp);
      router.push({ pathname: '/reset-password', params: { resetToken } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      await api.forgotPassword(identifier);
      setOtp('');
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-abyss" behavior="padding">
      <ScrollView
        contentContainerClassName="w-full max-w-[480px] flex-grow justify-center self-center px-7 py-12"
        style={{ paddingTop: insets.top }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8 items-center gap-2">
          <Text className="font-display text-xl text-foam">Enter the code</Text>
          <Text className="text-center font-body text-base leading-6 text-mist">
            {sentToEmail
              ? `We emailed a 6-digit code to\n${sentToEmail}`
              : 'We emailed a 6-digit code to the address on your account.'}
          </Text>
        </View>

        <View className="gap-5">
          <ErrorBanner message={error} />

          <TextInput
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            keyboardAppearance="dark"
            selectionColor={colors.koi}
            autoFocus
            maxLength={6}
            placeholder="••••••"
            placeholderTextColor="rgba(126,153,149,0.4)"
            className="h-16 rounded-2xl border border-foam/10 bg-depth text-center font-display text-3xl text-foam"
            style={{ letterSpacing: 12 }}
            accessibilityLabel="6-digit reset code"
          />

          <Button
            title="Verify code"
            onPress={handleVerify}
            loading={submitting}
            disabled={!canVerify}
          />

          <View className="flex-row items-center gap-3 rounded-2xl border border-glint/25 bg-depth p-4">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-glint/15">
              <Ionicons name="file-tray-outline" size={18} color={colors.glint} />
            </View>
            <Text className="flex-1 font-body text-sm leading-5 text-foam">
              Not seeing it? Check your <Text className="font-bodybold">spam folder</Text> — first
              emails from Ripple often land there.
            </Text>
          </View>

          <Button
            variant="ghost"
            title={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            disabled={cooldown > 0}
            loading={resending}
            onPress={handleResend}
          />
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-1.5">
          <Text className="font-body text-[15px] leading-5 text-mist">Wrong account?</Text>
          <Link href="/forgot">
            <Text className="font-display text-[15px] leading-5 text-glint">Start over</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
