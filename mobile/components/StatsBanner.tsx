// components/StatsBanner.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/utils/supabase';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

const StatsBanner = React.memo(function StatsBanner() {
  const { theme } = useTheme();
  const [stats, setStats] = useState({ donations: 0, donors: 0, lives: 0 });

  useEffect(() => {
    (async () => {
      try {
        const [d, a] = await Promise.all([
          supabase.from('profiles').select('total_donations'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_available_to_donate', true),
        ]);
        const total = (d.data ?? []).reduce((s: number, p: any) => s + (p.total_donations ?? 0), 0);
        setStats({ donations: total, donors: a.count ?? 0, lives: total * 3 });
      } catch {}
    })();
  }, []);

  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Stat label="DONATIONS"    value={stats.donations} color={theme.primary} theme={theme} />
      <View style={[styles.sep, { backgroundColor: theme.border }]} />
      <Stat label="ACTIVE DONORS" value={stats.donors}   color={theme.textPrimary} theme={theme} />
      <View style={[styles.sep, { backgroundColor: theme.border }]} />
      <Stat label="LIVES HELPED" value={stats.lives}     color={theme.success} theme={theme} />
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
