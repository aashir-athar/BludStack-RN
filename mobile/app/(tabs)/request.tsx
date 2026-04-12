// app/(tabs)/request.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView,
  Platform, StyleSheet, TouchableOpacity, Alert, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useMyRequests } from '@/hooks/useRequests';
import Button from '@/components/Button';
import Input from '@/components/Input';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
import {
  BLOOD_GROUPS, URGENCY_CONFIG, URGENCY_LEVELS,
  BloodGroup, UrgencyLevel,
} from '@/constants/BloodData';

const URGENCY_COLORS = { critical: '#E8002D', urgent: '#F5A623', standard: '#00A651' };

export default function RequestScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();

  const { location, address, refreshLocation, loading: locLoading } = useLocation(true);
  const { createRequest } = useMyRequests();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(
    (profile?.blood_group as BloodGroup) ?? 'O+'
  );
  const [urgency, setUrgency]       = useState<UrgencyLevel>('urgent');
  const [units, setUnits]           = useState('1');
  const [hospital, setHospital]     = useState('');
  const [hospAddr, setHospAddr]     = useState('');
  const [notes, setNotes]           = useState('');
  const [loading, setLoading]       = useState(false);

  const submit = useCallback(async () => {
    if (!hospital.trim()) { Alert.alert('Required', 'Enter the hospital name'); return; }
    if (!hospAddr.trim()) { Alert.alert('Required', 'Enter the hospital address'); return; }
    if (!location) {
      Alert.alert('Location needed', 'Allow location access so donors can find you.');
      refreshLocation(); return;
    }
    setLoading(true);
    try {
      const req = await createRequest({
        blood_group: bloodGroup, urgency,
        units_needed: parseInt(units, 10) || 1,
        hospital_name: hospital.trim(),
        hospital_address: hospAddr.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        'Request Posted',
        'Notifying compatible donors in your area now.',
        [{ text: 'View Request', onPress: () => router.push(`/request/${req.id}`) }]
      );
      setHospital(''); setHospAddr(''); setNotes(''); setUnits('1');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to post. Try again.');
    } finally {
      setLoading(false);
    }
  }, [bloodGroup, urgency, units, hospital, hospAddr, notes, location, createRequest, refreshLocation, router]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing[4], borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>New Request</Text>
        <Text style={[styles.pageSubtitle, { color: theme.textMuted }]}>
          We'll find donors within 50 km
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Blood Group */}
        <Section label="Blood Group Needed" theme={theme}>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map(bg => (
              <TouchableOpacity
                key={bg}
                onPress={() => setBloodGroup(bg)}
                activeOpacity={0.7}
                style={[styles.bloodBtn, {
                  borderColor:     bloodGroup === bg ? theme.primary : theme.border,
                  backgroundColor: bloodGroup === bg ? theme.primaryMuted : theme.card,
                  borderWidth:     bloodGroup === bg ? 2 : StyleSheet.hairlineWidth,
                }]}
              >
                <BloodGroupBadge bloodGroup={bg} size="md" inverted={bloodGroup === bg} />
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Urgency */}
        <Section label="Urgency Level" theme={theme}>
          <View style={styles.urgencyRow}>
            {URGENCY_LEVELS.map(u => {
              const cfg   = URGENCY_CONFIG[u];
              const color = URGENCY_COLORS[u];
              const active = urgency === u;
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUrgency(u)}
                  activeOpacity={0.7}
                  style={[styles.urgencyBtn, {
                    borderColor:     active ? color : theme.border,
                    backgroundColor: active ? `${color}12` : theme.card,
                    borderWidth:     active ? 2 : StyleSheet.hairlineWidth,
                  }]}
                >
                  <Text style={styles.urgencyIcon}>{cfg.icon}</Text>
                  <Text style={[styles.urgencyLabel, { color: active ? color : theme.textSecondary }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* Units */}
        <Section label="Units Required" theme={theme}>
          <View style={styles.unitsRow}>
            {['1','2','3','4','5'].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => setUnits(n)}
                activeOpacity={0.7}
                style={[styles.unitBtn, {
                  borderColor:     units === n ? theme.textPrimary : theme.border,
                  backgroundColor: units === n ? theme.textPrimary : theme.card,
                  borderWidth:     units === n ? 2 : StyleSheet.hairlineWidth,
                }]}
              >
                <Text style={[styles.unitLabel, { color: units === n ? theme.textInverse : theme.textSecondary }]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Hospital */}
        <Section label="Hospital Details" theme={theme}>
          <Input
            placeholder="Hospital name"
            value={hospital}
            onChangeText={setHospital}
            returnKeyType="next"
            leftIcon={<Text>🏥</Text>}
            containerStyle={{ marginBottom: Spacing[3] }}
          />
          <Input
            placeholder="Hospital address"
            value={hospAddr}
            onChangeText={setHospAddr}
            leftIcon={<Text>📍</Text>}
            containerStyle={{ marginBottom: Spacing[3] }}
            multiline
            numberOfLines={2}
          />
          <Input
            placeholder="Additional notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </Section>

        {/* Location */}
        <TouchableOpacity
          onPress={refreshLocation}
          style={[styles.locRow, {
            backgroundColor: theme.card, borderColor: location ? theme.success : theme.border,
          }]}
          activeOpacity={0.7}
        >
          <View style={[styles.locIcon, { backgroundColor: location ? theme.successMuted : theme.cardElevated }]}>
            <Text style={{ fontSize: 18 }}>{location ? '📍' : '🔍'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.locTitle, { color: theme.textPrimary }]}>
              {location ? 'Location detected' : 'Detect location'}
            </Text>
            <Text style={[styles.locSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {address ?? (locLoading ? 'Finding your location…' : 'Tap to enable')}
            </Text>
          </View>
          {location && <Text style={{ color: theme.success, fontWeight: FontWeight.bold }}>✓</Text>}
        </TouchableOpacity>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Button
            label={`Post ${URGENCY_CONFIG[urgency].icon} ${URGENCY_CONFIG[urgency].label} Request`}
            variant="primary"
            size="lg"
            onPress={submit}
            loading={loading}
            fullWidth
          />
          <Text style={[styles.privacyNote, { color: theme.textMuted }]}>
            🔒  Only blood group and hospital location are shared until a donor accepts.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, children, theme }: { label: string; children: React.ReactNode; theme: any }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  topBar:        { paddingHorizontal: Spacing[5], paddingBottom: Spacing[4], borderBottomWidth: StyleSheet.hairlineWidth },
  pageTitle:     { fontSize: FontSize.xl, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.tight },
  pageSubtitle:  { fontSize: FontSize.sm, marginTop: 2 },
  scroll:        { padding: Spacing[5], gap: Spacing[6] },
  section:       { gap: Spacing[3] },
  sectionLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.black, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },
  bloodGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  bloodBtn:      { borderRadius: Radius.sm, padding: Spacing[2] },
  urgencyRow:    { flexDirection: 'row', gap: Spacing[2] },
  urgencyBtn:    { flex: 1, alignItems: 'center', padding: Spacing[3], borderRadius: Radius.sm, gap: Spacing[1] },
  urgencyIcon:   { fontSize: 20 },
  urgencyLabel:  { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },
  unitsRow:      { flexDirection: 'row', gap: Spacing[2] },
  unitBtn:       { width: 52, height: 52, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  unitLabel:     { fontSize: FontSize.base, fontWeight: FontWeight.black },
  locRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4], borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  locIcon:       { width: 44, height: 44, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  locTitle:      { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  locSub:        { fontSize: FontSize.xs, marginTop: 2 },
  ctaWrap:       { gap: Spacing[3] },
  privacyNote:   { fontSize: FontSize.xs, textAlign: 'center' },
});
