// hooks/useNotifications.ts
// ─────────────────────────────────────────────────────────────────────────────
// After RLS, mobile cannot UPDATE its own profiles.push_token directly - that
// column is server-managed. Tokens are registered via PUT /notifications/token,
// so the app never reads or writes any user's push_token against Supabase.
//
// Registration is best-effort and silent: a denied permission or an Expo-Go run
// without an EAS projectId simply skips, never surfacing noise to the user.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from '@/stores/authStore';
import { apiRegisterPushToken } from '@/utils/api';
import { errorReporter } from '@/lib/errorReporter';

// Foreground handler - show the banner + play sound even when the app is open,
// so a donor reading the feed still sees an incoming critical request.
// `shouldShowBanner` / `shouldShowList` are the SDK 54+ split of the legacy
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
  const easExtra = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  const easConfig = (Constants as { easConfig?: { projectId?: string } }).easConfig;
  return easExtra?.projectId ?? easConfig?.projectId;
}

export function useNotifications() {
  const { user } = useAuth();

  const registerToken = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Permission
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      // 2. Android channels. `emergency` MUST be MAX importance with bypassDnd so
      // a life-critical alert rings even in silent mode / Do Not Disturb -
      // matching the iOS time-sensitive escalation the backend sends. `default`
      // is HIGH (heads-up, respects DND).
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

      // 3. Push token (Expo Go without an EAS projectId fails - expected, skip).
      const projectId = getProjectId();
      let pushToken: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        pushToken = tokenData.data;
      } catch {
        // Normal in Expo Go: run `eas init`, then add extra.eas.projectId to app.json.
        return;
      }

      // 4. Register with backend (RLS blocks direct profiles.push_token writes).
      try {
        await apiRegisterPushToken(pushToken);
      } catch (e) {
        errorReporter.warn('Push token rejected by backend', {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    } catch (e) {
      errorReporter.warn('Push registration failed', {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [user?.id]);

  useEffect(() => {
    void registerToken();
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
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      });
    } catch (e) {
      errorReporter.warn('scheduleLocalNotification failed', {
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, []);

  return { scheduleLocalNotification };
}
