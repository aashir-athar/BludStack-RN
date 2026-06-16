// app/onboarding.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Request-screen design language for onboarding:
//   • Hero zone with progress bar + step count (replaces Uber's map).
//   • Sheet ascends -Spacing[5] over the hero with brand accent strip + handle
//     + spring entrance.
//   • Section labels (uppercase, black weight, widest letter spacing).
//   • Inline CTA at the very end of each step's content — summary row + pill
//     button + footer micro-copy. The final confirm step's CTA breathes (loss-
//     aversion / commitment moment).
//   • Haptics on every Pressable. Reanimated worklets only.
//
// Lever: progressive disclosure + commitment escalation. Role choice is the
// first ask — every screen after it is conditional, so users only ever see
// the next decision they have to make, never a wall of fields.
//
// Server-enforced rules mirrored client-side (with kinder copy):
//   • Donor / Both => date_of_birth REQUIRED and age >= 18
//   • Recipient    => DOB and medical history are optional / skipped
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, withRepeat, Easing,
  SlideInRight, SlideOutLeft,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth, computeAge, type UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { apiRegister } from '@/utils/api';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BrandMark from '@/components/BrandMark';
import SelectSheet from '@/components/SelectSheet';
import ToggleSwitch from '@/components/ToggleSwitch';
import {
  BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS, type BloodGroup,
} from '@/constants/BloodData';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Motion, Elevation,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';

const MIN_DONOR_AGE = 18;
// WHO + most national blood-bank guidelines cap whole-blood donation at 65.
// Above that, the cardiovascular load of a 450 ml draw isn't safe to assume
// without a doctor's individual sign-off — out of scope for an app gate.
// Recipients have no upper-age limit.
const MAX_DONOR_AGE = 65;

type StepKey =
  | 'role'
  | 'identity'
  | 'dob'
  | 'blood'
  | 'medical'
  | 'contact'
  | 'confirm';

interface FormState {
  role:               UserRole | '';
  fullName:           string;
  gender:             string;
  dobDay:             string;
  dobMonth:           string;
  dobYear:            string;
  dobShownPicker:     boolean;
  dobPickerDate:      Date;
  bloodGroup:         BloodGroup | '';
  conditions:         string[];
  shareMedical:       boolean;
  phone:              string;
  whatsapp:           boolean;
}

const INITIAL_FORM: FormState = {
  role: '', fullName: '', gender: '',
  dobDay: '', dobMonth: '', dobYear: '',
  dobShownPicker: false, dobPickerDate: new Date(2000, 0, 1),
  bloodGroup: '', conditions: [], shareMedical: false,
  phone: '', whatsapp: false,
};

// Step label shown above each step's title — mirrors the Request screen's
// SectionLabel + tier label pattern.
const STEP_HEADLINE: Record<StepKey, string> = {
  role:     'Step 1 · How will you use BludStack?',
  identity: 'Identity · How donors and recipients see you',
  dob:      'Age · Eligibility check',
  blood:    'Compatibility · Blood group',
  medical:  'Disclosure · Health context (optional)',
  contact:  'Reach · Phone (optional)',
  confirm:  'Final · Last look',
};

// CTA copy mirrors step. The confirm step's CTA breathes for commitment.
const STEP_CTA: Record<StepKey, string> = {
  role: 'Continue',
  identity: 'Next · Date of birth',
  dob: 'Next · Blood group',
  blood: 'Next · Continue',
  medical: 'Next · Phone',
  contact: 'Next · Review',
  confirm: 'Save and continue',
};

// ── Sheet entrance + breathing utilities (same physics as Request screen) ──
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

