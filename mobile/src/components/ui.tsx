import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native';

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
          ? `h-12 items-center justify-center rounded-xl bg-brand active:bg-brand-dark ${disabled || loading ? 'opacity-50' : ''}`
          : 'h-12 items-center justify-center rounded-xl active:opacity-60'
      }
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#0EA5E9'} />
      ) : (
        <Text className={isPrimary ? 'text-base font-semibold text-white' : 'text-base font-semibold text-brand'}>
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
  { label, error, className, ...rest },
  ref
) {
  return (
    <View className="gap-1.5">
      {label ? <Text className="text-sm font-medium text-ink-soft">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#94A3B8"
        className={`min-h-12 rounded-xl border bg-surface px-4 py-3 text-base text-ink ${
          error ? 'border-red-400' : 'border-slate-200'
        } ${className ?? ''}`}
        {...rest}
      />
      {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
    </View>
  );
});

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="rounded-xl bg-red-50 px-4 py-3">
      <Text className="text-sm text-red-600">{message}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="items-center gap-1 px-8 py-16">
      <Text className="text-lg font-semibold text-ink">{title}</Text>
      {subtitle ? <Text className="text-center text-sm text-ink-faint">{subtitle}</Text> : null}
    </View>
  );
}
