// app/(tabs)/profile.tsx
import BloodGroupBadge from '@/components/BloodGroupBadge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import ScreenHeader from '@/components/ScreenHeader';
import SelectSheet from '@/components/SelectSheet';
import ToggleSwitch from '@/components/ToggleSwitch';
import { BLOOD_GROUPS } from '@/constants/BloodData';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { canDonateAgain, formatDate } from '@/utils/helpers';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { theme, mode, setMode, isDark } = useTheme();
  const { profile, signOut, updateProfile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [saving, setSaving] = useState(false);
  const [themeSheetVisible, setThemeSheetVisible] = useState(false);
  const [bloodSheetVisible, setBloodSheetVisible] = useState(false);

  const { canDonate, daysLeft } = canDonateAgain(profile?.last_donation_date ?? null);

  const themeOptions = [
    { label: '🌙 Dark Mode', value: 'dark', description: 'Easy on the eyes at night' },
    { label: '☀️ Light Mode', value: 'light', description: 'Clean and bright' },
    { label: '📱 System Default', value: 'system', description: 'Follows your device setting' },
  ];

  const bloodOptions = BLOOD_GROUPS.map((bg) => ({ label: bg, value: bg }));

  const toggleAvailability = useCallback(async (val: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ is_available_to_donate: val });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }, [updateProfile]);

  const toggleMedicalShare = useCallback(async (val: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ share_medical_history: val });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }, [updateProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of BludStack?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }, [signOut]);

  const handleBloodGroupChange = useCallback(async (bg: string) => {
    setSaving(true);
    try {
      await updateProfile({ blood_group: bg });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }, [updateProfile]);

  if (!profile) return null;

  const donationColor = canDonate && profile.is_available_to_donate ? theme.success : theme.warning;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScreenHeader title="My Profile" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[12] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Avatar */}
          <View style={[styles.avatarRing, { borderColor: donationColor }]}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.muted }]}>
                <Text style={[styles.avatarInitial, { color: theme.textPrimary }]}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name + badges */}
          <Text style={[styles.heroName, { color: theme.textPrimary }]}>{profile.full_name}</Text>
          <View style={styles.heroBadges}>
            {profile.is_verified && (
              <View style={[styles.badge, { backgroundColor: `${theme.accent}22`, borderColor: `${theme.accent}55` }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>✓ Verified Donor</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: `${donationColor}22`, borderColor: `${donationColor}55` }]}>
              <Text style={[styles.badgeText, { color: donationColor }]}>
                {canDonate && profile.is_available_to_donate ? '● Available' : daysLeft > 0 ? `⏳ ${daysLeft}d until eligible` : '⏸ Unavailable'}
              </Text>
            </View>
          </View>

          <Text style={[styles.heroPhone, { color: theme.textMuted }]}>{profile.email}</Text>

          {/* Stats row */}
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <StatItem value={profile.total_donations} label="Donations" color={theme.primary} theme={theme} />
            <View style={[styles.statDiv, { backgroundColor: theme.border }]} />
            <StatItem value={profile.total_donations * 3} label="Lives Helped" color={theme.success} theme={theme} />
            <View style={[styles.statDiv, { backgroundColor: theme.border }]} />
            <StatItem value={profile.last_donation_date ? formatDate(profile.last_donation_date) : 'Never'} label="Last Donated" color={theme.accent} theme={theme} />
          </View>
        </View>

        {/* Blood Group */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Blood Profile</Text>
          <TouchableOpacity
            onPress={() => setBloodSheetVisible(true)}
            style={styles.bloodRow}
            activeOpacity={0.8}
          >
            <BloodGroupBadge bloodGroup={profile.blood_group} size="lg" showGlow />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bloodLabel, { color: theme.textPrimary }]}>{profile.blood_group}</Text>
              <Text style={[styles.bloodSub, { color: theme.textSecondary }]}>Tap to update blood group</Text>
            </View>
            <Text style={{ color: theme.textMuted }}>›</Text>
          </TouchableOpacity>

          {profile.last_donation_date && (
            <View style={[styles.infoRow, { borderTopColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary, fontSize: FontSize.sm }}>Last donation</Text>
              <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{formatDate(profile.last_donation_date)}</Text>
            </View>
          )}
        </Card>

        {/* Donor settings */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Donor Settings</Text>
          <ToggleSwitch
            label="Available to Donate"
            description="Receive notifications for matching blood requests near you"
            value={profile.is_available_to_donate}
            onValueChange={toggleAvailability}
            icon="🩸"
            disabled={saving || !canDonate}
          />
          <ToggleSwitch
            label="Share Medical History"
            description="Let recipients and donors see your disclosed medical conditions"
            value={profile.share_medical_history}
            onValueChange={toggleMedicalShare}
            icon="🔒"
            disabled={saving}
          />
        </Card>

        {/* Medical conditions summary */}
        {profile.medical_conditions && profile.medical_conditions.length > 0 && (
          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Disclosed Conditions</Text>
            <Text style={[styles.medNote, { color: theme.textMuted }]}>
              {profile.share_medical_history
                ? 'Visible to matched donors/recipients'
                : '🔒 Hidden — only you can see this'}
            </Text>
            <View style={styles.condTags}>
              {profile.medical_conditions.map((c) => (
                <View key={c} style={[styles.condTag, { backgroundColor: `${theme.warning}18`, borderColor: `${theme.warning}44` }]}>
                  <Text style={[styles.condText, { color: theme.warning }]}>{c}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* App settings */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>App Settings</Text>
          <TouchableOpacity
            onPress={() => setThemeSheetVisible(true)}
            style={[styles.settingRow, { borderBottomColor: theme.border }]}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>{mode === 'dark' ? '🌙' : mode === 'light' ? '☀️' : '📱'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Theme</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                {mode === 'dark' ? 'Dark Mode' : mode === 'light' ? 'Light Mode' : 'System Default'}
              </Text>
            </View>
            <Text style={{ color: theme.textMuted }}>›</Text>
          </TouchableOpacity>
        </Card>

        {/* About */}
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>About BludStack</Text>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Text style={styles.settingEmoji}>ℹ️</Text>
            <Text style={[styles.settingLabel, { color: theme.textPrimary, flex: 1 }]}>Version 1.0.0</Text>
          </View>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Text style={styles.settingEmoji}>❤️</Text>
            <Text style={[styles.settingLabel, { color: theme.textPrimary, flex: 1 }]}>Free & Open Source</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingEmoji}>🛡️</Text>
            <Text style={[styles.settingLabel, { color: theme.textPrimary, flex: 1 }]}>Supabase RLS Protected</Text>
          </View>
        </Card>

        {/* Sign out */}
        <Button
          label="Sign Out"
          variant="danger"
          onPress={handleSignOut}
          fullWidth
          size="lg"
        />
      </ScrollView>

      <SelectSheet
        visible={themeSheetVisible}
        title="Choose Theme"
        options={themeOptions}
        selected={mode}
        onSelect={(v) => setMode(v as any)}
        onClose={() => setThemeSheetVisible(false)}
      />
      <SelectSheet
        visible={bloodSheetVisible}
        title="Update Blood Group"
        options={bloodOptions}
        selected={profile.blood_group}
        onSelect={handleBloodGroupChange}
        onClose={() => setBloodSheetVisible(false)}
      />
    </View>
  );
}

function StatItem({ value, label, color, theme }: { value: any; label: string; color: string; theme: any }) {
  return (
    <View style={{ alignItems: 'center', flex: 1, gap: 2 }}>
      <Text style={[{ fontSize: FontSize.lg, fontWeight: FontWeight.black, color }]}>{String(value)}</Text>
      <Text style={{ fontSize: FontSize.xs, color: theme.textMuted, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { paddingHorizontal: Spacing[4], gap: Spacing[4], paddingTop: Spacing[2] },
  heroCard: {
    alignItems: 'center', gap: Spacing[2],
    borderRadius: BorderRadius.xl, borderWidth: 1,
    padding: Spacing[5],
  },
  avatarRing: { borderRadius: 50, borderWidth: 3, padding: 3 },
  avatar:        { width: 80, height: 80, borderRadius: 40 },
  avatarFallback:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: FontSize['2xl'], fontWeight: FontWeight.black },
  heroName:  { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  heroBadges:{ flexDirection: 'row', gap: Spacing[2], flexWrap: 'wrap', justifyContent: 'center' },
  badge:     { paddingHorizontal: Spacing[3], paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  heroPhone: { fontSize: FontSize.sm },
  statsRow:  { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[4], width: '100%', justifyContent: 'space-around' },
  statDiv:   { width: 1, height: 32 },
  section:   {},
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, marginBottom: Spacing[3] },
  bloodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  bloodLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  bloodSub:   { fontSize: FontSize.xs, marginTop: 2 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3], marginTop: Spacing[3],
  },
  infoValue:  { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  medNote:    { fontSize: FontSize.xs, marginBottom: Spacing[2] },
  condTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  condTag:    { paddingHorizontal: Spacing[3], paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  condText:   { fontSize: FontSize.xs },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3], borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingEmoji: { fontSize: 18 },
  settingLabel: { fontSize: FontSize.base },
  settingSub:   { fontSize: FontSize.xs, marginTop: 2 },
});