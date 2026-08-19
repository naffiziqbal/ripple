import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Show notifications while the app is foregrounded too (native only).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask for permission, fetch the native device push token (FCM on Android,
 * APNs on iOS — both routed through Firebase server-side) and register it
 * with the backend so likes/comments can reach this device.
 *
 * No-ops gracefully in Expo Go (remote push requires a development build)
 * and on simulators.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return; // simulators cannot receive push
    if (Constants.appOwnership === 'expo') {
      console.log('[push] Expo Go detected — use a development build for FCM push.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const { data: deviceToken } = await Notifications.getDevicePushTokenAsync();
    await api.registerDeviceToken(deviceToken);
  } catch (err) {
    // Push is a nice-to-have; never let it break login.
    console.warn('[push] registration failed:', err);
  }
}
