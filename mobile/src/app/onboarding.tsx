// Lever: progressive disclosure + commitment escalation. Role is the first ask;
// every later step is conditional, so a person only ever sees the next decision
// they have to make, never a wall of fields. The final review CTA breathes to
// turn the last tap into a deliberate commitment.
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, SlideInRight, SlideOutLeft, useAnimatedStyle, useReducedMotion,
  useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { Controller, useForm, type Control, type Path, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/stores/authStore';
import { useAppTheme } from '@/stores/themeStore';
import { useToast } from '@/stores/toastStore';
import { apiRegister, type RegisterPayload } from '@/utils/api';
import { onboardingSchema, type OnboardingForm } from '@/schemas';
import {
  BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS, type BloodGroup,
} from '@/constants/BloodData';
import { computeAge, DONOR_MIN_AGE, DONOR_MAX_AGE } from '@/utils/age';
import {
  FontSize, FontWeight, Spacing, Radius, Motion, Elevation,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';
import type { ThemeColors } from '@/constants/Colors';
import { View } from '@tamagui/core';
import { BrandMark, Button, Input, SelectSheet, Text } from '@/ui';

type Role = OnboardingForm['role'];
type Gender = OnboardingForm['gender'];

type StepKey = 'role' | 'identity' | 'dob' | 'blood' | 'medical' | 'contact' | 'confirm';

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

function defaultDobDate(): Date {
  return new Date(2000, 0, 1);
}

const ROLE_LABEL: Record<Role, string> = {
  donor: 'Donor',
  recipient: 'Recipient',
  both: 'Donor and recipient',
};

// Section label shown above each step (uppercase overline).
const STEP_HEADLINE: Record<StepKey, string> = {
  role: 'Step 1 . How will you use BludStack',
  identity: 'Identity . How people see you',
  dob: 'Age . Eligibility check',
  blood: 'Compatibility . Blood group',
  medical: 'Disclosure . Health context',
  contact: 'Reach . Phone',
  confirm: 'Final . Last look',
};

// CTA copy mirrors the step. The confirm CTA breathes.
const STEP_CTA: Record<StepKey, string> = {
  role: 'Continue',
  identity: 'Next, date of birth',
  dob: 'Next, blood group',
  blood: 'Next, continue',
  medical: 'Next, phone',
  contact: 'Next, review',
  confirm: 'Save and continue',
};

// Fields validated (via RHF trigger) before advancing past each step.
const STEP_FIELDS: Record<StepKey, Path<OnboardingForm>[]> = {
  role: ['role'],
  identity: ['full_name', 'gender'],
  dob: ['date_of_birth'],
  blood: ['blood_group'],
  medical: ['medical_conditions'],
  contact: ['phone'],
  confirm: [],
};

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const {
    control, handleSubmit, watch, trigger, setValue, getValues,
    formState: { errors },
  } = useForm<OnboardingForm>({
    // onboardingSchema preprocesses `phone`, so its zod input type differs from
    // its output type. We keep the resolved output type (OnboardingForm) as the
    // single field-values type and cast the resolver to match.
    resolver: zodResolver(onboardingSchema) as Resolver<OnboardingForm>,
    mode: 'onTouched',
    defaultValues: {
      role: undefined as unknown as Role,
      full_name: '',
      gender: undefined as unknown as Gender,
      date_of_birth: null,
      blood_group: undefined as unknown as BloodGroup,
      phone: null,
      whatsapp_available: false,
      medical_conditions: [],
      share_medical_history: false,
      is_available_to_donate: true,
    },
  });

  const [stepIdx, setStepIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [genderSheet, setGenderSheet] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const role = watch('role');
  const isDonorLike = role === 'donor' || role === 'both';

  // Role-aware order. Recipients skip the medical-disclosure step.
  const steps: StepKey[] =
    !role
      ? ['role']
      : role === 'recipient'
        ? ['role', 'identity', 'dob', 'blood', 'contact', 'confirm']
        : ['role', 'identity', 'dob', 'blood', 'medical', 'contact', 'confirm'];

  const stepKey = steps[Math.min(stepIdx, steps.length - 1)] ?? 'role';
  const totalSteps = steps.length;
  const progress = Math.round(((stepIdx + 1) / totalSteps) * 100);
  const isFinal = stepKey === 'confirm';

  // Sheet entrance + breathing CTA (skipped under reduced motion).
  const ty = useSharedValue(reduceMotion ? 0 : 60);
  const op = useSharedValue(reduceMotion ? 1 : 0);
  const breath = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      ty.value = 0; op.value = 1; breath.value = 1;
      return;
    }
    ty.value = withSpring(0, { damping: 16, stiffness: 180, mass: 0.6 });
    op.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
  }, [reduceMotion, ty, op, breath]);

  useEffect(() => {
    if (reduceMotion) { breath.value = 1; return; }
    if (isFinal && !loading) {
      breath.value = withRepeat(
        withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1, true,
      );
    } else {
      breath.value = withTiming(1, { duration: 200 });
    }
  }, [isFinal, loading, reduceMotion, breath]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: op.value }));
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const dob = watch('date_of_birth');
  const dobAge = computeAge(dob);

  const onPickDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (date) setValue('date_of_birth', toISODate(date), { shouldValidate: true, shouldTouch: true });
  };

  const submit = async (values: OnboardingForm) => {
    if (!user?.id) return;
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const recipientOnly = values.role === 'recipient';
      const payload: RegisterPayload = {
        full_name: values.full_name.trim(),
        blood_group: values.blood_group,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        phone: values.phone,
        whatsapp_available: values.phone ? values.whatsapp_available : false,
        medical_conditions: recipientOnly ? [] : values.medical_conditions,
        share_medical_history: values.share_medical_history,
        is_available_to_donate: !recipientOnly,
        role: values.role,
      };
      const { downgraded } = await apiRegister(payload);
      if (downgraded) {
        toast.warning('Switched to recipient', {
          description: `Donors must be ${DONOR_MIN_AGE} to ${DONOR_MAX_AGE}. You can still post requests anytime.`,
        });
      } else {
        toast.success("You're in", { description: 'Welcome to the network.' });
      }
      await refreshProfile();
      // The root layout reacts to the new profile and routes onward.
    } catch (e) {
      errorReporter.error(e, { screen: 'onboarding/submit' });
      toast.error("We couldn't save your profile", {
        description: e instanceof Error ? e.message : 'Check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const goNext = async () => {
    void Haptics.selectionAsync();
    const fields = STEP_FIELDS[stepKey];
    const ok = fields.length === 0 ? true : await trigger(fields);
    if (!ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (stepIdx < totalSteps - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      void handleSubmit(submit)();
    }
  };

  const goBack = () => {
    if (stepIdx === 0) return;
    void Haptics.selectionAsync();
    setStepIdx(stepIdx - 1);
  };

  // CTA summary line, mirrors the request screen's inline-CTA summary.
  const ctaRole = role ? ROLE_LABEL[role] : 'pick a role';
  const ctaBlood = watch('blood_group') ?? 'no group';
  const ctaName = watch('full_name').trim() || 'no name';
  const ctaSummaryLine = `${ctaRole}  .  ${ctaBlood}  .  ${ctaName}`;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Hero: progress + step count ─────────────────────────────────── */}
      <RNView style={[styles.hero, { paddingTop: insets.top + Spacing[3] }]}>
        <RNView style={styles.headerRow}>
          {stepIdx > 0 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back to the previous step"
            >
              <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            </Pressable>
          ) : (
            <RNView style={styles.brandSlot}>
              <BrandMark size={24} />
            </RNView>
          )}
          <Text variant="overline" tone="muted">Step {stepIdx + 1} of {totalSteps}</Text>
          <RNView style={styles.brandSlot} />
        </RNView>

        <RNView style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <RNView style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
        </RNView>

        <RNView style={[styles.heroPill, { backgroundColor: theme.surface, borderColor: theme.border }, Elevation.sm]}>
          <RNView style={[styles.heroPillDot, { backgroundColor: isFinal ? theme.success : theme.primary }]} />
          <Text variant="overline" tone="muted" numberOfLines={1}>
            {isFinal ? 'Ready to save' : 'Setting up your profile'}
          </Text>
        </RNView>
      </RNView>

      {/* ── Ascending sheet ─────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
          Elevation.lg,
          sheetStyle,
        ]}
      >
        <RNView style={styles.sheetTop}>
          <RNView style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <RNView style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </RNView>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing[5],
            paddingBottom: insets.bottom + Spacing[8],
            gap: Spacing[5],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>
            {STEP_HEADLINE[stepKey]}
          </Text>

          <Animated.View
            key={stepKey}
            entering={reduceMotion ? undefined : SlideInRight.duration(Motion.duration.base)}
            exiting={reduceMotion ? undefined : SlideOutLeft.duration(Motion.duration.fast)}
            style={{ gap: Spacing[5] }}
          >
            {stepKey === 'role' && (
              <RoleStep
                theme={theme}
                value={role}
                error={errors.role?.message}
                onChange={(r) => {
                  void Haptics.selectionAsync();
                  setValue('role', r, { shouldValidate: true, shouldTouch: true });
                }}
              />
            )}

            {stepKey === 'identity' && (
              <View style={{ gap: Spacing[3] }}>
                <Text variant="headline">What should we call you?</Text>
                <Text variant="body" tone="muted">
                  Donors and recipients see this once you are matched.
                </Text>
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
                      value={watch('gender') ?? ''}
                      editable={false}
                      error={errors.gender?.message}
                      leftIcon="male-female-outline"
                      rightIcon="chevron-down"
                    />
                  </RNView>
                </Pressable>
              </View>
            )}

            {stepKey === 'dob' && (
              <DobStep
                theme={theme}
                dob={dob}
                age={dobAge}
                isDonorLike={isDonorLike}
                error={errors.date_of_birth?.message}
                showPicker={showPicker}
                onOpenPicker={() => { void Haptics.selectionAsync(); setShowPicker(true); }}
                onPickDate={onPickDate}
                onClear={() => setValue('date_of_birth', null, { shouldValidate: true, shouldTouch: true })}
              />
            )}

            {stepKey === 'blood' && (
              <BloodStep
                theme={theme}
                value={watch('blood_group')}
                error={errors.blood_group?.message}
                onChange={(g) => {
                  void Haptics.selectionAsync();
                  setValue('blood_group', g, { shouldValidate: true, shouldTouch: true });
                }}
              />
            )}

            {stepKey === 'medical' && (
              <MedicalStep
                theme={theme}
                conditions={watch('medical_conditions')}
                share={watch('share_medical_history')}
                onToggleCondition={(c) => {
                  void Haptics.selectionAsync();
                  const cur = getValues('medical_conditions');
                  const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
                  setValue('medical_conditions', next, { shouldTouch: true });
                }}
                onToggleShare={(v) => {
                  void Haptics.selectionAsync();
                  setValue('share_medical_history', v, { shouldTouch: true });
                }}
              />
            )}

            {stepKey === 'contact' && (
              <ContactStep
                theme={theme}
                control={control}
                phoneError={errors.phone?.message}
                whatsapp={watch('whatsapp_available')}
                hasPhone={!!(watch('phone') ?? '').toString().trim()}
                onToggleWhatsapp={(v) => {
                  void Haptics.selectionAsync();
                  setValue('whatsapp_available', v, { shouldTouch: true });
                }}
              />
            )}

            {stepKey === 'confirm' && (
              <ConfirmStep theme={theme} values={getValues()} age={dobAge} />
            )}
          </Animated.View>

          {/* ── Inline CTA ──────────────────────────────────────────────── */}
          <RNView style={styles.ctaInline}>
            <RNView style={styles.ctaSummary}>
              <RNView style={[styles.ctaSummaryDot, { backgroundColor: isFinal ? theme.success : theme.primary }]} />
              <Text variant="label" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                <Text variant="label" style={{ color: isFinal ? theme.success : theme.primary, fontWeight: FontWeight.black }}>
                  {isFinal ? 'Confirm' : `Step ${stepIdx + 1}/${totalSteps}`}
                </Text>
                <Text variant="label" tone="muted">{'  .  '}</Text>
                <Text variant="label" tone="secondary">{ctaSummaryLine}</Text>
              </Text>
            </RNView>

            <Animated.View style={breathStyle}>
              <Button
                label={STEP_CTA[stepKey]}
                onPress={goNext}
                loading={loading}
                loadingLabel="Saving"
                fullWidth
                size="xl"
                haptic={false}
                icon={isFinal ? 'shield-checkmark' : undefined}
                iconRight={isFinal ? undefined : 'arrow-forward'}
                accessibilityLabel={isFinal ? 'Save your profile and continue' : STEP_CTA[stepKey]}
              />
            </Animated.View>

            <Text
              variant="caption"
              tone="tertiary"
              style={{ textAlign: 'center', paddingHorizontal: Spacing[4], lineHeight: FontSize.xs * 1.5 }}
            >
              {isFinal
                ? 'Contact details are shared only after a match. You can edit anything later in Settings.'
                : 'You can change any answer later from your profile.'}
            </Text>
          </RNView>
        </ScrollView>
      </Animated.View>

      <SelectSheet
        visible={genderSheet}
        title="Gender"
        options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
        value={watch('gender')}
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
// Step sub-components. Each takes the theme explicitly (no hook in a child that
// would break the compiler) and wires haptics through the parent's handlers.
// ──────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: Role; title: string; body: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'donor', title: 'I want to donate', body: "I'm 18 or older and ready to give blood when someone nearby needs it.", icon: 'water' },
  { value: 'recipient', title: 'I need blood', body: 'I or someone close to me may need a donor.', icon: 'medkit' },
  { value: 'both', title: 'Both', body: 'I can donate, and I want to request if I ever need to.', icon: 'sync' },
];

