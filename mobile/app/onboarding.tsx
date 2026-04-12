// app/onboarding.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import Button from '@/components/Button';
import Input from '@/components/Input';
import SelectSheet from '@/components/SelectSheet';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { BLOOD_GROUPS, GENDER_OPTIONS, MEDICAL_CONDITIONS, BloodGroup } from '@/constants/BloodData';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Your Info', 'Blood & Health', 'Phone', 'Availability'];

export default function OnboardingScreen() {
  const { theme }            = useTheme();
  const { user, refreshProfile } = useAuth();
  const insets               = useSafeAreaInsets();
  const { width }            = useWindowDimensions();

  const [step, setStep]       = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  // Step 0 — Basic info
  const [fullName, setFullName]                     = useState('');
  const [gender, setGender]                         = useState('');
  const [genderVisible, setGenderVisible]           = useState(false);

  // Step 1 — Blood & medical
  const [bloodGroup, setBloodGroup]                 = useState<BloodGroup | ''>('');
  const [conditions, setConditions]                 = useState<string[]>([]);
  const [shareMedical, setShareMedical]             = useState(false);

  // Step 2 — Phone (saved in DB only, not used for auth)
  const [phone, setPhone]                           = useState('');

  // Step 3 — Availability
  const [isAvailable, setIsAvailable]               = useState(true);

  const genderOptions = GENDER_OPTIONS.map((g) => ({ label: g, value: g }));

  const toggleCondition = useCallback((c: string) => {
    setConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  }, []);

  /* ── Validate current step before advancing ─────────────── */
  const canAdvance = useCallback((): boolean => {
    if (step === 0) {
      if (!fullName.trim()) { Alert.alert('Required', 'Please enter your full name.'); return false; }
      if (!gender)          { Alert.alert('Required', 'Please select your gender.'); return false; }
    }
    if (step === 1) {
      if (!bloodGroup) { Alert.alert('Required', 'Please select your blood group.'); return false; }
    }
    return true;
  }, [step, fullName, gender, bloodGroup]);

  /* ── Final submit ───────────────────────────────────────── */
  const submit = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const payload = {
        id:                     user.id,
        email:                  user.email ?? '',
        full_name:              fullName.trim(),
        gender,
        blood_group:            bloodGroup as BloodGroup,
        phone:                  phone.trim() || null,       // ← saved but not used for auth
        medical_conditions:     conditions,
        share_medical_history:  shareMedical,
        is_available_to_donate: isAvailable,
        total_donations:        0,
        is_verified:            false,
        updated_at:             new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;

      // Refresh profile in AuthContext — this triggers the redirect to (tabs)
      await refreshProfile();
    } catch (e: any) {
      console.error('Onboarding submit error:', e);
      Alert.alert('Error saving profile', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, fullName, gender, bloodGroup, phone, conditions, shareMedical, isAvailable, refreshProfile]);

  const nextStep = useCallback(() => {
    if (!canAdvance()) return;
    if (step < 3) setStep((s) => (s + 1) as Step);
    else          submit();
  }, [step, canAdvance, submit]);

  const maxW = Math.min(width, 520);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress bar */}
      <View style={[styles.progressWrap, { paddingTop: insets.top + Spacing[3], backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.stepsRow}>
          {STEPS.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.dot, { backgroundColor: i <= step ? theme.primary : theme.border }]}>
                <Text style={[styles.dotLabel, { color: i <= step ? '#fff' : theme.textMuted }]}>
                  {i < step ? '✓' : i + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: i === step ? theme.textPrimary : theme.textMuted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { backgroundColor: theme.primary, width: `${((step + 1) / 4) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[8] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: maxW, alignSelf: 'center' }}>

          {/* ── Step 0: Basic info ─────────────────────────── */}
          {step === 0 && (
            <View style={styles.body}>
              <Text style={styles.emoji}>👤</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Tell us about yourself</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Your name and gender help donors and recipients identify and trust each other.
              </Text>

              {/* Signed-in email (read-only) */}
              <View style={[styles.emailRow, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                <Text style={{ fontSize: 16 }}>✉️</Text>
                <View>
                  <Text style={[styles.emailLabel, { color: theme.textMuted }]}>Signed in as</Text>
                  <Text style={[styles.emailValue, { color: theme.textPrimary }]}>{user?.email}</Text>
                </View>
              </View>

              <Input
                label="Full Name"
                placeholder="e.g. Muhammad Ali"
                value={fullName}
                onChangeText={setFullName}
                leftIcon={<Text>✏️</Text>}
                autoFocus
              />

              <TouchableOpacity
                onPress={() => setGenderVisible(true)}
                style={[styles.pickerRow, { backgroundColor: theme.inputBg, borderColor: gender ? theme.inputFocus : theme.inputBorder }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>Gender</Text>
                <Text style={[styles.pickerValue, { color: gender ? theme.textPrimary : theme.textMuted }]}>
                  {gender || 'Select…'}
                </Text>
                <Text style={{ color: theme.textMuted }}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 1: Blood & Medical ─────────────────────── */}
          {step === 1 && (
            <View style={styles.body}>
              <Text style={styles.emoji}>🩸</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Your blood profile</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Used to match you with compatible donors or recipients in seconds.
              </Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Blood Group *</Text>
              <View style={styles.bloodGrid}>
                {BLOOD_GROUPS.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    onPress={() => setBloodGroup(bg)}
                    style={[
                      styles.bloodBtn,
                      {
                        borderColor:     bloodGroup === bg ? theme.primary : theme.border,
                        backgroundColor: bloodGroup === bg ? `${theme.primary}18` : theme.card,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <BloodGroupBadge bloodGroup={bg} size="md" showGlow={bloodGroup === bg} />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: theme.textSecondary, marginTop: Spacing[4] }]}>
                Medical Conditions{' '}
                <Text style={{ fontWeight: FontWeight.regular, fontSize: FontSize.xs }}>(optional)</Text>
              </Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Tap any that apply. Helps ensure safe donations.
              </Text>
              <View style={styles.condGrid}>
                {MEDICAL_CONDITIONS.map((c) => {
                  const sel = conditions.includes(c);
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => toggleCondition(c)}
                      style={[
                        styles.condChip,
                        {
                          backgroundColor: sel ? `${theme.warning}22` : theme.muted,
                          borderColor:     sel ? theme.warning : theme.border,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.condText, { color: sel ? theme.warning : theme.textSecondary }]}>
                        {sel ? '✓ ' : ''}{c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {conditions.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShareMedical(!shareMedical)}
                  style={[
                    styles.shareBox,
                    { backgroundColor: shareMedical ? `${theme.accent}12` : theme.muted, borderColor: theme.border },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 20 }}>{shareMedical ? '👁' : '🔒'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shareTitle, { color: theme.textPrimary }]}>
                      {shareMedical ? 'Sharing medical history' : 'Medical history is private'}
                    </Text>
                    <Text style={[styles.shareHint, { color: theme.textMuted }]}>
                      Tap to {shareMedical ? 'hide' : 'share'} with matched donors/recipients
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Step 2: Phone number ─────────────────────────── */}
          {step === 2 && (
            <View style={styles.body}>
              <Text style={styles.emoji}>📱</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Add your phone number</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                So donors and recipients can call or message you in emergencies.
                This is optional but strongly recommended.
              </Text>

              <Input
                label="Phone Number (optional)"
                placeholder="+92 300 1234567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                leftIcon={<Text>📞</Text>}
                hint="Include country code for international format"
              />

              <View style={[styles.infoBox, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                <Text style={{ fontSize: 16 }}>ℹ️</Text>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Your phone number is only shared with matched donors or recipients after they accept a request — never publicly visible.
                </Text>
              </View>
            </View>
          )}

          {/* ── Step 3: Availability ─────────────────────────── */}
          {step === 3 && (
            <View style={styles.body}>
              <Text style={styles.emoji}>📍</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Set your availability</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Are you willing to donate blood when someone nearby needs it?
              </Text>

              {[
                {
                  val: true,
                  icon: '✅',
                  heading: "Yes, I'm available to donate",
                  sub:     'Receive notifications when someone nearby needs your blood group.',
                  accent:  theme.success,
                },
                {
                  val: false,
                  icon: '⏸️',
                  heading: 'Not available right now',
                  sub:     'You can change this anytime from your profile settings.',
                  accent:  theme.textMuted,
                },
              ].map(({ val, icon, heading, sub, accent }) => (
                <TouchableOpacity
                  key={String(val)}
                  onPress={() => setIsAvailable(val)}
                  style={[
                    styles.availCard,
                    {
                      backgroundColor: isAvailable === val ? `${accent}18` : theme.card,
                      borderColor:     isAvailable === val ? accent : theme.border,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 28 }}>{icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.availHeading, { color: theme.textPrimary }]}>{heading}</Text>
                    <Text style={[styles.availSub, { color: theme.textSecondary }]}>{sub}</Text>
                  </View>
                  {isAvailable === val && (
                    <Text style={[styles.check, { color: accent }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Navigation buttons */}
          <View style={styles.navRow}>
            {step > 0 && (
              <Button
                label="← Back"
                variant="ghost"
                onPress={() => setStep((s) => (s - 1) as Step)}
                style={{ flex: 1 }}
              />
            )}
            <Button
              label={step === 3 ? '🩸 Complete Setup' : 'Continue →'}
              variant="primary"
              size="lg"
              onPress={nextStep}
              loading={loading}
              style={{ flex: step === 0 ? 1 : 2 }}
            />
          </View>
        </View>
      </ScrollView>

      <SelectSheet
        visible={genderVisible}
        title="Select Gender"
        options={genderOptions}
        selected={gender}
        onSelect={setGender}
        onClose={() => setGenderVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  progressWrap: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: Spacing[3], paddingHorizontal: Spacing[5] },
  stepsRow:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[3] },
  stepItem:     { alignItems: 'center', gap: 3 },
  dot:          { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dotLabel:     { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  stepLabel:    { fontSize: 10 },
  track:        { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill:         { height: 3, borderRadius: 2 },
  scroll:       { flexGrow: 1, paddingHorizontal: Spacing[5], paddingTop: Spacing[5] },
  body:         { gap: Spacing[4] },
  emoji:        { fontSize: 44, textAlign: 'center' },
  title:        { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, textAlign: 'center' },
  subtitle:     { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  emailRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3], borderRadius: BorderRadius.base, borderWidth: 1,
  },
  emailLabel:   { fontSize: FontSize.xs },
  emailValue:   { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  label:        { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  hint:         { fontSize: FontSize.xs, marginTop: -Spacing[2] },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderRadius: BorderRadius.base, borderWidth: 1,
  },
  pickerLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  pickerValue:  { flex: 1, fontSize: FontSize.base, textAlign: 'right', marginRight: Spacing[2] },
  bloodGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], justifyContent: 'center' },
  bloodBtn:     { borderRadius: BorderRadius.base, borderWidth: 2, padding: Spacing[2] },
  condGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  condChip: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  condText:     { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  shareBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.md, borderWidth: 1,
  },
  shareTitle:   { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  shareHint:    { fontSize: FontSize.xs, marginTop: 2 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.md, borderWidth: 1,
  },
  infoText:     { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  availCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.lg, borderWidth: 2,
  },
  availHeading: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  availSub:     { fontSize: FontSize.xs, marginTop: 2, lineHeight: 18 },
  check:        { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  navRow:       { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[8] },
});
