// app/(auth)/index.tsx
// Lever: cognitive-load reduction — one input on screen at a time, single
// primary CTA, no decoration that distracts from the verb. Step indicator is
// minimal (two dashes) — keeps the user oriented without selling progress.
//
// Copy lens — Schwartz awareness:
//   Step 1: most-aware ("What's your email?") — they came here to sign in;
//           no convincing needed, just a clean prompt.
//   Step 2: problem-aware ("Check your inbox") — they know they sent it,
//           we cue the action and reduce anxiety ("No password to remember").

import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/utils/supabase';
import BrandMark from '@/components/BrandMark';
import Button from '@/components/Button';
import Input from '@/components/Input';
import {
  FontSize, FontWeight, LetterSpacing, Spacing, Radius, Motion,
} from '@/constants/Typography';
import { errorReporter } from '@/lib/errorReporter';

type Step = 'email' | 'otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [step, setStep]       = useState<Step>('email');
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [otpError, setOtpError]     = useState<string | undefined>();
  const otpRef = useRef<TextInput>(null);

  const validateEmail = (value: string) => {
    const v = value.trim().toLowerCase();
    if (!v) return 'Enter the email you want to use';
    if (!EMAIL_RE.test(v)) return "That doesn't look like a valid email";
    return undefined;
  };

  const sendOtp = useCallback(async () => {
    const err = validateEmail(email);
    if (err) { setEmailError(err); return; }
    setEmailError(undefined);
    setLoading(true);
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
  }, [email, toast]);

  const verifyOtp = useCallback(async () => {
    const clean = otp.trim();
    if (clean.length !== 6) { setOtpError('Enter all 6 digits'); return; }
    setOtpError(undefined);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: clean,
        type:  'email',
      });
      if (error) throw error;
    } catch (e: any) {
      errorReporter.error(e, { screen: 'auth/otp' });
      setOtpError('Code is invalid or expired');
      toast.error("That code didn't match", { description: 'Double-check or send a new one' });
    } finally { setLoading(false); }
  }, [email, otp, toast]);

  const goBack = useCallback(() => {
    setStep('email');
    setOtp('');
    setOtpError(undefined);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { minHeight: height }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.brandWrap, { paddingTop: insets.top + Spacing[12] }]}>
          <BrandMark size={56} />
          <Text style={[styles.wordmark, { color: theme.textPrimary }]}>BLUDSTACK</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            The fastest way to find a donor
          </Text>
        </View>

        <View style={[styles.formWrap, { paddingBottom: insets.bottom + Spacing[10] }]}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, { backgroundColor: theme.primary }]} />
            <View style={[styles.stepDot, { backgroundColor: step === 'otp' ? theme.primary : theme.border }]} />
          </View>

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
                autoFocus
              />
              <Button
                label="Continue"
                onPress={sendOtp}
                loading={loading}
                fullWidth size="xl"
                variant="primary"
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
                label="Code"
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
              />
              <Button
                label="Verify and continue"
                onPress={verifyOtp}
                loading={loading}
                fullWidth size="xl"
                variant="primary"
              />

              <View style={styles.aux}>
                <Pressable onPress={goBack} hitSlop={8}>
                  <Text style={[styles.auxLink, { color: theme.textSecondary }]}>
                    Different email
                  </Text>
                </Pressable>
                <Pressable onPress={loading ? undefined : sendOtp} hitSlop={8} disabled={loading}>
                  <Text style={[styles.auxLink, { color: theme.textPrimary, fontWeight: FontWeight.bold }]}>
                    Resend code
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          <Text style={[styles.legal, { color: theme.textTertiary }]}>
            By continuing you agree to our Terms and acknowledge our Privacy Policy.{'\n'}
            We never share medical info without your consent.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'space-between' },

  brandWrap: { alignItems: 'center', gap: Spacing[3], paddingBottom: Spacing[12] },
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

  formWrap: {
    paddingHorizontal: Spacing[6],
    gap: Spacing[5],
  },
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
    marginTop: Spacing[2],
  },
  auxLink: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    letterSpacing: LetterSpacing.snug,
  },

  legal: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.6,
    marginTop: Spacing[4],
  },
});
