// hooks/useNotifications.ts
// ─────────────────────────────────────────────────────────────────────────────
// After RLS, mobile cannot UPDATE its own profiles.push_token directly — that
// column is server-managed. Tokens are registered via PUT /notifications/token.
// (Fixes flaw #1 / #2 — the mobile no longer ever needs to read or write any
// user's push_token directly against Supabase.)
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { apiRegisterPushToken } from '@/utils/api';

// Foreground handler — show the banner + play sound even when the app is open,
// so a donor reading the feed still sees an incoming critical request.
// `shouldShowBanner` / `shouldShowList` are the SDK 54 split of the legacy
// `shouldShowAlert`.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export function useNotifications() {
  const { user } = useAuth();

  const registerToken = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Request permission
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('[notifications] Permission denied — skipping token registration');
        return;
      }

      // 2. Android channels.
      // `emergency` MUST be MAX importance so it bypasses Do Not Disturb on
      // Android 8+. `default` is HIGH (heads-up, but respects DND).
      // bypassDnd=true on emergency lets the channel ring even in silent mode —
      // matches the iOS time-sensitive escalation we send from the backend.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'BludStack Updates',
          description: 'Status changes on requests you posted or accepted',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 100, 200],
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
        await Notifications.setNotificationChannelAsync('emergency', {
          name: 'Emergency Blood Requests',
          description: 'Life-critical alerts. Bypasses silent mode and DND.',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500, 200, 500],
          sound: 'default',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
          bypassDnd: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // 3. Get push token (Expo Go without EAS projectId will fail — expected)
      const projectId = getProjectId();
      let pushToken: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        pushToken = tokenData.data;
      } catch {
        console.warn(
          '[notifications] Push token unavailable — normal in Expo Go.\n' +
          'Fix: `eas init` then add the projectId to app.json > extra.eas.projectId',
        );
        return;
      }

      // 4. Register with backend (RLS blocks direct profiles.push_token writes)
      try {
        await apiRegisterPushToken(pushToken);
        console.log('[notifications] Push token registered');
      } catch (e: any) {
        console.warn('[notifications] Backend rejected token:', e?.message);
      }
    } catch (e: any) {
      console.warn('[notifications] Unexpected error:', e?.message ?? e);
    }
  }, [user]);

  useEffect(() => {
    registerToken();
  }, [registerToken]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, unknown>,
    seconds = 1,
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data: data ?? {}, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    } catch (e: any) {
      console.warn('[notifications] scheduleLocalNotification error:', e?.message);
    }
  }, []);

  return { scheduleLocalNotification };
}
