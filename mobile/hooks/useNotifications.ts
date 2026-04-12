// hooks/useNotifications.ts
import { useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/contexts/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Resolve EAS projectId from app config.
 * Works in Expo Go, development builds, and production EAS builds.
 */
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

      // 2. Android channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'BludStack Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF2D55',
          sound: 'default',
          enableVibrate: true,
        });
        await Notifications.setNotificationChannelAsync('emergency', {
          name: 'Emergency Requests',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#FF2D55',
          sound: 'default',
          enableVibrate: true,
        });
      }

      // 3. Get push token
      // projectId is required in Expo SDK 51+.
      // In Expo Go without an EAS project it will fail — that is safe and expected.
      const projectId = getProjectId();
      let pushToken: string;
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        pushToken = tokenData.data;
      } catch (tokenErr: any) {
        // Happens in Expo Go when no projectId is configured.
        // App continues to work normally — only push notifications are unavailable.
        console.warn(
          '[notifications] Push token unavailable — this is normal in Expo Go.\n' +
          'Fix: run `eas init` then add the projectId to app.json > extra.eas.projectId'
        );
        return;
      }

      // 4. Persist token to Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: pushToken })
        .eq('id', user.id);

      if (error) {
        console.warn('[notifications] Failed to save push token to DB:', error.message);
      } else {
        console.log('[notifications] Push token registered');
      }
    } catch (e: any) {
      // Never crash the app over push token issues
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