const BreathingWrapper = React.memo(function BreathingWrapper({
  enabled, children,
}: { enabled: boolean; children: React.ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (enabled) {
      s.value = withRepeat(
        withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1, true,
      );
    } else {
      s.value = withTiming(1, { duration: 200 });
    }
  }, [enabled, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
});

export default function OnboardingScreen() {
  const { theme }     = useTheme();
  const { user, refreshProfile } = useAuth();
  const toast         = useToast();
  const insets        = useSafeAreaInsets();

  const [form, setForm]       = useState<FormState>(INITIAL_FORM);
  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [genderSheet, setGenderSheet] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<StepKey, string>>>({});

  // Role-aware step ordering — donors/both see DOB + medical; recipients skip.
  const steps = useMemo<StepKey[]>(() => {
    // DOB is shown to EVERY role.
    //   • Donor / Both → required + age-gated 18+ (validated below).
    //   • Recipient    → optional, can leave blank and continue. DobStep's
    //                    subtitle reads "Optional — helps us serve you better"
    //                    when roleRequiresAge18 is false.
    if (form.role === 'recipient') return ['role', 'identity', 'dob', 'blood', 'contact', 'confirm'];
    if (form.role === '')          return ['role'];
    return ['role', 'identity', 'dob', 'blood', 'medical', 'contact', 'confirm'];
  }, [form.role]);

  const stepKey    = steps[stepIdx] ?? 'role';
  const totalSteps = steps.length;
  const progress   = Math.round(((stepIdx + 1) / totalSteps) * 100);

  const update = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(prev => ({ ...prev, [k]: v }));
  }, []);

  const setError = useCallback((k: StepKey, v?: string) => {
    setErrors(prev => ({ ...prev, [k]: v }));
  }, []);

  // ── DOB helpers ──────────────────────────────────────────────────────────
  const dobISO = useCallback((): string | null => {
    const d = parseInt(form.dobDay, 10);
    const m = parseInt(form.dobMonth, 10);
    const y = parseInt(form.dobYear, 10);
    if (!d || !m || !y || y < 1900 || y > new Date().getFullYear()) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }, [form.dobDay, form.dobMonth, form.dobYear]);

  const dobAge = useMemo(() => computeAge(dobISO()), [dobISO]);

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') { update('dobShownPicker', false); return; }
    if (date) {
      update('dobPickerDate', date);
      update('dobDay',   String(date.getDate()));
      update('dobMonth', String(date.getMonth() + 1));
      update('dobYear',  String(date.getFullYear()));
    }
    if (Platform.OS !== 'ios') update('dobShownPicker', false);
  };

  const validate = useCallback((): boolean => {
    switch (stepKey) {
      case 'role':
        if (!form.role) { setError('role', 'Pick how you want to use BludStack'); return false; }
        break;
      case 'identity':
        if (form.fullName.trim().length < 2) { setError('identity', 'Tell us the name you go by'); return false; }
        if (!form.gender)                    { setError('identity', 'Select a gender to continue'); return false; }
        break;
      case 'dob': {
        const iso = dobISO();
        const isDonorLike = form.role === 'donor' || form.role === 'both';
        // Recipients can skip DOB entirely — leave blank and continue.
        // Donors / Both must enter a valid DOB AND be 18+.
        if (!iso) {
          if (isDonorLike) { setError('dob', 'Enter a valid date of birth'); return false; }
          break; // recipient: blank DOB is allowed
        }
        const age = computeAge(iso);
        if (age === null || age < 1 || age > 120) { setError('dob', "That date doesn't look right"); return false; }
        if (isDonorLike && age < MIN_DONOR_AGE) {
          setError('dob', `Donors must be ${MIN_DONOR_AGE} or older — switch to "Receive only" if you'd like to keep going`);
          return false;
        }
        if (isDonorLike && age > MAX_DONOR_AGE) {
          setError('dob', `Donors must be ${MAX_DONOR_AGE} or younger — switch to "Receive only" if you'd like to keep going`);
          return false;
        }
        break;
      }
      case 'blood':
        if (!form.bloodGroup) { setError('blood', 'Select your blood group'); return false; }
        break;
      case 'contact':
        if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 7) {
          setError('contact', 'Phone number looks too short'); return false;
        }
        break;
    }
    setError(stepKey, undefined);
    return true;
  }, [stepKey, form, dobISO, setError]);

  const submit = useCallback(async () => {
    if (!user?.id || !form.role || !form.bloodGroup) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { downgraded } = await apiRegister({
        full_name:              form.fullName.trim(),
        blood_group:            form.bloodGroup,
        gender:                 form.gender || undefined,
        date_of_birth:          dobISO(),
        phone:                  form.phone.trim() || null,
        whatsapp_available:     form.phone.trim() ? form.whatsapp : false,
        medical_conditions:     form.role === 'recipient' ? [] : form.conditions,
        share_medical_history:  form.shareMedical,
        is_available_to_donate: form.role !== 'recipient',
        role:                   form.role as UserRole,
      });

      if (downgraded) {
        toast.warning('Switched to recipient', {
          description: `Donors must be ${MIN_DONOR_AGE}–${MAX_DONOR_AGE}. You can still post requests anytime.`,
          duration: 6000,
        });
      } else {
        toast.success("You're in", { description: 'Welcome to the network.' });
      }
      await refreshProfile();
    } catch (e: any) {
      errorReporter.error(e, { screen: 'onboarding/submit' });
      toast.error("Couldn't save your profile", {
        description: e?.message ?? 'Check your connection and try again',
      });
    } finally {
      setLoading(false);
    }
  }, [user, form, dobISO, refreshProfile, toast]);

  const next = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (!validate()) return;
    if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
    else                          submit();
  }, [validate, stepIdx, totalSteps, submit]);

  const back = useCallback(() => {
    if (stepIdx > 0) {
      Haptics.selectionAsync().catch(() => {});
      setStepIdx(stepIdx - 1);
    }
  }, [stepIdx]);

  const sheetEntrance = useSheetEntrance();
  const isFinal = stepKey === 'confirm';

  // Short summary line for the CTA summary row — mirrors Request screen.
  const ctaSummaryLine = useMemo(() => {
    const role = form.role || 'role';
    const blood = form.bloodGroup || '—';
    return `${role}  ·  ${blood}  ·  ${form.fullName.trim() || 'no name'}`;
  }, [form.role, form.bloodGroup, form.fullName]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ─────────────────────── HERO (DECIDE) ───────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + Spacing[3], backgroundColor: theme.background }]}>
        <View style={styles.headerRow}>
          {stepIdx > 0 ? (
            <Pressable onPress={back} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            </Pressable>
          ) : (
            <View style={{ width: 40, alignItems: 'flex-start' }}>
              <BrandMark size={24} />
            </View>
          )}
          <Text style={[styles.stepCount, { color: theme.textMuted }]}>
            Step {stepIdx + 1} of {totalSteps}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
        </View>

        {/* Status pill, parity with Request screen's overlay pills */}
        <View style={[styles.heroPill, { backgroundColor: theme.surface, borderColor: theme.border }, Elevation.sm]}>
          <View style={[styles.heroPillDot, { backgroundColor: isFinal ? theme.success : theme.primary }]} />
          <Text style={[styles.heroPillText, { color: theme.textMuted }]} numberOfLines={1}>
            {isFinal ? 'Ready to save' : 'Onboarding in progress'}
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
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            {STEP_HEADLINE[stepKey]}
          </Text>

          <Animated.View
            key={stepKey}
            entering={SlideInRight.duration(Motion.duration.base)}
            exiting={SlideOutLeft.duration(Motion.duration.fast)}
            style={{ gap: Spacing[5] }}
          >
            {stepKey === 'role'     && (
              <RoleStep
                value={form.role}
                error={errors.role}
                onChange={r => {
                  Haptics.selectionAsync().catch(() => {});
                  update('role', r); setError('role', undefined);
                }}
              />
            )}
            {stepKey === 'identity' && (
              <IdentityStep
                fullName={form.fullName}
                gender={form.gender}
                error={errors.identity}
                onFullName={t => update('fullName', t)}
                onPickGender={() => { Haptics.selectionAsync().catch(() => {}); setGenderSheet(true); }}
              />
            )}
            {stepKey === 'dob'      && (
              <DobStep
                day={form.dobDay} month={form.dobMonth} year={form.dobYear}
                age={dobAge}
                error={errors.dob}
                roleRequiresAge18={form.role === 'donor' || form.role === 'both'}
                shownPicker={form.dobShownPicker}
                pickerDate={form.dobPickerDate}
                onDay={t => update('dobDay', t.replace(/\D/g, '').slice(0, 2))}
                onMonth={t => update('dobMonth', t.replace(/\D/g, '').slice(0, 2))}
                onYear={t => update('dobYear', t.replace(/\D/g, '').slice(0, 4))}
                onOpenPicker={() => update('dobShownPicker', true)}
                onPickerChange={handlePickerChange}
              />
            )}
            {stepKey === 'blood'    && (
              <BloodStep
                value={form.bloodGroup}
                error={errors.blood}
                onChange={g => {
                  Haptics.selectionAsync().catch(() => {});
                  update('bloodGroup', g); setError('blood', undefined);
                }}
              />
            )}
            {stepKey === 'medical'  && (
              <MedicalStep
                conditions={form.conditions}
                share={form.shareMedical}
                onToggleCondition={c => {
                  Haptics.selectionAsync().catch(() => {});
                  const nextC = form.conditions.includes(c)
                    ? form.conditions.filter(x => x !== c)
                    : [...form.conditions, c];
                  update('conditions', nextC);
                }}
                onToggleShare={() => {
                  Haptics.selectionAsync().catch(() => {});
                  update('shareMedical', !form.shareMedical);
                }}
              />
            )}
            {stepKey === 'contact'  && (
              <ContactStep
                phone={form.phone} whatsapp={form.whatsapp}
                error={errors.contact}
                onPhone={t => update('phone', t)}
                onToggleWA={() => {
                  Haptics.selectionAsync().catch(() => {});
                  update('whatsapp', !form.whatsapp);
                }}
              />
            )}
            {stepKey === 'confirm'  && (
              <ConfirmStep form={form} dobAge={dobAge} />
            )}
          </Animated.View>

          {/* ── Inline CTA (ACT) ─────────────────────────────────────────── */}
          <View style={styles.ctaInline}>
            <View style={styles.ctaSummary}>
              <View style={[styles.ctaSummaryDot, { backgroundColor: isFinal ? theme.success : theme.primary }]} />
              <Text style={[styles.ctaSummaryText, { color: theme.textPrimary }]} numberOfLines={1}>
                <Text style={{ fontWeight: FontWeight.black, color: isFinal ? theme.success : theme.primary }}>
                  {isFinal ? 'Confirm' : `Step ${stepIdx + 1}/${totalSteps}`}
                </Text>
                <Text style={{ color: theme.textMuted }}>{'  ·  '}</Text>
                <Text>{ctaSummaryLine}</Text>
              </Text>
            </View>

            <BreathingWrapper enabled={isFinal && !loading}>
              <Button
                label={STEP_CTA[stepKey]}
                onPress={next}
                loading={loading}
                fullWidth size="xl"
                variant="primary"
                haptic={false}
                icon={
                  <Ionicons
                    name={isFinal ? 'shield-checkmark' : 'arrow-forward'}
                    size={18}
                    color={theme.textOnPrimary}
                  />
                }
                iconPosition={isFinal ? 'left' : 'right'}
              />
            </BreathingWrapper>

            <Text style={[styles.ctaFooterNote, { color: theme.textTertiary }]}>
              {isFinal
                ? 'By saving, you agree contact details are only shared after a match. You can edit anything later in Settings.'
                : 'You can change any answer later from your profile.'}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      <SelectSheet
        visible={genderSheet}
        title="Gender"
        options={GENDER_OPTIONS.map(g => ({ label: g, value: g }))}
        value={form.gender}
        onSelect={v => { update('gender', String(v)); setGenderSheet(false); }}
        onClose={() => setGenderSheet(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Step sub-components — theme-token only, no emoji, haptic-wired via parent.
// ──────────────────────────────────────────────────────────────────────────────

function RoleStep({
  value, error, onChange,
}: { value: UserRole | ''; error?: string; onChange: (r: UserRole) => void }) {
  const { theme } = useTheme();
  const options: { value: UserRole; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'donor',     title: 'I want to donate',          body: "I'm 18+ and ready to give blood when someone nearby needs it.", icon: 'water' },
    { value: 'recipient', title: 'I need blood',              body: 'I or someone close to me may need a donor.',                    icon: 'medkit' },
    { value: 'both',      title: 'Both',                      body: 'I can donate, and I want to be able to request if needed.',     icon: 'sync' },
  ];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>How will you use BludStack?</Text>
      <Text style={titleStyles(theme).subtitle}>
        Pick what fits today. You can change this later in Settings.
      </Text>

      <View style={{ gap: Spacing[3], marginTop: Spacing[2] }}>
        {options.map(opt => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
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
                  name={opt.icon}
                  size={20}
                  color={selected ? theme.textOnPrimary : theme.textPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[roleStyles.cardTitle, { color: theme.textPrimary }]}>{opt.title}</Text>
                <Text style={[roleStyles.cardBody,  { color: theme.textMuted }]}>{opt.body}</Text>
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={selected ? theme.primary : theme.textTertiary}
              />
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={[helperStyle(theme).err, { marginTop: Spacing[1] }]}>{error}</Text>}
    </View>
  );
}

function IdentityStep({
  fullName, gender, error, onFullName, onPickGender,
}: {
  fullName: string; gender: string; error?: string;
  onFullName: (s: string) => void; onPickGender: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>What should we call you?</Text>
      <Text style={titleStyles(theme).subtitle}>
        Donors and recipients see this when they're matched with you.
      </Text>

      <Input
        label="Full name"
        placeholder="e.g. Aashir Athar"
        value={fullName}
        onChangeText={onFullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        leftIcon={<Ionicons name="person-outline" size={18} color={theme.textMuted} />}
      />

      <Pressable onPress={onPickGender} accessibilityRole="button" accessibilityLabel="Pick gender">
        <View pointerEvents="none">
          <Input
            label="Gender"
            placeholder="Select"
            value={gender}
            editable={false}
            leftIcon={<Ionicons name="male-female-outline" size={18} color={theme.textMuted} />}
            rightIcon={<Ionicons name="chevron-down" size={18} color={theme.textMuted} />}
          />
        </View>
      </Pressable>

      {error && <Text style={helperStyle(theme).err}>{error}</Text>}
    </View>
  );
}

function DobStep({
  day, month, year, age, error, roleRequiresAge18,
  shownPicker, pickerDate,
  onDay, onMonth, onYear, onOpenPicker, onPickerChange,
}: {
  day: string; month: string; year: string; age: number | null;
  error?: string; roleRequiresAge18: boolean;
  shownPicker: boolean; pickerDate: Date;
  onDay: (t: string) => void; onMonth: (t: string) => void; onYear: (t: string) => void;
  onOpenPicker: () => void;
  onPickerChange: (e: DateTimePickerEvent, d?: Date) => void;
}) {
  const { theme } = useTheme();
  // Donor eligibility window: 18-65 inclusive. Outside this range we surface
  // a warning pill and (on submit) downgrade to recipient.
  const tooYoung = age !== null && age < MIN_DONOR_AGE;
  const tooOld   = age !== null && age > MAX_DONOR_AGE;
  const eligible = age !== null && !tooYoung && !tooOld;
  const showHelper = age !== null;

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>When were you born?</Text>
      <Text style={titleStyles(theme).subtitle}>
        {roleRequiresAge18
          ? `Donors must be ${MIN_DONOR_AGE} or older. We won't show your full date of birth to anyone.`
          : "Optional — helps us serve you better. We don't show it to anyone."}
      </Text>

      <View style={{ flexDirection: 'row', gap: Spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Input label="Day"   placeholder="DD" value={day}   onChangeText={onDay}   keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Month" placeholder="MM" value={month} onChangeText={onMonth} keyboardType="number-pad" maxLength={2} />
        </View>
        <View style={{ flex: 1.4 }}>
          <Input label="Year"  placeholder="YYYY" value={year} onChangeText={onYear} keyboardType="number-pad" maxLength={4} />
        </View>
      </View>

      <Pressable onPress={onOpenPicker} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
        <Text style={[helperStyle(theme).link, { color: theme.primary }]}>
          Or pick a date
        </Text>
      </Pressable>

      {shownPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
          onChange={onPickerChange}
        />
      )}

      {showHelper && (
        <View
          style={[
            dobHelperStyles.pill,
            {
              backgroundColor: eligible ? theme.successSoft : theme.warningSoft,
              borderColor:     eligible ? theme.success     : theme.warning,
            },
          ]}
        >
          <Ionicons
            name={eligible ? 'checkmark-circle' : 'warning'}
            size={16}
            color={eligible ? theme.success : theme.warning}
          />
          <Text style={[dobHelperStyles.text, { color: theme.textPrimary }]}>
            {`You're ${age}. `}
            {roleRequiresAge18 && tooYoung
              ? `Donors need to be ${MIN_DONOR_AGE}+ — we'll switch you to recipient.`
              : roleRequiresAge18 && tooOld
                ? `Donors must be ${MAX_DONOR_AGE} or younger — we'll switch you to recipient.`
                : 'Looks good.'}
          </Text>
        </View>
      )}

      {error && <Text style={helperStyle(theme).err}>{error}</Text>}
    </View>
  );
}

function BloodStep({
  value, error, onChange,
}: { value: BloodGroup | ''; error?: string; onChange: (g: BloodGroup) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>What's your blood group?</Text>
      <Text style={titleStyles(theme).subtitle}>
        We match donors and recipients on compatibility. If you don't know, ask your doctor or check your last donation card.
      </Text>

      <View style={bloodStyles.grid}>
        {BLOOD_GROUPS.map(group => {
          const selected = value === group;
          return (
            <Pressable
              key={group}
              onPress={() => onChange(group)}
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
              accessibilityLabel={`Blood group ${group}`}
            >
              <Text style={[
                bloodStyles.label,
                { color: selected ? theme.textOnPrimary : theme.textPrimary },
              ]}>
                {group}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Text style={helperStyle(theme).err}>{error}</Text>}
    </View>
  );
}

function MedicalStep({
  conditions, share, onToggleCondition, onToggleShare,
}: {
  conditions: string[]; share: boolean;
  onToggleCondition: (c: string) => void; onToggleShare: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>Any conditions a recipient should know about?</Text>
      <Text style={titleStyles(theme).subtitle}>
        Tap anything that applies. We only share these with a recipient if you turn sharing on below.
      </Text>

      <View style={medStyles.wrap}>
        {MEDICAL_CONDITIONS.map(c => {
          const selected = conditions.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => onToggleCondition(c)}
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
                { color: selected ? theme.primary : theme.textPrimary },
              ]}>
                {c}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ToggleSwitch
        label="Share these with matched recipients"
        description="Off by default. Turn on only if you want recipients to see this before you donate."
        value={share}
        onValueChange={() => onToggleShare()}
        iconName="eye-outline"
      />
    </View>
  );
}

function ContactStep({
  phone, whatsapp, error, onPhone, onToggleWA,
}: {
  phone: string; whatsapp: boolean; error?: string;
  onPhone: (t: string) => void; onToggleWA: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>How can we reach you?</Text>
      <Text style={titleStyles(theme).subtitle}>
        Optional. A phone number lets a matched donor or recipient call you when seconds matter.
      </Text>

      <Input
        label="Phone (optional)"
        placeholder="+92 300 1234567"
        value={phone}
        onChangeText={onPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        leftIcon={<Ionicons name="call-outline" size={18} color={theme.textMuted} />}
      />

      <ToggleSwitch
        label="I'm on WhatsApp"
        description="Lets matched contacts open WhatsApp directly. Calls still work normally."
        value={whatsapp}
        disabled={!phone.trim()}
        onValueChange={() => onToggleWA()}
        iconName="logo-whatsapp"
      />

      {error && <Text style={helperStyle(theme).err}>{error}</Text>}
    </View>
  );
}

function ConfirmStep({ form, dobAge }: { form: FormState; dobAge: number | null }) {
  const { theme } = useTheme();
  const roleLabel =
    form.role === 'donor'       ? 'Donor'
    : form.role === 'recipient' ? 'Recipient'
    : form.role === 'both'      ? 'Donor and recipient'
    :                              '—';

  const rows: { label: string; value: string }[] = [
    { label: 'Role',          value: roleLabel },
    { label: 'Name',          value: form.fullName || '—' },
    { label: 'Gender',        value: form.gender   || '—' },
    ...(form.role !== 'recipient'
      ? [{ label: 'Date of birth', value: dobAge !== null ? `${dobAge} years` : '—' }]
      : []),
    { label: 'Blood group',   value: form.bloodGroup || '—' },
    { label: 'Phone',         value: form.phone || 'Not shared' },
    ...(form.role !== 'recipient'
      ? [{ label: 'Conditions',  value: form.conditions.length ? `${form.conditions.length} disclosed` : 'None' }]
      : []),
  ];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text style={titleStyles(theme).title}>Last look — does this look right?</Text>
      <Text style={titleStyles(theme).subtitle}>
        Tap back to change anything. You can always edit your profile later.
      </Text>

      <View
        style={[
          confirmStyles.card,
          { backgroundColor: theme.cardElevated, borderColor: theme.border },
          Elevation.xs,
        ]}
      >
        {rows.map((r, i) => (
          <View key={r.label} style={[
            confirmStyles.row,
            i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.divider },
          ]}>
            <Text style={[confirmStyles.k, { color: theme.textMuted }]}>{r.label}</Text>
            <Text style={[confirmStyles.v, { color: theme.textPrimary }]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Shared style factories
// ──────────────────────────────────────────────────────────────────────────────

const titleStyles = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  title: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
    lineHeight: FontSize['2xl'] * 1.15,
    color: theme.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.55,
    color: theme.textMuted,
  },
});

const helperStyle = (theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  err:  { fontSize: FontSize.sm, color: theme.danger, fontWeight: FontWeight.semibold, marginLeft: Spacing[2] },
  link: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug },
});

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
  },
  backBtn: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  stepCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
  },
  progressTrack: { height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: Radius.pill },
  heroPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[1],
  },
  heroPillDot: { width: 6, height: 6, borderRadius: 3 },
  heroPillText: {
    fontSize: FontSize['2xs'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
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

  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginLeft: Spacing[2],
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
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  iconPill: {
    width: 40, height: 40, borderRadius: Radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
  cardBody: {
    fontSize: FontSize.sm,
    marginTop: 2,
    lineHeight: FontSize.sm * 1.5,
  },
});

const bloodStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
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
    flexDirection: 'row', alignItems: 'center', gap: Spacing[1],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
  shareBody: {
    fontSize: FontSize.xs,
    marginTop: 2,
    lineHeight: FontSize.xs * 1.5,
  },
  toggle: {
    width: 48, height: 28, borderRadius: Radius.pill, padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleDot: { width: 24, height: 24, borderRadius: 12 },
});

const confirmStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
  },
  k: { fontSize: FontSize.sm, letterSpacing: LetterSpacing.snug },
  v: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.snug, maxWidth: '60%', textAlign: 'right' },
});

const dobHelperStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
