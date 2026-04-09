// hooks/useNotifications.ts
import { useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
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

export function useNotifications() {
  const { user } = useAuth();

  const registerToken = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

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

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      await supabase
        .from('profiles')
        .update({ push_token: pushToken })
        .eq('id', user.id);
    } catch (e) {
      console.warn('Push token registration failed:', e);
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
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: data ?? {}, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  }, []);

  return { scheduleLocalNotification };
}
