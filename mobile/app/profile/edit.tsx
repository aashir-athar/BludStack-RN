// app/profile/edit.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Request-screen design language for profile edit:
//   • Hero zone with close + title + brand-accent context pill.
//   • Sheet ascends -Spacing[5] over the hero with brand accent strip + handle
//     + spring entrance (same physics as the post-request flow).
//   • Bare sections under uppercase SectionLabel — no card wrappers.
//   • Blood-group 4×n grid identical to Request screen.
//   • Inline CTA at the end of the form: summary row + pill button + footer
//     micro-copy.
//   • Haptics on every choice. Reanimated worklets only.
//
// All fields go through apiUpdateProfile -> backend ALLOWED_FIELDS.
// Server-managed fields (push_token, total_donations, last_donation_date,
// is_verified) are not editable here — they're maintained by the server.
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing,
} from 'react-native-reanimated';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth, computeAge, type UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import Button from '@/components/Button';
import Input from '@/components/Input';
import SelectSheet from '@/components/SelectSheet';
import ToggleSwitch from '@/components/ToggleSwitch';
import {
  BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS, type BloodGroup,
} from '@/constants/BloodData';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Elevation,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';

const MIN_DONOR_AGE = 18;
const MAX_DONOR_AGE = 65;

// Sheet entrance — identical physics to Request screen and onboarding.
function useSheetEntrance() {
  const ty = useSharedValue(60);
  const op = useSharedValue(0);
  useEffect(() => {
    ty.value = withSpring(0, { damping: 16, stiffness: 180, mass: 0.6 });
    op.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [ty, op]);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
    opacity: op.value,
  }));
}

