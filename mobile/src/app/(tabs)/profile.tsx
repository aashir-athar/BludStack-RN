// Lever: control + sense of presence. The user sees who they are to the network
// and holds every switch: availability, appearance, and the way out.
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useAppTheme, useThemeMode, useThemeStore, type ThemeMode } from '@/stores/themeStore';
import { useAuth, useIsDonor } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from '@/utils/age';
import { MIN_DONATION_GAP_DAYS } from '@/constants/BloodData';
import { Spacing, Radius } from '@/constants/Typography';
import { reputationProgress, livesHelped } from '@/lib/reputation';
import { Text, Card, BloodGroupBadge, ReputationBadge, Button } from '@/ui';

const APPEARANCE: { label: string; value: ThemeMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'Light', value: 'light', icon: 'sunny' },
  { label: 'System', value: 'system', icon: 'phone-portrait' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function remainingCooldown(lastDonation: string | null | undefined): number {
  if (!lastDonation) return 0;
  return Math.max(0, Math.ceil(MIN_DONATION_GAP_DAYS - (Date.now() - new Date(lastDonation).getTime()) / 86_400_000));
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const mode = useThemeMode();
  const setMode = useThemeStore((s) => s.setMode);
  const { profile, signOut, updateProfile } = useAuth();
  const isDonor = useIsDonor();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const toggle = useCallback(async (key: 'is_available_to_donate' | 'share_medical_history', val: boolean) => {
    void Haptics.selectionAsync();
    setSaving(true);
    try {
      await updateProfile({ [key]: val });
    } catch (e) {
      toast.error("Couldn't update", { description: e instanceof Error ? e.message : 'Try again in a moment' });
    } finally {
      setSaving(false);
    }
  }, [updateProfile, toast]);

  const handleSignOut = useCallback(() => {
    void Haptics.selectionAsync();
    Alert.alert('Sign out', 'Sign out of BludStack? You can sign back in any time with your email.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  }, [signOut]);

  if (!profile) return null;

  const age = computeAge(profile.date_of_birth);
  const cooldownDays = remainingCooldown(profile.last_donation_date);
  const ageOk = age !== null && age >= DONOR_MIN_AGE && age <= DONOR_MAX_AGE;
  const available = profile.is_available_to_donate && cooldownDays === 0 && ageOk;
  const donations = profile.total_donations ?? 0;
  const rep = reputationProgress(donations);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: insets.top + Spacing[4], paddingHorizontal: Spacing[5], paddingBottom: Spacing[10], gap: Spacing[5] }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: Spacing[3] }}>
          <View style={{ width: 88, height: 88, borderRadius: Radius.pill, overflow: 'hidden', backgroundColor: theme.primaryGhost, alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url ? (
              <Image source={profile.avatar_url} style={{ width: 88, height: 88 }} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <Text variant="display" tone="brand">{initials(profile.full_name)}</Text>
            )}
          </View>
          <View style={{ alignItems: 'center', gap: Spacing[2] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
              <Text variant="title">{profile.full_name}</Text>
              {profile.is_verified ? <Ionicons name="checkmark-circle" size={18} color={theme.success} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap', justifyContent: 'center' }}>
              <BloodGroupBadge group={profile.blood_group} size="sm" />
              {isDonor ? <ReputationBadge totalDonations={donations} verified={profile.is_verified} size="sm" /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: available ? theme.success : theme.warning }} />
                <Text variant="caption" tone={available ? 'success' : 'warning'}>
                  {available ? 'Available to donate' : cooldownDays > 0 ? `Eligible in ${cooldownDays} days` : 'Paused'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Card variant="elevated" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>{profile.total_donations}</Text>
            <Text variant="overline" tone="muted">Donations</Text>
          </View>
          <View style={{ width: 1, height: 32, backgroundColor: theme.divider }} />
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text variant="title" style={{ fontVariant: ['tabular-nums'], color: theme.primary }}>{livesHelped(donations)}</Text>
            <Text variant="overline" tone="muted">Lives helped</Text>
          </View>
          <View style={{ width: 1, height: 32, backgroundColor: theme.divider }} />
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>{cooldownDays}</Text>
            <Text variant="overline" tone="muted">Cooldown days</Text>
          </View>
        </Card>

        {isDonor ? (
          <View style={{ gap: Spacing[2] }}>
            <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>Your standing</Text>
            <Card variant="elevated" style={{ gap: Spacing[3] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing[2] }}>
                <ReputationBadge totalDonations={donations} verified={profile.is_verified} />
                {profile.is_verified ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                    <Ionicons name="shield-checkmark" size={16} color={theme.success} />
                    <Text variant="caption" tone="success">Verified donor</Text>
                  </View>
                ) : null}
              </View>
              <Text variant="bodySm" tone="secondary">{rep.current.blurb}</Text>
              {rep.next ? (
                <View style={{ gap: Spacing[2] }}>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${rep.remaining} donations to ${rep.next.label}`}
                    style={{ height: 8, borderRadius: Radius.pill, backgroundColor: theme.pillBg, overflow: 'hidden' }}
                  >
                    <View style={{ width: `${Math.round(rep.fraction * 100)}%`, height: '100%', backgroundColor: theme.primary, borderRadius: Radius.pill }} />
                  </View>
                  <Text variant="caption" tone="muted">
                    {rep.remaining} more {rep.remaining === 1 ? 'donation' : 'donations'} to reach {rep.next.label}
                  </Text>
                </View>
              ) : (
                <Text variant="caption" tone="success">You have reached the highest tier. Thank you for showing up, again and again.</Text>
              )}
            </Card>
          </View>
        ) : null}

        <Pressable
          onPress={() => { void Haptics.selectionAsync(); router.push('/profile/edit'); }}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
        >
          <Card variant="surface" style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
            <Ionicons name="person-outline" size={20} color={theme.primary} />
            <Text variant="label" style={{ flex: 1 }}>Edit profile</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
          </Card>
        </Pressable>

        {isDonor ? (
          <View style={{ gap: Spacing[2] }}>
            <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>Donor settings</Text>
            <Card variant="surface" style={{ gap: Spacing[4] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">Available to donate</Text>
                  <Text variant="caption" tone="muted">Show up in nearby donor searches</Text>
                </View>
                <Switch
                  value={!!profile.is_available_to_donate}
                  onValueChange={(v) => toggle('is_available_to_donate', v)}
                  disabled={saving}
                  trackColor={{ true: theme.primary, false: theme.border }}
                  thumbColor={theme.textOnPrimary}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">Share medical history</Text>
                  <Text variant="caption" tone="muted">Visible to a recipient only after you accept</Text>
                </View>
                <Switch
                  value={!!profile.share_medical_history}
                  onValueChange={(v) => toggle('share_medical_history', v)}
                  disabled={saving}
                  trackColor={{ true: theme.primary, false: theme.border }}
                  thumbColor={theme.textOnPrimary}
                />
              </View>
            </Card>
          </View>
        ) : null}

        <View style={{ gap: Spacing[2] }}>
          <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>Appearance</Text>
          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            {APPEARANCE.map((a) => {
              const active = mode === a.value;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => { void Haptics.selectionAsync(); setMode(a.value); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={a.label}
                  style={{ flex: 1, alignItems: 'center', gap: Spacing[1], paddingVertical: Spacing[3], borderRadius: Radius.lg, borderCurve: 'continuous', borderWidth: 1.5, backgroundColor: active ? theme.primaryGhost : theme.surface, borderColor: active ? theme.primary : theme.border }}
                >
                  <Ionicons name={a.icon} size={20} color={active ? theme.primary : theme.textMuted} />
                  <Text variant="labelSm" tone={active ? 'brand' : 'muted'}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: Spacing[2] }}>
          <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>About</Text>
          <Card variant="surface" style={{ gap: Spacing[3] }}>
            <AboutRow icon="pricetag-outline" label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
            <AboutRow icon="document-text-outline" label="License" value="MIT" />
            <AboutRow icon="shield-checkmark-outline" label="Security" value="RLS + secure store" />
          </Card>
        </View>

        <Button label="Sign out" onPress={handleSignOut} variant="outline" size="lg" fullWidth icon="log-out-outline" haptic={false} />
      </ScrollView>
    </View>
  );
}

function AboutRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
      <Ionicons name={icon} size={18} color={theme.textTertiary} />
      <Text variant="bodySm" style={{ flex: 1 }}>{label}</Text>
      <Text variant="bodySm" tone="muted">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
