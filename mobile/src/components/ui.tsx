import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';
import { colors } from '../lib/theme';

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <Text
      className="font-wordmark text-foam"
      style={{ fontSize: size, letterSpacing: size * -0.02 }}
    >
      ripple
    </Text>
  );
}

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'ghost';
}

export function Button({ title, loading, variant = 'primary', disabled, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={
        isPrimary
          ? `h-[52px] items-center justify-center rounded-full bg-koi active:bg-koi-deep ${
              disabled || loading ? 'opacity-40' : ''
            }`
          : 'h-[52px] items-center justify-center rounded-full border border-foam/15 active:bg-foam/5'
      }
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.abyss : colors.foam} />
      ) : (
        <Text
          className={
            isPrimary ? 'font-display text-base text-abyss' : 'font-display text-base text-foam'
          }
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string | undefined;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, className, onFocus, onBlur, secureTextEntry, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isSecure = Boolean(secureTextEntry);
  const borderClass = error ? 'border-koi/60' : focused ? 'border-glint/60' : 'border-foam/10';
  return (
    <View className="gap-2">
      {label ? (
        <Text className="font-displaymed text-xs uppercase tracking-[2px] text-mist">{label}</Text>
      ) : null}
      <View className={`min-h-[52px] flex-row items-center rounded-2xl border bg-depth ${borderClass}`}>
        <TextInput
          ref={ref}
          placeholderTextColor="rgba(126,153,149,0.6)"
          selectionColor={colors.koi}
          keyboardAppearance="dark"
          secureTextEntry={isSecure && hidden}
          className={`flex-1 px-4 py-3.5 font-body text-base text-foam ${className ?? ''}`}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {isSecure ? (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            className="pr-4 active:opacity-60"
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.mist}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="font-body text-sm text-koi">{error}</Text> : null}
    </View>
  );
});

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-2xl border border-koi/25 bg-koi/10 px-4 py-3">
      <Text className="font-body text-sm text-koi">{message}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      <Text className="font-display text-lg text-foam">{title}</Text>
      {subtitle ? (
        <Text className="text-center font-body text-sm leading-5 text-mist">{subtitle}</Text>
      ) : null}
    </View>
  );
}