export default function ProfileEditScreen() {
  const { theme } = useTheme();
  const { profile, updateProfile, refreshProfile } = useAuth();
  const toast  = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // DOB is intentionally null when the user has never set it. Defaulting to
  // a fake date (e.g. 2000-01-01) would silently bypass the donor-age gate —
  // a donor could save without ever picking their real birthday and the
  // server would treat them as eligible. Null forces an explicit pick.
  const initialDob = useMemo<Date | null>(() => {
    if (!profile?.date_of_birth) return null;
    const d = new Date(profile.date_of_birth);
    return isNaN(d.getTime()) ? null : d;
  }, [profile?.date_of_birth]);

  const [fullName,    setFullName]    = useState(profile?.full_name ?? '');
  const [gender,      setGender]      = useState(profile?.gender ?? '');
  const [genderSheet, setGenderSheet] = useState(false);
  const [bloodGroup,  setBloodGroup]  = useState<BloodGroup | ''>((profile?.blood_group as BloodGroup) ?? '');
  const [phone,       setPhone]       = useState(profile?.phone ?? '');
  const [whatsapp,    setWhatsapp]    = useState(profile?.whatsapp_available ?? false);
  const [address,     setAddress]     = useState(profile?.address ?? '');
  const [conditions,  setConditions]  = useState<string[]>(profile?.medical_conditions ?? []);
  const [share,       setShare]       = useState(profile?.share_medical_history ?? false);
  const [available,   setAvailable]   = useState(profile?.is_available_to_donate ?? true);
  const [role,        setRole]        = useState<UserRole>((profile?.role as UserRole) ?? 'donor');
  const [dob,         setDob]         = useState<Date | null>(initialDob);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Late-hydration sync. The auth context can land the profile *after* this
  // screen mounts (cold-start, deep-link from a push, OTA refresh). Without
  // this effect, the form would stay on the empty defaults that the useState
  // initialisers captured at mount.
  //
  // We sync exactly ONCE per profile id (and never again on the same id), so
  // a realtime UPDATE on the profile row can't clobber an in-progress edit.
  // The `saving` and `pickerOpen` gates are belt-and-braces — they suppress
  // even the first sync if the user is mid-save or mid-pick.
  const syncedForIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || saving || pickerOpen) return;
    if (syncedForIdRef.current === profile.id) return;
    syncedForIdRef.current = profile.id;
    setFullName(profile.full_name ?? '');
    setGender(profile.gender ?? '');
    setBloodGroup((profile.blood_group as BloodGroup) ?? '');
    setPhone(profile.phone ?? '');
    setWhatsapp(profile.whatsapp_available ?? false);
    setAddress(profile.address ?? '');
    setConditions(profile.medical_conditions ?? []);
    setShare(profile.share_medical_history ?? false);
    setAvailable(profile.is_available_to_donate ?? true);
    setRole((profile.role as UserRole) ?? 'donor');
    if (profile.date_of_birth) {
      const d = new Date(profile.date_of_birth);
      if (!isNaN(d.getTime())) setDob(d);
    }
  }, [profile, saving, pickerOpen]);

  const dobIso = useCallback((): string | null => {
    return dob ? dob.toISOString().slice(0, 10) : null;
  }, [dob]);

  const age = useMemo(() => computeAge(dobIso()), [dobIso]);

  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') { setPickerOpen(false); return; }
    if (date) {
      Haptics.selectionAsync().catch(() => {});
      setDob(date);
    }
    if (Platform.OS !== 'ios') setPickerOpen(false);
  };

  const toggleCondition = useCallback((c: string) => {
    Haptics.selectionAsync().catch(() => {});
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }, []);

  const pickBlood = useCallback((g: BloodGroup) => {
    Haptics.selectionAsync().catch(() => {});
    setBloodGroup(g);
  }, []);

  const pickRole = useCallback((r: UserRole) => {
    Haptics.selectionAsync().catch(() => {});
    setRole(r);
  }, []);

  const toggleWA = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setWhatsapp(v => !v);
  }, []);

  const toggleShare = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setShare(v => !v);
  }, []);

  const toggleAvailable = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setAvailable(v => !v);
  }, []);

  const openGender = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setGenderSheet(true);
  }, []);

  const openDobPicker = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setPickerOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  }, [router]);

  const validate = useCallback((): string | null => {
    if (fullName.trim().length < 2) return 'Tell us the name you go by';
    if (!bloodGroup) return 'Select your blood group';
    if (phone.trim() && phone.replace(/\D/g, '').length < 7) return 'Phone number looks too short';
    if (role === 'donor' || role === 'both') {
      if (!age || age < MIN_DONOR_AGE) return `Donors must be ${MIN_DONOR_AGE} or older`;
      if (age > MAX_DONOR_AGE)         return `Donors must be ${MAX_DONOR_AGE} or younger`;
    }
    return null;
  }, [fullName, bloodGroup, phone, role, age]);

  const onSave = useCallback(async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await updateProfile({
        full_name:              fullName.trim(),
        gender:                 gender || undefined,
        date_of_birth:          dobIso(),
        address:                address.trim() || null,
        blood_group:            bloodGroup as BloodGroup,
        phone:                  phone.trim() || null,
        whatsapp_available:     phone.trim() ? whatsapp : false,
        medical_conditions:     role === 'recipient' ? [] : conditions,
        share_medical_history:  share,
        is_available_to_donate: role === 'recipient' ? false : available,
        role,
      });
      toast.success('Profile updated');
      await refreshProfile();
      router.back();
    } catch (e: any) {
      errorReporter.error(e, { screen: 'profile/edit' });
      toast.error("Couldn't save profile", { description: e?.message ?? 'Try again' });
    } finally {
      setSaving(false);
    }
  }, [
    validate, fullName, gender, dobIso, address, bloodGroup,
    phone, whatsapp, conditions, share, available, role,
    updateProfile, refreshProfile, router, toast,
  ]);

  const sheetEntrance = useSheetEntrance();
  const isDonorLike = role === 'donor' || role === 'both';

  // Summary line for the CTA — mirrors Request screen.
  const ctaSummary = useMemo(() => {
    const parts = [
      role === 'donor' ? 'Donor' : role === 'recipient' ? 'Recipient' : 'Both',
      bloodGroup || '—',
      fullName.trim() || 'no name',
    ];
    return parts.join('  ·  ');
  }, [role, bloodGroup, fullName]);

  if (!profile) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ─────────────────────── HERO (DECIDE) ───────────────────────────── */}
      <View style={[styles.hero, { paddingTop: Spacing[3], backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={closeModal} style={styles.backBtn} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={theme.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.textMuted }]}>
            Account · Profile
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={[styles.heroTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          Edit your profile
        </Text>
        <Text style={[styles.heroSub, { color: theme.textMuted }]} numberOfLines={2}>
          What you change here is what donors and recipients see when they're matched with you.
        </Text>

        {/* Status pill — parity with Request screen overlay pills */}
        <View style={[styles.heroPill, { backgroundColor: theme.surface, borderColor: theme.border }, Elevation.sm]}>
          <View style={[styles.heroPillDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.heroPillText, { color: theme.textMuted }]} numberOfLines={1}>
            Signed in as {profile.email}
          </Text>
        </View>
      </View>

      {/* ─────────────────────── SHEET (VERIFY) ──────────────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            marginTop: -Spacing[5],
          },
          Elevation.lg,
          sheetEntrance,
        ]}
      >
        <View style={styles.sheetTop}>
          <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing[5],
            paddingBottom: insets.bottom + Spacing[8],
            gap: Spacing[5],
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Identity ─────────────────────────────────────────────── */}
          <View>
            <SectionLabel theme={theme}>Identity</SectionLabel>
            <View style={{ gap: Spacing[3] }}>
              <Input
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                leftIcon={<Ionicons name="person-outline" size={18} color={theme.textMuted} />}
              />

              <Pressable onPress={openGender} accessibilityRole="button" accessibilityLabel="Pick gender">
                <View pointerEvents="none">
                  <Input
                    label="Gender"
                    value={gender}
                    editable={false}
                    placeholder="Select"
                    leftIcon={<Ionicons name="male-female-outline" size={18} color={theme.textMuted} />}
                    rightIcon={<Ionicons name="chevron-down" size={18} color={theme.textMuted} />}
                  />
                </View>
              </Pressable>

              <Pressable onPress={openDobPicker} accessibilityRole="button" accessibilityLabel="Pick date of birth">
                <View pointerEvents="none">
                  <Input
                    label="Date of birth"
                    value={dob ? dob.toLocaleDateString() : ''}
                    placeholder="Tap to pick"
                    editable={false}
                    leftIcon={<Ionicons name="calendar-outline" size={18} color={theme.textMuted} />}
                    rightIcon={<Ionicons name="chevron-down" size={18} color={theme.textMuted} />}
                  />
                </View>
              </Pressable>

              {pickerOpen && (
                <DateTimePicker
                  // DateTimePicker requires a non-null value, so we fall back
                  // to today when the user has never picked. The fallback is
                  // NEVER written back into `dob` state — it just primes the
                  // picker UI. `onPickerChange` only setDob() when the user
                  // explicitly picks (event.type !== 'dismissed').
                  value={dob ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={onPickerChange}
                />
              )}
            </View>
          </View>

          {/* ── Role (3 cards) ───────────────────────────────────────── */}
          <View>
            <SectionLabel theme={theme}>How will you use BludStack?</SectionLabel>
            <View style={{ gap: Spacing[3] }}>
              {ROLE_OPTIONS.map(o => {
                const selected = role === o.v;
                return (
                  <Pressable
                    key={o.v}
                    onPress={() => pickRole(o.v)}
                    style={[
                      roleStyles.card,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primarySoft : theme.cardElevated,
                      },
                      Elevation.xs,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[
                        roleStyles.iconPill,
                        { backgroundColor: selected ? theme.primary : theme.surface },
                      ]}
                    >
                      <Ionicons
                        name={o.icon}
                        size={18}
                        color={selected ? theme.textOnPrimary : theme.textPrimary}
                      />
                    </View>
                    <Text style={[roleStyles.label, { color: theme.textPrimary }]}>{o.label}</Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? theme.primary : theme.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Blood group (4×n grid — identical to Request screen) ── */}
          <View>
            <SectionLabel theme={theme}>Blood group</SectionLabel>
            <View style={bloodStyles.grid}>
              {BLOOD_GROUPS.map(g => {
                const selected = bloodGroup === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => pickBlood(g)}
                    style={[
                      bloodStyles.cell,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary : theme.cardElevated,
                      },
                      selected && Elevation.sm,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Blood group ${g}`}
                  >
                    <Text style={[
                      bloodStyles.label,
                      { color: selected ? theme.textOnPrimary : theme.textPrimary },
                    ]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Contact ──────────────────────────────────────────────── */}
          <View>
            <SectionLabel theme={theme}>Contact</SectionLabel>
            <View style={{ gap: Spacing[3] }}>
              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="+92 300 1234567"
                leftIcon={<Ionicons name="call-outline" size={18} color={theme.textMuted} />}
              />
              <ToggleSwitch
                label="I'm on WhatsApp"
                description="Matched contacts can open WhatsApp instead of calling"
                value={whatsapp}
                disabled={!phone.trim()}
                onValueChange={() => toggleWA()}
                iconName="logo-whatsapp"
              />
              <Input
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Street, area, city — for hospital staff who call you back"
                autoCapitalize="sentences"
                autoComplete="postal-address"
                variant="area"
                multiline
                leftIcon={<Ionicons name="location-outline" size={18} color={theme.textMuted} />}
              />
            </View>
          </View>

          {/* ── Medical history (donor / both only) ──────────────────── */}
          {isDonorLike && (
            <View>
              <SectionLabel theme={theme}>Medical history (optional)</SectionLabel>
              <View style={medStyles.wrap}>
                {MEDICAL_CONDITIONS.map(c => {
                  const selected = conditions.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCondition(c)}
                      style={[
                        medStyles.chip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.primarySoft : theme.cardElevated,
                        },
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                    >
                      {selected && <Ionicons name="checkmark" size={14} color={theme.primary} />}
                      <Text style={[
                        medStyles.chipLabel,
                        { color: selected ? theme.primary : theme.textPrimary, marginLeft: selected ? 4 : 0 },
                      ]}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ marginTop: Spacing[3] }}>
                <ToggleSwitch
                  label="Share these with matched recipients"
                  description="Off by default. On lets recipients see your disclosed conditions before you donate."
                  value={share}
                  onValueChange={() => toggleShare()}
                  iconName="eye-outline"
                />
              </View>
            </View>
          )}

          {/* ── Availability (donor / both only) ─────────────────────── */}
          {isDonorLike && (
            <View>
              <SectionLabel theme={theme}>Availability</SectionLabel>
              <ToggleSwitch
                label="Available to donate"
                description="Receive alerts when a compatible request comes in near you"
                value={available}
                onValueChange={() => toggleAvailable()}
                iconName="pulse-outline"
              />
            </View>
          )}

          {error && (
            <View style={[styles.errPill, { backgroundColor: theme.dangerSoft, borderColor: theme.danger }]}>
              <Ionicons name="warning" size={14} color={theme.danger} />
              <Text style={[styles.errText, { color: theme.danger }]}>{error}</Text>
            </View>
          )}

          {/* ── Inline CTA (ACT) — matches Request screen ────────────── */}
          <View style={styles.ctaInline}>
            <View style={styles.ctaSummary}>
              <View style={[styles.ctaSummaryDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.ctaSummaryText, { color: theme.textPrimary }]} numberOfLines={1}>
                <Text style={{ fontWeight: FontWeight.black, color: theme.primary }}>Save</Text>
                <Text style={{ color: theme.textMuted }}>{'  ·  '}</Text>
                <Text>{ctaSummary}</Text>
              </Text>
            </View>

            <Button
              label="Save changes"
              onPress={onSave}
              loading={saving}
              fullWidth size="xl"
              variant="primary"
              haptic={false}
              icon={<Ionicons name="checkmark-circle" size={18} color={theme.textOnPrimary} />}
              iconPosition="left"
            />

            <Text style={[styles.ctaFooterNote, { color: theme.textTertiary }]}>
              We never share your number, address, or medical history with anyone until a donor accepts a request you've posted.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      <SelectSheet
        visible={genderSheet}
        title="Gender"
        options={GENDER_OPTIONS.map(g => ({ label: g, value: g }))}
        value={gender}
        onSelect={v => { setGender(String(v)); setGenderSheet(false); }}
        onClose={() => setGenderSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section label — same shape as Request screen's local SectionLabel.
// ──────────────────────────────────────────────────────────────────────────────
function SectionLabel({ theme, children }: { theme: any; children: React.ReactNode }) {
  return (
    <Text style={{
      fontSize: FontSize.xs,
      fontWeight: FontWeight.black,
      letterSpacing: LetterSpacing.widest,
      textTransform: 'uppercase',
      color: theme.textMuted,
      marginLeft: Spacing[2],
      marginBottom: Spacing[2],
    }}>{children}</Text>
  );
}

const ROLE_OPTIONS: { v: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 'donor',     label: 'Donor only',                icon: 'water'  },
  { v: 'recipient', label: 'Recipient only',            icon: 'medkit' },
  { v: 'both',      label: 'Both — donor and recipient', icon: 'sync'   },
];

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ───────────────────────────────────────────────────────────────
  hero: {
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[10],
    gap: Spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
  },
  heroSub: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    marginTop: Spacing[1],
  },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[2], maxWidth: '100%',
  },
  heroPillDot: { width: 6, height: 6, borderRadius: 3 },
  heroPillText: {
    fontSize: FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    flexShrink: 1,
  },

  // ── Sheet ──────────────────────────────────────────────────────────────
  sheet: {
    flex: 1,
    borderTopLeftRadius:  Radius['2xl'],
    borderTopRightRadius: Radius['2xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTop: { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[3] },
  accentStrip: {
    width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1],
    opacity: 0.9,
  },
  handle: { width: 44, height: 4, borderRadius: 2 },

  // ── Error pill ─────────────────────────────────────────────────────────
  errPill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  errText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },

  // ── In-form CTA ────────────────────────────────────────────────────────
  ctaInline: {
    marginTop: Spacing[2],
    gap: Spacing[3],
  },
  ctaSummary: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[1],
  },
  ctaSummaryDot: { width: 8, height: 8, borderRadius: 4 },
  ctaSummaryText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
  ctaFooterNote: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    letterSpacing: LetterSpacing.snug,
    textAlign: 'center',
    paddingHorizontal: Spacing[4],
    lineHeight: FontSize.xs * 1.5,
  },
});

const roleStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  iconPill: {
    width: 36, height: 36, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
});

const bloodStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  cell: {
    width: '23%',
    paddingVertical: Spacing[4],
    alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  label: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tight,
  },
});

const medStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill, borderWidth: 1.5,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
  },
});

