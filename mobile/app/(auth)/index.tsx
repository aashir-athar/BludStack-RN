// app/(auth)/index.tsx
// ──────────────────────────────────────────────────────────────────────────────
// Request-screen design language: hero zone (top ~45%) + sheet ascending over
// it with brand accent strip, handle, spring entrance, section label, inline
// CTA (summary row + button + footer note). One input on screen at a time
// reduces cognitive load; the lifted sheet plus the inline CTA stack mirrors
// the post-request flow so the visual language stays coherent edge-to-edge.
//
// Copy lens — Schwartz awareness:
//   Step 1: most-aware ("What's your email?") — they came to sign in,
//           no convincing needed, just a clean prompt.
//   Step 2: problem-aware ("Check your inbox") — they know they sent it,
//           we cue the action and reduce anxiety ("No password to remember").
// ──────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/utils/supabase';
import BrandMark from '@/components/BrandMark';
import Button from '@/components/Button';
import Input from '@/components/Input';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Motion, Elevation,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';

type Step = 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ──────────────────────────────────────────────────────────────────────────────
// Sheet entrance — spring from translateY 60 → 0 on mount. Same physics as
// the Request screen's sheet so first-frame parity is exact.
// ──────────────────────────────────────────────────────────────────────────────
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

// Subtle breathing on the BrandMark — mirrors the Request screen's critical
// CTA breathing pattern but very gentle (1.00 ↔ 1.03, 2.4s) so it reads as
// "alive" rather than "alarm".
function useBrandBreath() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(
      withTiming(1.03, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
  }, [s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

export default function LoginScreen() {
  const { theme } = useTheme();
  const toast    = useToast();
  const insets   = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [step, setStep]       = useState<Step>('email');
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [otpError, setOtpError]     = useState<string | undefined>();
  const otpRef = useRef<TextInput>(null);

  const validateEmail = useCallback((value: string) => {
    const v = value.trim().toLowerCase();
    if (!v) return 'Enter the email you want to use';
    if (!EMAIL_RE.test(v)) return "That doesn't look like a valid email";
    return undefined;
  }, []);

  const sendOtp = useCallback(async () => {
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError(undefined);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep('otp');
      setOtp('');
      setTimeout(() => otpRef.current?.focus(), Motion.duration.base);
      toast.info('Code sent', { description: `Check ${email.trim().toLowerCase()}` });
    } catch (e: any) {
      errorReporter.error(e, { screen: 'auth/email' });
      toast.error("Couldn't send the code", { description: e?.message ?? 'Try again in a moment' });
    } finally { setLoading(false); }
  }, [email, toast, validateEmail]);

  const verifyOtp = useCallback(async () => {
    const clean = otp.trim();
    if (clean.length !== 6) { setOtpError('Enter all 6 digits'); return; }
    setOtpError(undefined);
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: clean,
        type:  'email',
      });
      if (error) throw error;
      // Successful auth — _layout cascade handles the navigation.
    } catch (e: any) {
      errorReporter.error(e, { screen: 'auth/otp' });
      setOtpError('Code is invalid or expired');
      toast.error("That code didn't match", { description: 'Double-check or send a new one' });
    } finally { setLoading(false); }
  }, [email, otp, toast]);

  const goBack = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setStep('email');
    setOtp('');
    setOtpError(undefined);
  }, []);

  const resend = useCallback(() => {
    if (loading) return;
    Haptics.selectionAsync().catch(() => {});
    sendOtp();
  }, [loading, sendOtp]);

  const heroHeight   = Math.max(240, Math.round(height * 0.42));
  const sheetEntrance = useSheetEntrance();
  const brandBreath  = useBrandBreath();

  const stepIndex = step === 'email' ? 1 : 2;
  const stepLabel = useMemo(() => (
    step === 'email' ? 'Step 1 of 2 · Sign in' : 'Step 2 of 2 · Verify'
  ), [step]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ─────────────────────── HERO (DECIDE) ───────────────────────────── */}
      <View style={[styles.hero, { height: heroHeight, backgroundColor: theme.background, paddingTop: insets.top + Spacing[6] }]}>
        <View style={styles.heroInner}>
          <Animated.View style={brandBreath}>
            <BrandMark size={64} />
          </Animated.View>
          <Text style={[styles.wordmark, { color: theme.textPrimary }]}>BLUDSTACK</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            The fastest way to find a donor
          </Text>
        </View>

        {/* Small status pill — sits just above the sheet handle area, matches
            the Request screen's overlay pills above the sheet. */}
        <View style={[styles.heroPill, { backgroundColor: theme.surface, borderColor: theme.border, bottom: Spacing[10] }, Elevation.sm]}>
          <View style={[styles.heroPillDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.heroPillText, { color: theme.textMuted }]}>
            No password · One tap sign-in
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
        {/* Brand accent strip + handle */}
        <View style={styles.sheetTop}>
          <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing[5],
            paddingBottom: insets.bottom + Spacing[8],
            gap: Spacing[4],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Progress bar — route-style: filled segment + remaining */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, { backgroundColor: theme.primary }]} />
            <View style={[styles.stepDot, { backgroundColor: stepIndex === 2 ? theme.primary : theme.border }]} />
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{stepLabel}</Text>

          {step === 'email' ? (
            <>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                What's your email?
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                We'll send you a 6-digit code. No password to remember.
              </Text>
              <Input
                label="Email"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                value={email}
                onChangeText={t => { setEmail(t); if (emailError) setEmailError(undefined); }}
                onSubmitEditing={sendOtp}
                error={emailError}
                leftIcon={<Ionicons name="mail-outline" size={18} color={theme.textMuted} />}
                autoFocus
              />
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Check your inbox
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                We sent a 6-digit code to{'\n'}
                <Text style={{ color: theme.textPrimary, fontWeight: FontWeight.bold }}>
                  {email.trim().toLowerCase()}
                </Text>
              </Text>
              <Input
                ref={otpRef}
                label="6-digit code"
                placeholder="123456"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                returnKeyType="done"
                value={otp}
                onChangeText={t => {
                  const next = t.replace(/\D/g, '');
                  setOtp(next);
                  if (otpError) setOtpError(undefined);
                }}
                onSubmitEditing={verifyOtp}
                error={otpError}
                leftIcon={<Ionicons name="keypad-outline" size={18} color={theme.textMuted} />}
              />

              <View style={styles.aux}>
                <Pressable onPress={goBack} hitSlop={8}>
                  <Text style={[styles.auxLink, { color: theme.textSecondary }]}>
                    Different email
                  </Text>
                </Pressable>
                <Pressable onPress={resend} hitSlop={8} disabled={loading}>
                  <Text style={[styles.auxLink, { color: loading ? theme.textTertiary : theme.textPrimary, fontWeight: FontWeight.bold }]}>
                    Resend code
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {/* ── Inline CTA (ACT) — matches Request screen footer block ───── */}
          <View style={styles.ctaInline}>
            <View style={styles.ctaSummary}>
              <View style={[styles.ctaSummaryDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.ctaSummaryText, { color: theme.textPrimary }]} numberOfLines={1}>
                <Text style={{ fontWeight: FontWeight.black, color: theme.primary }}>
                  {step === 'email' ? 'Email' : 'Verify'}
                </Text>
                <Text style={{ color: theme.textMuted }}>{'  ·  '}</Text>
                <Text>{step === 'email' ? '6-digit code by email' : 'Enter all 6 digits'}</Text>
              </Text>
            </View>

            <Button
              label={step === 'email' ? 'Send 6-digit code' : 'Verify and continue'}
              onPress={step === 'email' ? sendOtp : verifyOtp}
              loading={loading}
              fullWidth size="xl"
              variant="primary"
              haptic={false}
              icon={
                <Ionicons
                  name={step === 'email' ? 'send' : 'shield-checkmark'}
                  size={18}
                  color={theme.textOnPrimary}
                />
              }
              iconPosition="left"
            />

            <Text style={[styles.ctaFooterNote, { color: theme.textTertiary }]}>
              By continuing you agree to our Terms and acknowledge our Privacy Policy.
              We never share medical info without your consent.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero ───────────────────────────────────────────────────────────────
  hero: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInner: { alignItems: 'center', gap: Spacing[3] },
  wordmark: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
  },
  tagline: {
    fontSize: FontSize.sm,
    marginTop: Spacing[1],
    letterSpacing: LetterSpacing.snug,
  },
  heroPill: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
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

  // ── Sheet content ──────────────────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginBottom: Spacing[1],
  },
  stepDot: {
    flex: 1,
    height: 3,
    borderRadius: Radius.pill,
  },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest,
    textTransform: 'uppercase',
    marginLeft: Spacing[2],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.tighter,
  },
  subtitle: {
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.5,
  },

  aux: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[2],
    marginTop: Spacing[1],
  },
  auxLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
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
