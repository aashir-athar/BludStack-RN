// Lever: control - you own exactly what donors and recipients see about you,
// and you can change any of it in one place, any time. Every field is grouped,
// labelled, and reversible so editing never feels like a commitment you can't undo.
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/stores/authStore';
import { useAppTheme } from '@/stores/themeStore';
import { useToast } from '@/stores/toastStore';
import { editProfileSchema, type EditProfileForm } from '@/schemas';
import {
  BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS, type BloodGroup,
} from '@/constants/BloodData';
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from '@/utils/age';
import {
  FontSize, FontWeight, Spacing, Radius, Elevation,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';
import type { ThemeColors } from '@/constants/Colors';
import { View } from '@tamagui/core';
import { Button, Card, Input, ScreenHeader, SelectSheet, Text } from '@/ui';

type Role = EditProfileForm['role'];
type Gender = EditProfileForm['gender'];

// Module-level so the React-Compiler purity rule never sees `new Date()` in a
// render body. Returns YYYY-MM-DD for a Date.
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayDate(): Date {
  return new Date();
}

// DateTimePicker needs a non-null seed when the user has never picked a date.
// This is only the picker's starting wheel position - it is never written into
// the form until the user explicitly confirms a date.
function pickerSeed(dob: string | null): Date {
  if (dob) {
    const d = new Date(dob);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(2000, 0, 1);
}

const ROLE_LABEL: Record<Role, string> = {
  donor: 'Donor',
  recipient: 'Recipient',
  both: 'Both',
};

const ROLE_OPTIONS: { value: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'donor', label: 'Donor only', icon: 'water' },
  { value: 'recipient', label: 'Recipient only', icon: 'medkit' },
  { value: 'both', label: 'Both - donor and recipient', icon: 'sync' },
];

export default function ProfileEditScreen() {
  const theme = useAppTheme();
  const { profile, updateProfile } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const {
    control, handleSubmit, watch, setValue, getValues,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileForm>({
    // editProfileSchema preprocesses `phone`, so its zod input type differs from
    // its output type. We keep the resolved output type as the single field
    // values type and cast the resolver to match (same as onboarding).
    resolver: zodResolver(editProfileSchema) as Resolver<EditProfileForm>,
    mode: 'onTouched',
    defaultValues: {
      role: (profile?.role as Role) ?? 'donor',
      full_name: profile?.full_name ?? '',
      gender: (profile?.gender as Gender) ?? (undefined as unknown as Gender),
      // DOB stays null when never set so the donor age gate can't be silently
      // bypassed by a placeholder birthday.
      date_of_birth: profile?.date_of_birth ?? null,
      blood_group: (profile?.blood_group as BloodGroup) ?? (undefined as unknown as BloodGroup),
      phone: profile?.phone ?? null,
      whatsapp_available: profile?.whatsapp_available ?? false,
      medical_conditions: profile?.medical_conditions ?? [],
      share_medical_history: profile?.share_medical_history ?? false,
      is_available_to_donate: profile?.is_available_to_donate ?? true,
    },
  });

  // Address is not part of editProfileSchema but the profile patch accepts it,
  // so we track it as plain state alongside the form.
  const [address, setAddress] = useState(profile?.address ?? '');
  const [genderSheet, setGenderSheet] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const role = watch('role');
  const dob = watch('date_of_birth');
  const blood = watch('blood_group');
  const fullName = watch('full_name');
  const conditions = watch('medical_conditions');
  const share = watch('share_medical_history');
  const available = watch('is_available_to_donate');
  const whatsapp = watch('whatsapp_available');
  const phone = watch('phone');
  const gender = watch('gender');

  const isDonorLike = role === 'donor' || role === 'both';
  const hasPhone = !!(phone ?? '').toString().trim();
  const age = computeAge(dob);

  // Sheet entrance, mirrored from the auth + onboarding flows. Skipped under
  // reduced motion (shared values jump straight to their resting state).
  const ty = useSharedValue(reduceMotion ? 0 : 40);
  const op = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) { ty.value = 0; op.value = 1; return; }
    ty.value = withSpring(0, { damping: 16, stiffness: 180, mass: 0.6 });
    op.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [reduceMotion, ty, op]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: op.value }));

  const onPickDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (date) {
      void Haptics.selectionAsync();
      setValue('date_of_birth', toISODate(date), { shouldValidate: true, shouldTouch: true });
    }
  };

  const pickRole = (r: Role) => {
    void Haptics.selectionAsync();
    setValue('role', r, { shouldValidate: true, shouldTouch: true });
  };

  const pickBlood = (g: BloodGroup) => {
    void Haptics.selectionAsync();
    setValue('blood_group', g, { shouldValidate: true, shouldTouch: true });
  };

  const toggleCondition = (c: string) => {
    void Haptics.selectionAsync();
    const cur = getValues('medical_conditions');
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
    setValue('medical_conditions', next, { shouldTouch: true });
  };

  const closeModal = () => {
    void Haptics.selectionAsync();
    router.back();
  };

  const onSubmit = async (values: EditProfileForm) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const recipientOnly = values.role === 'recipient';
    try {
      await updateProfile({
        full_name: values.full_name.trim(),
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        blood_group: values.blood_group,
        phone: values.phone,
        whatsapp_available: values.phone ? values.whatsapp_available : false,
        medical_conditions: recipientOnly ? [] : values.medical_conditions,
        share_medical_history: values.share_medical_history,
        is_available_to_donate: recipientOnly ? false : values.is_available_to_donate,
        address: address.trim() || null,
        role: values.role,
      });
      toast.success('Profile saved', { description: 'Your changes are live now.' });
      router.back();
    } catch (e) {
      errorReporter.error(e, { screen: 'profile/edit' });
      toast.error("We couldn't save your profile", {
        description: e instanceof Error ? e.message : 'Check your connection and try again.',
      });
    }
  };

  const onSave = () => {
    void Haptics.selectionAsync();
    void handleSubmit(onSubmit, () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    })();
  };

  // Summary line for the CTA, mirrors the request screen's inline-CTA summary.
  const summaryLine = `${ROLE_LABEL[role]}  .  ${blood ?? 'no group'}  .  ${fullName.trim() || 'no name'}`;

  if (!profile) return null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Edit profile" onBack={closeModal} />

      <Animated.View style={[styles.body, sheetStyle]}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing[5],
            paddingBottom: insets.bottom + Spacing[8],
            gap: Spacing[4],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RNView style={[styles.contextPill, { backgroundColor: theme.surface, borderColor: theme.border }, Elevation.sm]}>
            <RNView style={[styles.contextDot, { backgroundColor: theme.primary }]} />
            <Text variant="overline" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              Signed in as {profile.email}
            </Text>
          </RNView>

          {/* ── Identity ─────────────────────────────────────────────── */}
          <Section title="Identity" hint="What donors and recipients see once you are matched.">
            <Controller
              control={control}
              name="full_name"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Full name"
                  placeholder="e.g. Aashir Athar"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.full_name?.message}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  leftIcon="person-outline"
                />
              )}
            />

            <Pressable
              onPress={() => { void Haptics.selectionAsync(); setGenderSheet(true); }}
              accessibilityRole="button"
              accessibilityLabel="Pick your gender"
            >
              <RNView pointerEvents="none">
                <Input
                  label="Gender"
                  placeholder="Select"
                  value={gender ?? ''}
                  editable={false}
                  error={errors.gender?.message}
                  leftIcon="male-female-outline"
                  rightIcon="chevron-down"
                />
              </RNView>
            </Pressable>

            <Pressable
              onPress={() => { void Haptics.selectionAsync(); setShowPicker(true); }}
              accessibilityRole="button"
              accessibilityLabel="Pick your date of birth"
            >
              <RNView pointerEvents="none">
                <Input
                  label="Date of birth"
                  placeholder="Tap to pick"
                  value={dob ?? ''}
                  editable={false}
                  error={errors.date_of_birth?.message}
                  leftIcon="calendar-outline"
                  rightIcon="chevron-down"
                />
              </RNView>
            </Pressable>

            {showPicker ? (
              <DateTimePicker
                value={pickerSeed(dob)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={todayDate()}
                minimumDate={new Date(1900, 0, 1)}
                onChange={onPickDate}
              />
            ) : null}

            {age !== null && isDonorLike ? <AgePill theme={theme} age={age} /> : null}
          </Section>

          {/* ── Role ─────────────────────────────────────────────────── */}
          <Section title="How will you use BludStack?" hint="Switching to donor re-checks the 18 to 65 age window.">
            <View style={{ gap: Spacing[3] }}>
              {ROLE_OPTIONS.map((opt) => {
                const selected = role === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => pickRole(opt.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={opt.label}
                    style={[
                      roleStyles.card,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primarySoft : theme.cardElevated,
                      },
                      Elevation.xs,
                    ]}
                  >
                    <RNView style={[roleStyles.iconPill, { backgroundColor: selected ? theme.primary : theme.surface }]}>
                      <Ionicons name={opt.icon} size={18} color={selected ? theme.textOnPrimary : theme.textPrimary} />
                    </RNView>
                    <Text variant="label" tone="primary" style={{ flex: 1 }}>{opt.label}</Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? theme.primary : theme.textTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </Section>

          {/* ── Blood group ──────────────────────────────────────────── */}
          <Section title="Blood group" hint="We match donors and recipients on compatibility.">
            <RNView style={bloodStyles.grid}>
              {BLOOD_GROUPS.map((g) => {
                const selected = blood === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => pickBlood(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Blood group ${g}`}
                    style={[
                      bloodStyles.cell,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.primary : theme.cardElevated,
                      },
                      selected ? Elevation.sm : null,
                    ]}
                  >
                    <Text variant="title" style={{ color: selected ? theme.textOnPrimary : theme.textPrimary }}>
                      {g}
                    </Text>
                  </Pressable>
                );
              })}
            </RNView>
            {errors.blood_group?.message ? (
              <Text variant="caption" tone="danger" style={{ marginLeft: Spacing[2] }}>
                {errors.blood_group.message}
              </Text>
            ) : null}
          </Section>

          {/* ── Contact ──────────────────────────────────────────────── */}
          <Section title="Contact" hint="Shared only after a match, never before.">
            <Controller
              control={control}
              name="phone"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Phone"
                  placeholder="+92 300 1234567"
                  value={value ?? ''}
                  onChangeText={(t) => onChange(t.length ? t : null)}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  leftIcon="call-outline"
                />
              )}
            />

            <ToggleRow
              theme={theme}
              icon="logo-whatsapp"
              title="I'm on WhatsApp"
              body="Lets matched contacts open WhatsApp instead of calling. Calls still work."
              value={hasPhone ? whatsapp : false}
              disabled={!hasPhone}
              accent="success"
              onValueChange={(v) => {
                void Haptics.selectionAsync();
                setValue('whatsapp_available', v, { shouldTouch: true });
              }}
            />

            <Input
              label="Address"
              placeholder="Street, area, city - for hospital staff who call you back"
              value={address}
              onChangeText={setAddress}
              autoCapitalize="sentences"
              autoComplete="postal-address"
              variant="area"
              leftIcon="location-outline"
            />
          </Section>

          {/* ── Medical history (donor / both only) ──────────────────── */}
          {isDonorLike ? (
            <Section title="Medical history" hint="Optional. Tap anything that applies.">
              <RNView style={medStyles.wrap}>
                {MEDICAL_CONDITIONS.map((c) => {
                  const selected = conditions.includes(c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => toggleCondition(c)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={c}
                      style={[
                        medStyles.chip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.primarySoft : theme.cardElevated,
                        },
                      ]}
                    >
                      {selected ? <Ionicons name="checkmark" size={14} color={theme.primary} /> : null}
                      <Text variant="label" tone={selected ? 'brand' : 'primary'}>{c}</Text>
                    </Pressable>
                  );
                })}
              </RNView>

              <ToggleRow
                theme={theme}
                icon="eye-outline"
                title="Share these with matched recipients"
                body="Off by default. On lets recipients see your disclosed conditions before you donate."
                value={share}
                accent="primary"
                onValueChange={(v) => {
                  void Haptics.selectionAsync();
                  setValue('share_medical_history', v, { shouldTouch: true });
                }}
              />
            </Section>
          ) : null}

          {/* ── Availability (donor / both only) ─────────────────────── */}
          {isDonorLike ? (
            <Section title="Availability" hint="Turn off to pause donor alerts without leaving the network.">
              <ToggleRow
                theme={theme}
                icon="pulse-outline"
                title="Available to donate"
                body="Get alerts when a compatible request comes in near you."
                value={available}
                accent="success"
                onValueChange={(v) => {
                  void Haptics.selectionAsync();
                  setValue('is_available_to_donate', v, { shouldTouch: true });
                }}
              />
            </Section>
          ) : null}

          {/* ── Inline CTA ───────────────────────────────────────────── */}
          <RNView style={styles.ctaInline}>
            <RNView style={styles.ctaSummary}>
              <RNView style={[styles.ctaSummaryDot, { backgroundColor: theme.primary }]} />
              <Text variant="label" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                <Text variant="label" style={{ color: theme.primary, fontWeight: FontWeight.black }}>Save</Text>
                <Text variant="label" tone="muted">{'  .  '}</Text>
                <Text variant="label" tone="secondary">{summaryLine}</Text>
              </Text>
            </RNView>

            <Button
              label="Save changes"
              onPress={onSave}
              loading={isSubmitting}
              loadingLabel="Saving"
              fullWidth
              size="xl"
              haptic={false}
              icon="checkmark-circle"
              accessibilityLabel="Save your profile changes"
            />

            <Text
              variant="caption"
              tone="tertiary"
              style={{ textAlign: 'center', paddingHorizontal: Spacing[4], lineHeight: FontSize.xs * 1.5 }}
            >
              We never share your number, address, or medical history until a donor accepts a request you posted.
            </Text>
          </RNView>
        </ScrollView>
      </Animated.View>

      <SelectSheet
        visible={genderSheet}
        title="Gender"
        options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
        value={gender}
        onSelect={(v) => {
          setValue('gender', v, { shouldValidate: true, shouldTouch: true });
          setGenderSheet(false);
        }}
        onClose={() => setGenderSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Local building blocks
// ──────────────────────────────────────────────────────────────────────────────

function Section({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <View style={{ gap: 2 }}>
        <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[1] }}>{title}</Text>
        {hint ? <Text variant="caption" tone="tertiary" style={{ marginLeft: Spacing[1] }}>{hint}</Text> : null}
      </View>
      <Card variant="elevated" pad="md" style={{ gap: Spacing[3] }}>
        {children}
      </Card>
    </View>
  );
}

function AgePill({ theme, age }: { theme: ThemeColors; age: number }) {
  const tooYoung = age < DONOR_MIN_AGE;
  const tooOld = age > DONOR_MAX_AGE;
  const eligible = !tooYoung && !tooOld;
  return (
    <RNView
      style={[
        agePillStyles.pill,
        {
          backgroundColor: eligible ? theme.successSoft : theme.warningSoft,
          borderColor: eligible ? theme.success : theme.warning,
        },
      ]}
    >
      <Ionicons
        name={eligible ? 'checkmark-circle' : 'warning'}
        size={16}
        color={eligible ? theme.success : theme.warning}
      />
      <Text variant="bodySm" style={{ color: theme.textPrimary, fontWeight: FontWeight.semibold, flexShrink: 1 }}>
        {`You're ${age}. `}
        {tooYoung
          ? `Donors need to be ${DONOR_MIN_AGE} or older.`
          : tooOld
            ? `Donors must be ${DONOR_MAX_AGE} or younger.`
            : 'Eligible to donate.'}
      </Text>
    </RNView>
  );
}

function ToggleRow({
  theme, icon, title, body, value, disabled, accent, onValueChange,
}: {
  theme: ThemeColors;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  value: boolean;
  disabled?: boolean;
  accent: 'primary' | 'success';
  onValueChange: (v: boolean) => void;
}) {
  return (
    <RNView style={[styles.toggleRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: disabled ? 0.55 : 1 }]}>
      <Ionicons name={icon} size={20} color={theme.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="titleSm">{title}</Text>
        <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>{body}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.border, true: accent === 'success' ? theme.success : theme.primary }}
        thumbColor={theme.surface}
        accessibilityLabel={title}
      />
    </RNView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },

  contextPill: {
    alignSelf: 'flex-start', maxWidth: '100%',
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
  },
  contextDot: { width: 6, height: 6, borderRadius: 3 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3], borderRadius: Radius.lg, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },

  ctaInline: { marginTop: Spacing[2], gap: Spacing[3] },
  ctaSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingHorizontal: Spacing[1] },
  ctaSummaryDot: { width: 8, height: 8, borderRadius: 4 },
});

const roleStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
    borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: 1.5,
  },
  iconPill: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});

const bloodStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  cell: {
    width: '23%', paddingVertical: Spacing[4], alignItems: 'center', justifyContent: 'center',
    borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: 1.5,
  },
});

const medStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill, borderWidth: 1.5,
  },
});

const agePillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
});
