# BludStack — Push Notification Reliability Playbook

> A blood-donation app where the donor's phone is the lifeline. This document
> is the contract for **how we ensure a push reaches the donor even when the
> app is force-quit**, and what to check first when it doesn't.

## Stack

- Client: `expo-notifications` (SDK 54)
- Server: `expo-server-sdk` (Node)
- Transport: APNs (iOS) and FCM v1 (Android) — both via Expo's push service

## How killed-state delivery actually works

**iOS** — When the app is suspended or terminated:
- APNs delivers the push to the OS, which renders the banner / plays the sound *without* waking your app.
- This works as long as the app has been launched **at least once** since install AND the user has granted notification permission. iOS does not let you push to a never-launched app.
- "Critical alerts" (bypass Do Not Disturb + Focus) require a special Apple entitlement we have NOT applied for. Instead we use `interruptionLevel: 'time-sensitive'` for emergency requests — works without an entitlement and breaks through Focus modes.

**Android** — When the app is force-stopped:
- FCM v1 still delivers high-priority pushes IF the OS hasn't put the app in "deep sleep."
- The reality on OEM Android (Xiaomi MIUI, Realme Color OS, OnePlus OxygenOS, Vivo Funtouch, Samsung One UI Game Booster) is that aggressive battery saving *will* kill BludStack background and drop pushes.
- The only reliable fix is asking the user to **disable battery optimization for BludStack**. We do this via a polite prompt (see `useBackgroundDelivery.ts`).

## Server contract — what we send

`backend/src/services/notificationService.js` builds every Expo push message with:

```js
{
  priority:        'high',                    // FCM priority:high
  ttl:             0,                          // emergency only — drop stale
  mutableContent:  true,                       // allow iOS NSE if we add one later
  interruptionLevel: 'time-sensitive',         // iOS Focus-mode bypass
  channelId:       'emergency',                // Android channel routing
  data:            { _displayInForeground: true, ... },
  sound:           'default',
  badge:           1,
}
```

For non-emergency (donation milestones, "donor accepted" recipient pings):
- `priority: 'normal'`, `ttl: 3600`, `interruptionLevel: 'active'`, `channelId: 'default'`.

## Client contract — channels

`mobile/hooks/useNotifications.ts` registers two Android channels on first run:

| Channel | Importance | Bypass DND | Vibration | Use |
|---|---|---|---|---|
| `default` | HIGH (heads-up, respects DND) | No | Soft | Status updates, completion confirmations |
| `emergency` | MAX (full-screen, ignores DND) | **Yes** | Strong, double-pulse | Incoming blood requests |

`bypassDnd: true` on the emergency channel is what lets the alert ring in silent mode. The user can override this in system settings if they want.

## Stale-token pruning

Expo returns `DeviceNotRegistered` when a push token is permanently invalid (user uninstalled, OS reinstalled, APNs cert rotated). `sendPushNotifications` collects those tokens and nulls them out of `profiles.push_token` in the same call — no orphan tokens, no wasted send attempts.

## Battery-optimization nudge (Android only)

`useBackgroundDelivery()` exposes:

- `shouldNudgeBatteryOpt` — `true` on Android when permission is granted and we have not asked in the last 30 days.
- `openBatterySettings()` — opens `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` directly, with two fallbacks for OEMs that block the direct intent.
- `dismissNudge()` — records the prompt timestamp.

Wire this into a post-onboarding gate or a non-blocking banner on the Home tab. Do not gate app entry on it — that breaks Fitts's Law for the user just trying to read their feed.

## Troubleshooting checklist (when a donor reports "I didn't get the push")

Run through in order:

1. **Was the push sent?** Check the Vercel logs for the `[notify]` line corresponding to the request ID.
2. **Did Expo accept the ticket?** A `DeviceNotRegistered` means the token is dead — verify by checking `profiles.push_token` for that user (it should be NULL now if our pruner ran).
3. **Has the user opened the app since installing?** A never-launched iOS app cannot receive pushes.
4. **Is notification permission granted on the device?** Settings → Apps → BludStack → Notifications.
5. **Is battery optimization off on Android?** Settings → Apps → BludStack → Battery → Unrestricted.
6. **For Xiaomi specifically:** Security app → Permissions → Autostart → enable for BludStack.
7. **For OnePlus / Realme:** Settings → Apps → BludStack → Battery usage → Allow background activity.
8. **For Samsung:** Settings → Apps → BludStack → Battery → Allow background activity AND "Never sleeping apps" includes BludStack.

## What we explicitly did NOT do

- **No `react-native-push-notification`, `notifee`, or third-party SDK.** Pure `expo-notifications` end-to-end.
- **No critical alerts entitlement.** `time-sensitive` covers the use case without the Apple paperwork. If the app graduates to true clinical use, file for `com.apple.developer.usernotifications.critical-alerts`.
- **No silent push for state sync.** Blood matching is real-time push-driven, not poll-driven; silent pushes add battery cost with no UX benefit here.
- **No foreground service on Android.** Would guarantee delivery but trips Google's foreground-service abuse review. The battery-opt nudge gets us 95% of the way without the platform fight.
