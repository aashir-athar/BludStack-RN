// Community totals for the home hero. One unit = one life (no inflation).
import React from 'react';
import { View } from 'react-native';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface StatsBannerProps {
  donations: number;
  donors: number;
  livesHelped: number;
  loading?: boolean;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function Stat({ value, label, loading }: { value: number; label: string; loading?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      {loading ? (
        <Skeleton width={44} height={26} />
      ) : (
        <Text variant="headline" style={{ fontVariant: ['tabular-nums'] }}>{compact(value)}</Text>
      )}
      <Text variant="overline" tone="muted">{label}</Text>
    </View>
  );
}

function StatsBannerImpl({ donations, donors, livesHelped, loading }: StatsBannerProps) {
  const theme = useAppTheme();
  return (
    <Card variant="elevated" style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Stat value={donations} label="Donations" loading={loading} />
      <View style={{ width: 1, height: 32, backgroundColor: theme.divider }} />
      <Stat value={donors} label="Donors" loading={loading} />
      <View style={{ width: 1, height: 32, backgroundColor: theme.divider }} />
      <Stat value={livesHelped} label="Lives helped" loading={loading} />
    </Card>
  );
}

export const StatsBanner = React.memo(StatsBannerImpl);
export default StatsBanner;
