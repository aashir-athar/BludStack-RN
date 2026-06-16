// Donor-availability context with a pulsing live-dot. Reassures the recipient
// that real donors are nearby (or that the search has widened country-wide).
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { Spacing } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';
import { Card } from './Card';

export interface UrgencyBannerProps {
  count: number;
  bloodGroup: string;
  radiusKm?: number;
  countryName?: string;
}

function UrgencyBannerImpl({ count, bloodGroup, radiusKm, countryName }: UrgencyBannerProps) {
  const theme = useAppTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [reduceMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 1.6 }],
    opacity: 0.4 * (1 - pulse.value),
  }));

  const where = countryName ? `across ${countryName}` : radiusKm ? `within ${radiusKm} km` : 'near the hospital';
  const has = count > 0;

  return (
    <Card variant="tinted" style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
      <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: has ? theme.success : theme.warning }, ringStyle]} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: has ? theme.success : theme.warning }} />
      </View>
      <Text variant="bodySm" style={{ flex: 1 }}>
        <Text variant="bodySm" style={{ fontWeight: '800' }}>{count} {bloodGroup}</Text>
        <Text variant="bodySm" tone="muted">{has ? ` donor${count === 1 ? '' : 's'} ready ${where}` : ` donors searched ${where}`}</Text>
      </Text>
    </Card>
  );
}

export const UrgencyBanner = React.memo(UrgencyBannerImpl);
export default UrgencyBanner;
