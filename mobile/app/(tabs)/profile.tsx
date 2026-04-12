// app/(tabs)/profile.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import ToggleSwitch from '@/components/ToggleSwitch';
import SelectSheet from '@/components/SelectSheet';
import Button from '@/components/Button';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
import { BLOOD_GROUPS } from '@/constants/BloodData';
import { formatDate, canDonateAgain } from '@/utils/helpers';

export default function ProfileScreen() {
  const { theme, mode, setMode } = useTheme();
  const { profile, signOut, updateProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [themeSheet, setThemeSheet]  = useState(false);
  const [bloodSheet, setBloodSheet]  = useState(false);

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);

  const toggle = useCallback(async (key: string, val: boolean) => {
    setSaving(true);
    try { await updateProfile({ [key]: val } as any); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }, [updateProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  if (!profile) return null;

  const available      = profile.is_available_to_donate && canDonate;
  const statusColor    = available ? theme.success : theme.warning;
  const statusLabel    = available ? 'Available to donate' : daysLeft > 0 ? `Eligible in ${daysLeft} days` : 'Paused';

  const themeOptions = [
    { label: 'Dark',   value: 'dark',   icon: '🌙', description: 'Black background' },
    { label: 'Light',  value: 'light',  icon: '☀️', description: 'White background' },
    { label: 'System', value: 'system', icon: '📱', description: 'Follows device setting' },
  ];
  const bloodOptions = BLOOD_GROUPS.map(bg => ({ label: bg, value: bg }));

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing[12] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={[styles.hero, { paddingTop: insets.top + Spacing[6], backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          {/* Avatar */}
          <View style={[styles.avatarRing, { borderColor: statusColor }]}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.cardElevated }]}>
                <Text style={[styles.initial, { color: theme.textPrimary }]}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={[styles.heroName, { color: theme.textPrimary }]}>{profile.full_name}</Text>
          <Text style={[styles.heroEmail, { color: theme.textMuted }]}>{profile.email}</Text>

          {/* Status */}
          <View style={[styles.statusRow, { backgroundColor: `${statusColor}15` }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            {profile.is_verified && (
              <Text style={[styles.verified, { color: theme.success }]}>  ✓ Verified</Text>
            )}
          </View>

          {/* Stats */}
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <Stat label="DONATIONS"   value={profile.total_donations} color={theme.primary} theme={theme} />
            <View style={[styles.statSep, { backgroundColor: theme.border }]} />
            <Stat label="LIVES HELPED" value={profile.total_donations * 3} color={theme.success} theme={theme} />
            <View style={[styles.statSep, { backgroundColor: theme.border }]} />
            <Stat label="LAST DONATED"
              value={profile.last_donation_date ? formatDate(profile.last_donation_date) : '—'}
              color={theme.textPrimary} theme={theme} small />
          </View>
        </View>

        {/* ── Blood group ── */}
        <SectionHeader label="BLOOD PROFILE" theme={theme} />
        <TouchableOpacity
          onPress={() => setBloodSheet(true)}
          style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <BloodGroupBadge bloodGroup={profile.blood_group} size="md" inverted />
          <View style={{ flex: 1, marginLeft: Spacing[3] }}>
            <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>{profile.blood_group}</Text>
            <Text style={[styles.rowSub, { color: theme.textMuted }]}>Tap to update</Text>
          </View>
          <Text style={[styles.caret, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        {/* ── Donor settings ── */}
        <SectionHeader label="DONOR SETTINGS" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ToggleSwitch
            label="Available to Donate"
            description="Receive alerts when someone nearby needs your blood group"
            value={profile.is_available_to_donate}
            onValueChange={v => toggle('is_available_to_donate', v)}
            icon="🩸"
            disabled={saving || !canDonate}
          />
          <ToggleSwitch
            label="Share Medical History"
            description="Let matched donors/recipients see your disclosed conditions"
            value={profile.share_medical_history}
            onValueChange={v => toggle('share_medical_history', v)}
            icon="🔒"
            disabled={saving}
          />
        </View>

        {/* Medical tags */}
        {(profile.medical_conditions?.length ?? 0) > 0 && (
          <>
            <SectionHeader label="DISCLOSED CONDITIONS" theme={theme} />
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.medNote, { color: theme.textMuted }]}>
                {profile.share_medical_history ? 'Visible to matched parties' : '🔒 Private — only you can see this'}
              </Text>
              <View style={styles.tags}>
                {profile.medical_conditions!.map(c => (
                  <View key={c} style={[styles.tag, { backgroundColor: theme.cardElevated }]}>
                    <Text style={[styles.tagText, { color: theme.textSecondary }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── App settings ── */}
        <SectionHeader label="APP SETTINGS" theme={theme} />
        <TouchableOpacity
          onPress={() => setThemeSheet(true)}
          style={[styles.settingRow, { backgroundColor: theme.card, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>{mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '📱'}</Text>
          <View style={{ flex: 1, marginLeft: Spacing[3] }}>
            <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Appearance</Text>
            <Text style={[styles.rowSub, { color: theme.textMuted }]}>
              {mode === 'dark' ? 'Dark mode' : mode === 'light' ? 'Light mode' : 'System default'}
            </Text>
          </View>
          <Text style={[styles.caret, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>

        {/* ── About ── */}
        <SectionHeader label="ABOUT" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {[
            { icon: 'ℹ️', label: 'Version', value: '1.0.0' },
            { icon: '❤️', label: 'License', value: 'Free & Open Source' },
            { icon: '🛡️', label: 'Security', value: 'Supabase RLS' },
          ].map(({ icon, label, value }) => (
            <View key={label} style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
              <Text style={styles.aboutIcon}>{icon}</Text>
              <Text style={[styles.aboutLabel, { color: theme.textPrimary }]}>{label}</Text>
              <Text style={[styles.aboutValue, { color: theme.textMuted }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Sign out ── */}
        <View style={styles.signOutWrap}>
          <Button label="Sign Out" variant="outline" onPress={handleSignOut} fullWidth size="lg" />
        </View>
      </ScrollView>

      <SelectSheet
        visible={themeSheet}
        title="Appearance"
        options={themeOptions}
        selected={mode}
        onSelect={v => setMode(v as any)}
        onClose={() => setThemeSheet(false)}
      />
      <SelectSheet
        visible={bloodSheet}
        title="Blood Group"
        options={bloodOptions}
        selected={profile.blood_group}
        onSelect={async bg => {
          setSaving(true);
          try { await updateProfile({ blood_group: bg }); }
          catch (e: any) { Alert.alert('Error', e.message); }
          finally { setSaving(false); }
        }}
        onClose={() => setBloodSheet(false)}
      />
    </View>
  );
}

function Stat({ label, value, color, theme, small }: { label: string; value: any; color: string; theme: any; small?: boolean }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[{ color, fontWeight: FontWeight.black, fontSize: small ? FontSize.sm : FontSize.xl }]}>
        {String(value)}
      </Text>
      <Text style={{ color: theme.textMuted, fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function SectionHeader({ label, theme }: { label: string; theme: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: theme.textMuted }]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  hero:        { alignItems: 'center', gap: Spacing[3], paddingBottom: Spacing[6], borderBottomWidth: StyleSheet.hairlineWidth },
  avatarRing:  { borderRadius: Radius.full, borderWidth: 3, padding: 3, marginBottom: Spacing[1] },
  avatar:      { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  initial:     { fontSize: FontSize['2xl'], fontWeight: FontWeight.black },
  heroName:    { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.snug },
  heroEmail:   { fontSize: FontSize.sm, marginTop: -Spacing[2] },
  statusRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.full, gap: Spacing[2] },
  dot:         { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },
  verified:    { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  statsRow:    { flexDirection: 'row', alignItems: 'center', width: '100%', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[5], paddingHorizontal: Spacing[4] },
  statSep:     { width: StyleSheet.hairlineWidth, height: 32 },
  sectionHeader: { fontSize: FontSize['2xs'], fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase', paddingHorizontal: Spacing[5], paddingTop: Spacing[6], paddingBottom: Spacing[2] },
  settingRow:  { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], marginHorizontal: Spacing[5], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  card:        { marginHorizontal: Spacing[5], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing[4] },
  rowTitle:    { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  rowSub:      { fontSize: FontSize.xs, marginTop: 2 },
  caret:       { fontSize: FontSize.lg },
  medNote:     { fontSize: FontSize.xs, paddingVertical: Spacing[3] },
  tags:        { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], paddingBottom: Spacing[3] },
  tag:         { paddingHorizontal: Spacing[2], paddingVertical: 3, borderRadius: Radius.xs },
  tagText:     { fontSize: FontSize.xs },
  aboutRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing[3] },
  aboutIcon:   { fontSize: 18 },
  aboutLabel:  { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  aboutValue:  { fontSize: FontSize.sm },
  signOutWrap: { paddingHorizontal: Spacing[5], paddingTop: Spacing[6] },
});
