// Lever: cognitive-load reduction (one input per step). Hero + ascending sheet
// mirror the request-screen language so the visual stays coherent edge to edge.
// Copy (Schwartz): step 1 most-aware ("What's your email?"); step 2 problem-
// aware ("Check your inbox") with anxiety-reducing reassurance.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View,
  type TextInput, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/utils/supabase';
import { emailSchema, otpSchema } from '@/schemas';
import { useToast } from '@/stores/toastStore';
import { useAppTheme } from '@/stores/themeStore';
import { errorReporter } from '@/lib/errorReporter';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Elevation,
} from '@/constants/Typography';
import { BrandMark, Button, Input, Text } from '@/ui';

type Step = 'email' | 'otp';

function firstIssue(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

export default function LoginScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [otpError, setOtpError] = useState<string | undefined>();
  const otpRef = useRef<TextInput>(null);

  // Sheet entrance + gentle brand breath (skipped under reduced motion).
  const ty = useSharedValue(reduceMotion ? 0 : 60);
  const op = useSharedValue(reduceMotion ? 1 : 0);
  const breath = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    ty.value = withSpring(0, { damping: 16, stiffness: 180, mass: 0.6 });
    op.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });
    breath.value = withRepeat(withTiming(1.03, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduceMotion, ty, op, breath]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }], opacity: op.value }));
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const sendOtp = useCallback(async () => {
    const clean = email.trim().toLowerCase();
    const err = firstIssue(emailSchema.safeParse({ email: clean }));
    if (err) { setEmailError(err); return; }
    setEmailError(undefined);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: clean, options: { shouldCreateUser: true } });
      if (error) throw error;
      setStep('otp');
      setOtp('');
      setTimeout(() => otpRef.current?.focus(), 240);
      toast.info('Code sent', { description: `Check ${clean}` });
    } catch (e) {
      errorReporter.error(e, { screen: 'auth/email' });
      toast.error("Couldn't send the code", { description: e instanceof Error ? e.message : 'Try again in a moment' });
    } finally {
      setLoading(false);
    }
  }, [email, toast]);

  const verifyOtp = useCallback(async () => {
    const code = otp.trim();
    const err = firstIssue(otpSchema.safeParse({ code }));
    if (err) { setOtpError(err); return; }
    setOtpError(undefined);
    setLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
      if (error) throw error;
      // Auth state change cascades the navigation via the root layout.
    } catch (e) {
      errorReporter.error(e, { screen: 'auth/otp' });
      setOtpError('That code is invalid or expired');
      toast.error("That code didn't match", { description: 'Double-check it or send a new one' });
    } finally {
      setLoading(false);
    }
  }, [email, otp, toast]);

  const heroHeight = Math.max(240, Math.round(height * 0.42));
  const stepIndex = step === 'email' ? 1 : 2;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.hero, { height: heroHeight, paddingTop: insets.top + Spacing[6] }]}>
        <View style={{ alignItems: 'center', gap: Spacing[3] }}>
          <Animated.View style={breathStyle}>
            <BrandMark size={64} />
          </Animated.View>
          <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest }}>
            BLUDSTACK
          </Text>
          <Text variant="bodySm" tone="muted">The fastest way to find a donor</Text>
        </View>

        <View style={[styles.heroPill, { backgroundColor: theme.surface, borderColor: theme.border }, Elevation.sm]}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.success }} />
          <Text variant="overline" tone="muted">No password. One tap sign-in.</Text>
        </View>
      </View>

      <Animated.View
        style={[styles.sheet, { backgroundColor: theme.surface, borderTopColor: theme.border }, Elevation.lg, sheetStyle]}
      >
        <View style={styles.sheetTop}>
          <View style={[styles.accentStrip, { backgroundColor: theme.primary }]} />
          <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: Spacing[5], paddingBottom: insets.bottom + Spacing[8], gap: Spacing[4] }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', gap: Spacing[2], marginBottom: Spacing[1] }}>
            <View style={{ flex: 1, height: 3, borderRadius: Radius.pill, backgroundColor: theme.primary }} />
            <View style={{ flex: 1, height: 3, borderRadius: Radius.pill, backgroundColor: stepIndex === 2 ? theme.primary : theme.border }} />
          </View>

          <Text variant="overline" tone="muted" style={{ marginLeft: Spacing[2] }}>
            {step === 'email' ? 'Step 1 of 2 . Sign in' : 'Step 2 of 2 . Verify'}
          </Text>

          {step === 'email' ? (
            <>
              <Text variant="headline">What's your email?</Text>
              <Text variant="body" tone="muted">We will send a 6-digit code. No password to remember.</Text>
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
                onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(undefined); }}
                onSubmitEditing={sendOtp}
                error={emailError}
                leftIcon="mail-outline"
                autoFocus
              />
            </>
          ) : (
            <>
              <Text variant="headline">Check your inbox</Text>
              <Text variant="body" tone="muted">
                We sent a 6-digit code to{' '}
                <Text variant="body" style={{ fontWeight: FontWeight.bold }}>{email.trim().toLowerCase()}</Text>
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
                onChangeText={(t) => { setOtp(t.replace(/\D/g, '')); if (otpError) setOtpError(undefined); }}
                onSubmitEditing={verifyOtp}
                error={otpError}
                leftIcon="keypad-outline"
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing[2], marginTop: Spacing[1] }}>
                <Pressable onPress={() => { void Haptics.selectionAsync(); setStep('email'); setOtp(''); setOtpError(undefined); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Use a different email">
                  <Text variant="label" tone="secondary">Different email</Text>
                </Pressable>
                <Pressable onPress={() => { if (!loading) { void Haptics.selectionAsync(); void sendOtp(); } }} hitSlop={8} disabled={loading} accessibilityRole="button" accessibilityLabel="Resend code">
                  <Text variant="label" tone={loading ? 'tertiary' : 'primary'}>Resend code</Text>
                </Pressable>
              </View>
            </>
          )}

          <View style={{ marginTop: Spacing[2], gap: Spacing[3] }}>
            <Button
              label={step === 'email' ? 'Send 6-digit code' : 'Verify and continue'}
              onPress={step === 'email' ? sendOtp : verifyOtp}
              loading={loading}
              loadingLabel={step === 'email' ? 'Sending' : 'Verifying'}
              fullWidth
              size="xl"
              haptic={false}
              icon={step === 'email' ? 'send' : 'shield-checkmark'}
            />
            <Text variant="caption" tone="tertiary" style={{ textAlign: 'center', paddingHorizontal: Spacing[4], lineHeight: FontSize.xs * 1.5 }}>
              By continuing you agree to our Terms and acknowledge our Privacy Policy. We never share medical info without your consent.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroPill: {
    position: 'absolute', alignSelf: 'center', bottom: Spacing[10],
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[2],
    borderRadius: Radius.pill, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth,
  },
  sheet: {
    flex: 1, marginTop: -Spacing[5],
    borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    borderCurve: 'continuous', borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTop: { alignItems: 'center', paddingTop: Spacing[2], paddingBottom: Spacing[3] },
  accentStrip: { width: 36, height: 3, borderRadius: 2, marginBottom: Spacing[1], opacity: 0.9 },
  handle: { width: 44, height: 4, borderRadius: 2 },
});
