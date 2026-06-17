// Lever: Fitts's Law + role-aware visibility. Request is the primary action;
// role gates which tabs render so each user only sees their own surface.
import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useAppTheme, useIsDark } from '@/stores/themeStore';
import { useIsDonor } from '@/stores/authStore';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Outline when idle, filled when selected (Ionicons via the NativeTabs vector bridge).
function pair(outline: IoniconName, filled: IoniconName) {
  return {
    default: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={outline} />,
    selected: <NativeTabs.Trigger.VectorIcon family={Ionicons} name={filled} />,
  };
}

export default function TabsLayout() {
  const theme = useAppTheme();
  const isDark = useIsDark();
  const isDonor = useIsDonor();

  return (
    <NativeTabs
      tintColor={theme.primary}
      backgroundColor={theme.tabBar}
      iconColor={{ default: theme.tabInactive, selected: theme.primary }}
      labelStyle={{ fontSize: 11, fontWeight: '700', color: theme.tabInactive }}
      blurEffect={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      minimizeBehavior="onScrollDown"
      rippleColor={theme.primarySoft}
      indicatorColor={theme.primarySoft}
    >
      <NativeTabs.Trigger name="index" hidden={!isDonor}>
        <NativeTabs.Trigger.Icon src={pair('home-outline', 'home')} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="request">
        <NativeTabs.Trigger.Icon src={pair('add-circle-outline', 'add-circle')} />
        <NativeTabs.Trigger.Label>Request</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="donors" hidden={!isDonor}>
        <NativeTabs.Trigger.Icon src={pair('search-outline', 'search')} />
        <NativeTabs.Trigger.Label>Find</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="my-requests">
        <NativeTabs.Trigger.Icon src={pair('list-outline', 'list')} />
        <NativeTabs.Trigger.Label>Requests</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history" hidden={!isDonor}>
        <NativeTabs.Trigger.Icon src={pair('heart-outline', 'heart')} />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon src={pair('person-outline', 'person')} />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
