// app/(auth)/index.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, KeyboardAvoidingView, Platform,
  StyleSheet, TextInput, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/utils/supabase';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets    = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [step, setStep]       = useState<Step>('email');
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const otpRef = useRef<TextInput>(null);

  const isValid = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const sendOtp = useCallback(async () => {
    if (!isValid(email)) { setError('Enter a valid email address'); return; }
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 350);
    } catch (e: any) {
      setError(e.message ?? 'Failed to send code. Try again.');
    } finally { setLoading(false); }
  }, [email]);

  const verifyOtp = useCallback(async () => {
    if (otp.trim().length < 6) { setError('Enter the full 6-digit code'); return; }
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type:  'email',
      });
      if (err) throw err;
    } catch (e: any) {
      setError(e.message ?? 'Invalid or expired code. Try again.');
    } finally { setLoading(false); }
  }, [email, otp]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { minHeight: height }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Wordmark ── */}
        <View style={[styles.brandWrap, { paddingTop: insets.top + Spacing[12] }]}>
          <Text style={[styles.bloodDrop, { color: theme.primary }]}>🩸</Text>
          <Text style={[styles.wordmark, { color: theme.textPrimary }]}>BLUDSTACK</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            Community blood donation network
          </Text>
        </View>

        {/* ── Form ── */}
        <View style={[styles.formWrap, { paddingBottom: insets.bottom + Spacing[10] }]}>
          {step === 'email' ? (
            <>
              <Text style={[styles.formTitle, { color: theme.textPrimary }]}>
                Enter your email
              </Text>
              <Text style={[styles.formDesc, { color: theme.textMuted }]}>
                We'll send a 6-digit code. No password needed.
              </Text>
              <Input
                label="Email Address"
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                onSubmitEditing={sendOtp}
                error={error || undefined}
                autoFocus
              />
              <Button
                label="Continue →"
                onPress={sendOtp}
                loading={loading}
                fullWidth size="lg"
                variant="primary"
              />
            </>
          ) : (
            <>
              <Text style={[styles.formTitle, { color: theme.textPrimary }]}>
                Check your inbox
              </Text>
              <Text style={[styles.formDesc, { color: theme.textMuted }]}>
                6-digit code sent to{'\n'}
                <Text style={{ color: theme.textPrimary, fontWeight: FontWeight.bold }}>
                  {email}
                </Text>
              </Text>
              <Input
                ref={otpRef}
                label="Verification Code"
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="done"
                value={otp}
                onChangeText={t => { setOtp(t.replace(/\D/g, '')); setError(''); }}
                onSubmitEditing={verifyOtp}
                error={error || undefined}
              />
              <Button
                label="Verify →"
                onPress={verifyOtp}
                loading={loading}
                fullWidth size="lg"
                variant="primary"
              />
              <Button
                label="← Different email"
                onPress={() => { setStep('email'); setOtp(''); setError(''); }}
                fullWidth size="sm"
                variant="ghost"
              />
              <Text style={[styles.resend, { color: theme.textMuted }]}>
                Didn't receive it?{'  '}
                <Text onPress={loading ? undefined : sendOtp} style={{ color: theme.textPrimary, fontWeight: FontWeight.bold }}>
                  Resend
                </Text>
                {'  ·  '}Check spam folder.
              </Text>
            </>
          )}

          {/* Trust strip */}
          <View style={[styles.trustStrip, { borderTopColor: theme.border }]}>
            {['Free', 'No ads', 'Open source', 'Encrypted'].map((item, i) => (
              <React.Fragment key={item}>
                {i > 0 && <Text style={{ color: theme.border }}>·</Text>}
                <Text style={[styles.trustItem, { color: theme.textMuted }]}>{item}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: 'space-between' },
  brandWrap:  { alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[6] },
  bloodDrop:  { fontSize: 56 },
  wordmark:   { fontSize: FontSize.lg, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest },
  tagline:    { fontSize: FontSize.sm, textAlign: 'center' },
  formWrap:   { padding: Spacing[6], gap: Spacing[4] },
  formTitle:  { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  formDesc:   { fontSize: FontSize.sm, lineHeight: 22, marginBottom: Spacing[2] },
  resend:     { fontSize: FontSize.xs, textAlign: 'center' },
  trustStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[2], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[5] },
  trustItem:  { fontSize: FontSize.xs },
});
