import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Stack header height for KeyboardAvoidingView offsets.
 * expo-router (SDK 56+) forbids importing @react-navigation/elements'
 * useHeaderHeight, so approximate with the platform header bar height
 * plus the top inset the header absorbs.
 */
export function useHeaderOffset(): number {
  const insets = useSafeAreaInsets();
  const barHeight = Platform.OS === 'ios' ? 44 : 56;
  return insets.top + barHeight;
}
