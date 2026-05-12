// components/StatsBanner.tsx
// Uses the backend's /stats/community endpoint (public, no auth required).
// Previously summed total_donations client-side by selecting every profile row —
// RLS now blocks that, and even before RLS it was an O(N) waste of bandwidth.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { apiCommunityStats } from '@/utils/api';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

const StatsBanner = React.memo(function StatsBanner() {
  const { theme } = useTheme();
  const [stats, setStats] = useState({ donations: 0, donors: 0, lives: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data: any = await apiCommunityStats();
        if (cancelled) return;
        const donations = data?.total_donations ?? data?.donations ?? 0;
        const donors    = data?.active_donors   ?? data?.donors    ?? 0;
        const lives     = data?.lives_helped    ?? data?.lives     ?? donations * 3;
        setStats({ donations, donors, lives });
      } catch {
        // Stats are non-critical — silently keep zeros
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Stat label="DONATIONS"     value={stats.donations} color={theme.primary}     theme={theme} />
      <View style={[styles.sep, { backgroundColor: theme.border }]} />
      <Stat label="ACTIVE DONORS" value={stats.donors}    color={theme.textPrimary} theme={theme} />
      <View style={[styles.sep, { backgroundColor: theme.border }]} />
      <Stat label="LIVES HELPED"  value={stats.lives}     color={theme.success}     theme={theme} />
    </View>
  );
});

function Stat({ label, value, color, theme }: { label: string; value: number; color: string; theme: any }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statNum, { color }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, paddingVertical: Spacing[4] },
  sep:       { width: StyleSheet.hairlineWidth, marginVertical: Spacing[1] },
  stat:      { flex: 1, alignItems: 'center', gap: 2 },
  statNum:   { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  statLabel: { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },
});

export default StatsBanner;
