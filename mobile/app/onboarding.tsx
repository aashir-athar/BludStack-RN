// app/onboarding.tsx
import BloodGroupBadge from '@/components/BloodGroupBadge';
import Button from '@/components/Button';
import Input from '@/components/Input';
import SelectSheet from '@/components/SelectSheet';
import { BLOOD_GROUPS, BloodGroup, GENDER_OPTIONS, MEDICAL_CONDITIONS } from '@/constants/BloodData';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/Typography';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/utils/supabase';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 0 | 1 | 2;

const STEPS = ['Basic Info', 'Blood & Health', 'Availability'];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const { user, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [step, setStep]       = useState<Step>(0);
  const [loading, setLoading] = useState(false);

  // Step 0
  const [fullName, setFullName]                   = useState('');
  const [gender, setGender]                       = useState('');
  const [genderSheetVisible, setGenderSheetVisible] = useState(false);

  // Step 1
  const [bloodGroup, setBloodGroup]             = useState<BloodGroup | ''>('');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [shareMedical, setShareMedical]         = useState(false);

  // Step 2
  const [isAvailable, setIsAvailable] = useState(true);

  const genderOptions = GENDER_OPTIONS.map((g) => ({ label: g, value: g }));

  const toggleCondition = useCallback((cond: string) => {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  }, []);

  const submit = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id:                    user.id,
        email:                 user.email ?? '',     // ← store email from auth user
        full_name:             fullName.trim(),
        gender,
        blood_group:           bloodGroup,
        medical_conditions:    selectedConditions,
        share_medical_history: shareMedical,
        is_available_to_donate: isAvailable,
        total_donations:       0,
        is_verified:           false,
        created_at:            new Date().toISOString(),
      });
      if (error) throw error;
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not save profile. Try again.');
    } finally {
      setLoading(false);
    }
  }, [user, fullName, gender, bloodGroup, selectedConditions, shareMedical, isAvailable, refreshProfile]);

  const nextStep = useCallback(() => {
    if (step === 0) {
      if (!fullName.trim()) { Alert.alert('Required', 'Please enter your full name'); return; }
      if (!gender)          { Alert.alert('Required', 'Please select your gender');   return; }
    }
    if (step === 1) {
      if (!bloodGroup) { Alert.alert('Required', 'Please select your blood group'); return; }
    }
    if (step < 2) setStep((s) => (s + 1) as Step);
    else          submit();
  }, [step, fullName, gender, bloodGroup, submit]);

  const maxW = Math.min(width, 520);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Progress bar */}
      <View style={[styles.progressBar, { paddingTop: insets.top + Spacing[4], backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.steps}>
          {STEPS.map((label, i) => (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, { backgroundColor: i <= step ? theme.primary : theme.border }]}>
                <Text style={[styles.stepNum, { color: i <= step ? '#fff' : theme.textMuted }]}>
                  {i < step ? '✓' : String(i + 1)}
                </Text>
              </View>
              <Text style={[styles.stepLabel, { color: i === step ? theme.textPrimary : theme.textMuted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${((step + 1) / 3) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[8] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: maxW, alignSelf: 'center' }}>

          {/* ── Step 0: Basic Info ──────────────────────────── */}
          {step === 0 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>👤</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Tell us about yourself</Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]}>
                Your profile helps donors and recipients find and trust each other.
              </Text>

              {/* Email display (read-only from auth) */}
              {user?.email && (
                <View style={[styles.emailDisplay, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                  <Text style={styles.emailIcon}>✉️</Text>
                  <View>
                    <Text style={[styles.emailLabel, { color: theme.textMuted }]}>Signed in as</Text>
                    <Text style={[styles.emailValue, { color: theme.textPrimary }]}>{user.email}</Text>
                  </View>
                </View>
              )}

              <Input
                label="Full Name"
                placeholder="Muhammad Ali"
                value={fullName}
                onChangeText={setFullName}
                leftIcon={<Text>✏️</Text>}
                autoFocus
              />

              <TouchableOpacity
                onPress={() => setGenderSheetVisible(true)}
                style={[styles.selectRow, {
                  backgroundColor: theme.inputBg,
                  borderColor: gender ? theme.inputFocus : theme.inputBorder,
                }]}
              >
                <Text style={[styles.selectLabel, { color: theme.textSecondary }]}>Gender</Text>
                <Text style={[styles.selectValue, { color: gender ? theme.textPrimary : theme.textMuted }]}>
                  {gender || 'Select gender…'}
                </Text>
                <Text style={{ color: theme.textMuted }}>›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 1: Blood & Medical ─────────────────────── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>🩸</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Your blood profile</Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]}>
                Used to match you with compatible donors or recipients instantly.
              </Text>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Blood Group</Text>
              <View style={styles.bloodGrid}>
                {BLOOD_GROUPS.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    onPress={() => setBloodGroup(bg)}
                    style={[
                      styles.bloodOption,
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

              <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing[4] }]}>
                Medical History <Text style={{ fontWeight: FontWeight.regular }}>(optional)</Text>
              </Text>
              <Text style={[styles.subDesc, { color: theme.textMuted }]}>
                Disclose conditions to help ensure safe donations for both parties.
              </Text>

              <View style={styles.condGrid}>
                {MEDICAL_CONDITIONS.map((cond) => {
                  const selected = selectedConditions.includes(cond);
                  return (
                    <TouchableOpacity
                      key={cond}
                      onPress={() => toggleCondition(cond)}
                      style={[
                        styles.condTag,
                        {
                          backgroundColor: selected ? `${theme.warning}22` : theme.muted,
                          borderColor:     selected ? theme.warning : theme.border,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.condText, { color: selected ? theme.warning : theme.textSecondary }]}>
                        {selected ? '✓ ' : ''}{cond}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedConditions.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShareMedical(!shareMedical)}
                  style={[
                    styles.shareToggle,
                    {
                      backgroundColor: shareMedical ? `${theme.accent}18` : theme.muted,
                      borderColor: theme.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.shareIcon}>{shareMedical ? '👁' : '🔒'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shareLabel, { color: theme.textPrimary }]}>
                      {shareMedical
                        ? 'Sharing medical history with matched donors/recipients'
                        : 'Keeping medical history private'}
                    </Text>
                    <Text style={[styles.shareDesc, { color: theme.textMuted }]}>
                      Tap to {shareMedical ? 'hide' : 'share'} — transparency builds trust and safety.
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Step 2: Availability ────────────────────────── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.emoji}>📍</Text>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Set your availability</Text>
              <Text style={[styles.desc, { color: theme.textSecondary }]}>
                Are you willing to donate blood when someone nearby needs it?
              </Text>

              <TouchableOpacity
                onPress={() => setIsAvailable(true)}
                style={[
                  styles.availCard,
                  {
                    backgroundColor: isAvailable ? `${theme.success}18` : theme.card,
                    borderColor:     isAvailable ? theme.success : theme.border,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.availIcon}>✅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availTitle, { color: theme.textPrimary }]}>Yes, I'm available to donate</Text>
                  <Text style={[styles.availDesc,  { color: theme.textSecondary }]}>
                    You'll receive notifications when someone nearby needs your blood group.
                  </Text>
                </View>
                {isAvailable && <Text style={[styles.checkMark, { color: theme.success }]}>✓</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsAvailable(false)}
                style={[
                  styles.availCard,
                  {
                    backgroundColor: !isAvailable ? `${theme.textMuted}18` : theme.card,
                    borderColor:     !isAvailable ? theme.textMuted : theme.border,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.availIcon}>⏸️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.availTitle, { color: theme.textPrimary }]}>Not available right now</Text>
                  <Text style={[styles.availDesc,  { color: theme.textSecondary }]}>
                    You can change this anytime from your profile settings.
                  </Text>
                </View>
                {!isAvailable && <Text style={[styles.checkMark, { color: theme.textMuted }]}>✓</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Navigation */}
          <View style={styles.navRow}>
            {step > 0 && (
              <Button
                label="Back"
                variant="ghost"
                onPress={() => setStep((s) => (s - 1) as Step)}
                style={{ flex: 1 }}
              />
            )}
            <Button
              label={step === 2 ? 'Complete Setup 🩸' : 'Continue →'}
              variant="primary"
              size="lg"
              onPress={nextStep}
              loading={loading}
              style={{ flex: 2 }}
            />
          </View>

        </View>
      </ScrollView>

      <SelectSheet
        visible={genderSheetVisible}
        title="Select Gender"
        options={genderOptions}
        selected={gender}
        onSelect={setGender}
        onClose={() => setGenderSheetVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[6],
  },
  steps:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing[3] },
  stepItem:     { alignItems: 'center', gap: Spacing[1] },
  stepDot:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  stepLabel:    { fontSize: FontSize.xs },
  progressTrack:{ height: 3, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  scroll:       { flexGrow: 1, paddingHorizontal: Spacing[6], paddingTop: Spacing[6] },
  stepContent:  { gap: Spacing[4] },
  emoji:        { fontSize: 48, textAlign: 'center' },
  title:        { fontSize: FontSize['2xl'], fontWeight: FontWeight.bold, textAlign: 'center' },
  desc:         { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22 },
  subDesc:      { fontSize: FontSize.xs, lineHeight: 18, marginTop: -Spacing[2] },
  emailDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[3], borderRadius: BorderRadius.base, borderWidth: 1,
  },
  emailIcon:    { fontSize: 18 },
  emailLabel:   { fontSize: FontSize.xs },
  emailValue:   { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: -Spacing[2] },
  bloodGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], justifyContent: 'center' },
  bloodOption:  { borderRadius: BorderRadius.base, borderWidth: 2, padding: Spacing[2] },
  condGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  condTag: {
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  condText:     { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  shareToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.md, borderWidth: 1,
  },
  shareIcon:    { fontSize: 20 },
  shareLabel:   { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  shareDesc:    { fontSize: FontSize.xs, marginTop: 2 },
  availCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4], borderRadius: BorderRadius.lg, borderWidth: 2,
  },
  availIcon:    { fontSize: 28 },
  availTitle:   { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  availDesc:    { fontSize: FontSize.xs, marginTop: 2, lineHeight: 18 },
  checkMark:    { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  navRow:       { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[8] },
  selectRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing[4], borderRadius: BorderRadius.base, borderWidth: 1,
  },
  selectLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  selectValue:  { flex: 1, fontSize: FontSize.base, textAlign: 'right', marginRight: Spacing[2] },
});