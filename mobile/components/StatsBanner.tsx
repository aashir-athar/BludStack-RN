// components/StatsBanner.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/utils/supabase';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';

interface Stats {
  total_donations: number;
  active_donors: number;
  lives_saved: number;
}

const StatsBanner = React.memo(function StatsBanner() {
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats>({ total_donations: 0, active_donors: 0, lives_saved: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const [donRes, donorRes] = await Promise.all([
        supabase.from('profiles').select('total_donations'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('is_available_to_donate', true),
      ]);
      const total = (donRes.data ?? []).reduce((sum: number, p: any) => sum + (p.total_donations ?? 0), 0);
      setStats({
        total_donations: total,
        active_donors: donorRes.count ?? 0,
        lives_saved: Math.floor(total * 3), // each donation can help up to 3 people
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <StatItem value={stats.total_donations} label="Donations" color={theme.primary} theme={theme} />
      <Divider theme={theme} />
      <StatItem value={stats.active_donors} label="Active Donors" color={theme.accent} theme={theme} />
      <Divider theme={theme} />
      <StatItem value={stats.lives_saved} label="Lives Helped" color={theme.success} theme={theme} />
    </View>
  );
});

function StatItem({ value, label, color, theme }: { value: number; label: string; color: string; theme: any }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  item:    { alignItems: 'center', flex: 1, gap: 2 },
  value:   { fontSize: FontSize.xl, fontWeight: FontWeight.black },
  label:   { fontSize: FontSize.xs, textAlign: 'center' },
  divider: { width: 1, height: 32 },
});

export default StatsBanner;
