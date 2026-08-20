import { Alert, Platform } from 'react-native';

/**
 * Destructive-action confirmation that works everywhere:
 * native Alert on iOS/Android, window.confirm on web
 * (react-native-web's Alert is a silent no-op).
 */
export function confirmDestructive(options: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (window.confirm(`${options.title}\n\n${options.message}`)) {
      options.onConfirm();
    }
    return;
  }
  Alert.alert(options.title, options.message, [
    { text: 'Keep it', style: 'cancel' },
    { text: options.confirmLabel, style: 'destructive', onPress: options.onConfirm },
  ]);
}
