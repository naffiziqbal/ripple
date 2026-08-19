import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * expo-notifications THROWS on import in Expo Go on Android (remote push was
 * removed from Expo Go in SDK 53), so it must never be imported statically.
 * Returns the module in development/production builds, null in Expo Go / web.
 */
export function getNotificationsModule(): NotificationsModule | null {
  if (isExpoGo || Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications') as NotificationsModule;
}

let foregroundHandlerSet = false;

/** Show notifications while the app is foregrounded too. */
function ensureForegroundHandler(notifications: NotificationsModule): void {
  if (foregroundHandlerSet) return;
  foregroundHandlerSet = true;
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission, fetch the native device push token (FCM on Android)
 * and register it with the backend so likes/comments can reach this device.
 *
 * No-ops gracefully in Expo Go, on web, and on simulators.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const notifications = getNotificationsModule();
    if (!notifications) {
      if (isExpoGo) {
        console.log('[push] Expo Go detected — use a development build for FCM push.');
      }
      return;
    }
    if (!Device.isDevice) return; // simulators cannot receive push

    ensureForegroundHandler(notifications);

    if (Platform.OS === 'android') {
      await notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const { data: deviceToken } = await notifications.getDevicePushTokenAsync();
    await api.registerDeviceToken(deviceToken);
  } catch (err) {
    // Push is a nice-to-have; never let it break login.
    console.warn('[push] registration failed:', err);
  }
}