function RoleStep({
  theme, value, error, onChange,
}: { theme: ThemeColors; value?: Role; error?: string; onChange: (r: Role) => void }) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">How will you use BludStack?</Text>
      <Text variant="body" tone="muted">Pick what fits today. You can change this later in Settings.</Text>

      <View style={{ gap: Spacing[3], marginTop: Spacing[2] }}>
        {ROLE_OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.title}
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
                <Ionicons name={opt.icon} size={20} color={selected ? theme.textOnPrimary : theme.textPrimary} />
              </RNView>
              <View style={{ flex: 1 }}>
                <Text variant="titleSm">{opt.title}</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: 2 }}>{opt.body}</Text>
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

      {error ? <Text variant="caption" tone="danger" style={{ marginLeft: Spacing[2] }}>{error}</Text> : null}
    </View>
  );
}

function DobStep({
  theme, dob, age, isDonorLike, error, showPicker, onOpenPicker, onPickDate, onClear,
}: {
  theme: ThemeColors;
  dob: string | null;
  age: number | null;
  isDonorLike: boolean;
  error?: string;
  showPicker: boolean;
  onOpenPicker: () => void;
  onPickDate: (e: DateTimePickerEvent, d?: Date) => void;
  onClear: () => void;
}) {
  const tooYoung = age !== null && age < DONOR_MIN_AGE;
  const tooOld = age !== null && age > DONOR_MAX_AGE;
  const eligible = age !== null && !tooYoung && !tooOld;

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">When were you born?</Text>
      <Text variant="body" tone="muted">
        {isDonorLike
          ? `Donors must be ${DONOR_MIN_AGE} or older. We never show your full date of birth to anyone.`
          : 'Optional. It helps us serve you better, and we never show it to anyone.'}
      </Text>

      <Pressable
        onPress={onOpenPicker}
        accessibilityRole="button"
        accessibilityLabel="Pick your date of birth"
      >
        <RNView pointerEvents="none">
          <Input
            label="Date of birth"
            placeholder="Select a date"
            value={dob ?? ''}
            editable={false}
            error={error}
            leftIcon="calendar-outline"
            rightIcon="chevron-down"
          />
        </RNView>
      </Pressable>

      {dob && !isDonorLike ? (
        <Pressable onPress={onClear} hitSlop={8} style={{ alignSelf: 'flex-start' }} accessibilityRole="button" accessibilityLabel="Clear date of birth">
          <Text variant="label" tone="primary">Clear date</Text>
        </Pressable>
      ) : null}

      {showPicker ? (
        <DateTimePicker
          value={dob ? new Date(dob) : defaultDobDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={todayDate()}
          minimumDate={new Date(1900, 0, 1)}
          onChange={onPickDate}
        />
      ) : null}

      {age !== null ? (
        <RNView
          style={[
            dobHelperStyles.pill,
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
          <Text variant="bodySm" style={{ color: theme.textPrimary, fontWeight: FontWeight.semibold }}>
            {`You're ${age}. `}
            {isDonorLike && tooYoung
              ? `Donors need to be ${DONOR_MIN_AGE} or older.`
              : isDonorLike && tooOld
                ? `Donors must be ${DONOR_MAX_AGE} or younger.`
                : 'Looks good.'}
          </Text>
        </RNView>
      ) : null}
    </View>
  );
}

function BloodStep({
  theme, value, error, onChange,
}: { theme: ThemeColors; value?: BloodGroup; error?: string; onChange: (g: BloodGroup) => void }) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">What's your blood group?</Text>
      <Text variant="body" tone="muted">
        We match donors and recipients on compatibility. If you are unsure, check your last donation card or ask your doctor.
      </Text>

      <RNView style={bloodStyles.grid}>
        {BLOOD_GROUPS.map((group) => {
          const selected = value === group;
          return (
            <Pressable
              key={group}
              onPress={() => onChange(group)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Blood group ${group}`}
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
                {group}
              </Text>
            </Pressable>
          );
        })}
      </RNView>

      {error ? <Text variant="caption" tone="danger" style={{ marginLeft: Spacing[2] }}>{error}</Text> : null}
    </View>
  );
}

function MedicalStep({
  theme, conditions, share, onToggleCondition, onToggleShare,
}: {
  theme: ThemeColors;
  conditions: string[];
  share: boolean;
  onToggleCondition: (c: string) => void;
  onToggleShare: (v: boolean) => void;
}) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">Anything a recipient should know?</Text>
      <Text variant="body" tone="muted">
        Tap anything that applies. We only show these to a recipient if you turn sharing on below.
      </Text>

      <RNView style={medStyles.wrap}>
        {MEDICAL_CONDITIONS.map((c) => {
          const selected = conditions.includes(c);
          return (
            <Pressable
              key={c}
              onPress={() => onToggleCondition(c)}
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

      <RNView style={[medStyles.shareRow, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
        <Ionicons name="eye-outline" size={20} color={theme.textMuted} />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm">Share these with matched recipients</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Off by default. Turn it on only if you want recipients to see this before you donate.
          </Text>
        </View>
        <Switch
          value={share}
          onValueChange={onToggleShare}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.surface}
          accessibilityLabel="Share medical conditions with matched recipients"
        />
      </RNView>
    </View>
  );
}

function ContactStep({
  theme, control, phoneError, whatsapp, hasPhone, onToggleWhatsapp,
}: {
  theme: ThemeColors;
  control: Control<OnboardingForm>;
  phoneError?: string;
  whatsapp: boolean;
  hasPhone: boolean;
  onToggleWhatsapp: (v: boolean) => void;
}) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">How can people reach you?</Text>
      <Text variant="body" tone="muted">
        Optional. A phone number lets a matched donor or recipient call you when seconds matter.
      </Text>

      <Controller
        control={control}
        name="phone"
        render={({ field: { value, onChange, onBlur } }) => (
          <Input
            label="Phone (optional)"
            placeholder="+92 300 1234567"
            value={value ?? ''}
            onChangeText={(t) => onChange(t.length ? t : null)}
            onBlur={onBlur}
            error={phoneError}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            leftIcon="call-outline"
          />
        )}
      />

      <RNView style={[medStyles.shareRow, { backgroundColor: theme.cardElevated, borderColor: theme.border, opacity: hasPhone ? 1 : 0.55 }]}>
        <Ionicons name="logo-whatsapp" size={20} color={theme.textMuted} />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm">I'm on WhatsApp</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            Lets matched contacts open WhatsApp directly. Calls still work normally.
          </Text>
        </View>
        <Switch
          value={hasPhone ? whatsapp : false}
          onValueChange={onToggleWhatsapp}
          disabled={!hasPhone}
          trackColor={{ false: theme.border, true: theme.success }}
          thumbColor={theme.surface}
          accessibilityLabel="I am reachable on WhatsApp"
        />
      </RNView>
    </View>
  );
}

function ConfirmStep({
  theme, values, age,
}: { theme: ThemeColors; values: OnboardingForm; age: number | null }) {
  const recipientOnly = values.role === 'recipient';
  const rows: { label: string; value: string }[] = [
    { label: 'Role', value: values.role ? ROLE_LABEL[values.role] : 'Not set' },
    { label: 'Name', value: values.full_name.trim() || 'Not set' },
    { label: 'Gender', value: values.gender ?? 'Not set' },
    ...(!recipientOnly ? [{ label: 'Age', value: age !== null ? `${age} years` : 'Not set' }] : []),
    { label: 'Blood group', value: values.blood_group ?? 'Not set' },
    { label: 'Phone', value: values.phone ?? 'Not shared' },
    ...(!recipientOnly
      ? [{ label: 'Conditions', value: values.medical_conditions.length ? `${values.medical_conditions.length} disclosed` : 'None' }]
      : []),
  ];

  return (
    <View style={{ gap: Spacing[3] }}>
      <Text variant="headline">Last look. Does this look right?</Text>
      <Text variant="body" tone="muted">
        Tap back to change anything. You can always edit your profile later.
      </Text>

      <RNView style={[confirmStyles.card, { backgroundColor: theme.cardElevated, borderColor: theme.border }, Elevation.xs]}>
        {rows.map((r, i) => (
          <RNView
            key={r.label}
            style={[
              confirmStyles.row,
              i < rows.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.divider } : null,
            ]}
          >
            <Text variant="bodySm" tone="muted">{r.label}</Text>
            <Text variant="bodySm" style={{ fontWeight: FontWeight.bold, maxWidth: '60%', textAlign: 'right' }}>{r.value}</Text>
          </RNView>
        ))}
      </RNView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  hero: { paddingHorizontal: Spacing[5], paddingBottom: Spacing[10], gap: Spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  brandSlot: { width: 40, alignItems: 'flex-start' },
  progressTrack: { height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.pill },
  heroPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing[1],
  },
  heroPillDot: { width: 6, height: 6, borderRadius: 3 },

  sheet: {
    flex: 1, marginTop: -Spacing[5],
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderCurve: 'continuous', borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTop: { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[3] },
  accentStrip: { width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1], opacity: 0.9 },
  handle: { width: 44, height: 4, borderRadius: 2 },

  ctaInline: { marginTop: Spacing[2], gap: Spacing[3] },
  ctaSummary: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingHorizontal: Spacing[1] },
  ctaSummaryDot: { width: 8, height: 8, borderRadius: 4 },
});

const roleStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: 1.5,
  },
  iconPill: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
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
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
  },
});

const confirmStyles = StyleSheet.create({
  card: { borderRadius: Radius.xl, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
  },
});

const dobHelperStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start',
  },
});
