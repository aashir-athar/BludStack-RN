// hooks/useBackgroundDelivery.ts
// Lever: loss aversion — "Don't miss the call that saves a life" frames the
// permission request around what they stand to lose, not what we want.
//
// Why this exists:
//   On Android (especially Xiaomi/Realme/OnePlus/Samsung/Vivo phones common in
//   Pakistan) the OEM aggressively kills background apps to save battery,
//   blocking FCM delivery even when the channel importance is MAX.
//   The only reliable fix is "Don't optimise battery for BludStack" in system
//   settings. This hook detects when we likely need that, exposes a single
//   `openBatterySettings()` action, and persists the user's decision so we
//   don't nag every cold start.

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROMPTED_KEY = 'bludstack:battery_opt_prompted_at';
const RE_PROMPT_AFTER_DAYS = 30;

interface BackgroundDeliveryState {
  /** Push permission status reported by the OS. */
  permission: Notifications.PermissionStatus | 'undetermined';
  /** True if Android AND we have not asked recently AND permission is granted. */
  shouldNudgeBatteryOpt: boolean;
  /** Deep-link to Android system settings for battery optimization. */
  openBatterySettings: () => Promise<void>;
  /** Record that we've shown the prompt so we don't ask again for 30 days. */
  dismissNudge: () => Promise<void>;
  /** Re-check permission (call after a settings-screen round trip). */
  refresh: () => Promise<void>;
}

export function useBackgroundDelivery(): BackgroundDeliveryState {
  const [permission, setPermission] = useState<Notifications.PermissionStatus | 'undetermined'>('undetermined');
  const [shouldNudgeBatteryOpt, setShouldNudge] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const status = await Notifications.getPermissionsAsync();
      setPermission(status.status);

      if (Platform.OS !== 'android' || status.status !== 'granted') {
        setShouldNudge(false);
        return;
      }

      const lastPromptISO = await AsyncStorage.getItem(PROMPTED_KEY);
      if (!lastPromptISO) {
        setShouldNudge(true);
        return;
      }
      const ageDays = (Date.now() - new Date(lastPromptISO).getTime()) / 86_400_000;
      setShouldNudge(ageDays >= RE_PROMPT_AFTER_DAYS);
    } catch {
      setShouldNudge(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openBatterySettings = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS,
      );
    } catch {
      // Fallback for OEM ROMs that block the direct intent (Xiaomi often does)
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: 'package:com.bludstack' },
        );
      } catch {
        // Last resort: open generic settings
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS);
      }
    }
  }, []);

  const dismissNudge = useCallback(async () => {
    await AsyncStorage.setItem(PROMPTED_KEY, new Date().toISOString());
    setShouldNudge(false);
  }, []);

  return { permission, shouldNudgeBatteryOpt, openBatterySettings, dismissNudge, refresh };
}
