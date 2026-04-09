// app/(auth)/index.tsx
import Button from '@/components/Button';
import Input from '@/components/Input';
import { APP_NAME, APP_TAGLINE } from '@/constants/BloodData';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/constants/Typography';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/utils/supabase';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const otpRef = useRef<TextInput>(null);

  const isValidEmail = useCallback((val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()), []);

  /* ── Send OTP to email ─────────────────────────────────── */
  const sendOtp = useCallback(async () => {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 400);
    } catch (e: any) {
      setError(e.message ?? 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }

  }, [email, isValidEmail]);

  /* ── Verify 6-digit OTP ────────────────────────────────── */
  const verifyOtp = useCallback(async () => {
    if (otp.trim().length < 6) {
      setError('Enter the full 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (err) throw err;
      // AuthContext onAuthStateChange picks up the session automatically
    } catch (e: any) {
      setError(e.message ?? 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, otp]);

  const maxW = Math.min(width, 480);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing[8], paddingBottom: insets.bottom + Spacing[8] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { width: maxW, backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.logo}>🩸</Text>
            <Text style={[styles.appName, { color: theme.primary }]}>{APP_NAME}</Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>{APP_TAGLINE}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          {/* ── Email step ─────────────────────────────────── */}
          {step === 'email' && (
            <View style={styles.form}>
              <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                Sign in with your email
              </Text>
              <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                We'll send a 6-digit code to your inbox. No password needed — ever.
              </Text>

              <Input
                label="Email Address"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                onSubmitEditing={sendOtp}
                error={error || undefined}
                leftIcon={<Text style={{ fontSize: 16 }}>✉️</Text>}
                autoFocus
              />

              <Button
                label="Send Code →"
                onPress={sendOtp}
                loading={loading}
                fullWidth
                size="lg"
                variant="primary"
              />

              <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
                By continuing you agree to our Terms of Service and Privacy Policy.
                Your data is encrypted and never sold.
              </Text>
            </View>
          )}

          {/* ── OTP step ───────────────────────────────────── */}
          {step === 'otp' && (
            <View style={styles.form}>
              <Text style={[styles.stepTitle, { color: theme.textPrimary }]}>
                Check your inbox
              </Text>
              <Text style={[styles.stepDesc, { color: theme.textSecondary }]}>
                We sent a 6-digit code to{'\n'}
                <Text style={{ color: theme.accent, fontWeight: FontWeight.semibold }}>
                  {email}
                </Text>
              </Text>

              <Input
                ref={otpRef}
                label="6-Digit Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                value={otp}
                onChangeText={(t) => { setOtp(t); setError(''); }}
                onSubmitEditing={verifyOtp}
                error={error || undefined}
                leftIcon={<Text style={{ fontSize: 16 }}>🔐</Text>}
              />

              <Button
                label="Verify & Enter →"
                onPress={verifyOtp}
                loading={loading}
                fullWidth
                size="lg"
                variant="primary"
              />

              <Button
                label="← Use a different email"
                onPress={() => { setStep('email'); setOtp(''); setError(''); }}
                fullWidth
                size="sm"
                variant="ghost"
              />

              <View style={styles.resendRow}>
                <Text style={[styles.resendLabel, { color: theme.textMuted }]}>
                  Didn't receive it?{'  '}
                </Text>
                <Text
                  onPress={loading ? undefined : sendOtp}
                  style={[styles.resendLink, { color: theme.accent }]}
                >
                  Resend code
                </Text>
              </View>

              <Text style={[styles.spamNote, { color: theme.textMuted }]}>
                💡 Check your spam / junk folder if you don't see it within 1 minute.
              </Text>
            </View>
          )}

          {/* Trust footer */}
          <View style={[styles.trustRow, { backgroundColor: theme.muted, borderColor: theme.border }]}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={[styles.trustText, { color: theme.textMuted }]}>
              Free · No ads · Open source · Supabase encrypted
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
  },
  card: {
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    padding: Spacing[6],
    gap: Spacing[5],
    alignSelf: 'center',
    width: '100%',
  },
  hero: { alignItems: 'center', gap: Spacing[2] },
  logo: { fontSize: 64 },
  appName: { fontSize: FontSize['3xl'], fontWeight: FontWeight.black, letterSpacing: -1 },
  tagline: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth },
  form: { gap: Spacing[4] },
  stepTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  stepDesc: { fontSize: FontSize.sm, lineHeight: 22 },
  disclaimer: { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  resendLabel: { fontSize: FontSize.sm },
  resendLink: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  spamNote: { fontSize: FontSize.xs, textAlign: 'center' },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: BorderRadius.base,
    borderWidth: 1,
  },
  lockIcon: { fontSize: 13 },
  trustText: { fontSize: FontSize.xs, flex: 1 },
});