// app/(tabs)/request.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useMyRequests } from '@/hooks/useRequests';
import Button from '@/components/Button';
import Input from '@/components/Input';
import SelectSheet from '@/components/SelectSheet';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import Card from '@/components/Card';
import ScreenHeader from '@/components/ScreenHeader';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { BLOOD_GROUPS, URGENCY_CONFIG, URGENCY_LEVELS, BloodGroup, UrgencyLevel } from '@/constants/BloodData';

export default function RequestScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const { location, address, refreshLocation, loading: locLoading } = useLocation(true);
  const { createRequest } = useMyRequests();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup>(profile?.blood_group as BloodGroup ?? 'O+');
  const [urgency, setUrgency] = useState<UrgencyLevel>('urgent');
  const [units, setUnits] = useState('1');
  const [hospital, setHospital] = useState('');
  const [hospitalAddress, setHospitalAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [bloodSheetVisible, setBloodSheetVisible] = useState(false);
  const [urgencySheetVisible, setUrgencySheetVisible] = useState(false);

  const urgencyOptions = URGENCY_LEVELS.map((u) => ({
    label: URGENCY_CONFIG[u].label,
    value: u,
    icon: URGENCY_CONFIG[u].icon,
    description: `Required within ${URGENCY_CONFIG[u].minutes < 60
      ? URGENCY_CONFIG[u].minutes + ' minutes'
      : URGENCY_CONFIG[u].minutes / 60 + ' hours'}`,
  }));

  const bloodOptions = BLOOD_GROUPS.map((bg) => ({ label: bg, value: bg }));

  const submit = useCallback(async () => {
    if (!hospital.trim()) { Alert.alert('Required', 'Please enter the hospital name'); return; }
    if (!hospitalAddress.trim()) { Alert.alert('Required', 'Please enter the hospital address'); return; }
    if (!location) {
      Alert.alert('Location required', 'We need your location to find nearby donors. Please allow location access.');
      await refreshLocation();
      return;
    }

    setLoading(true);
    try {
      const req = await createRequest({
        blood_group: bloodGroup,
        urgency,
        units_needed: parseInt(units, 10) || 1,
        hospital_name: hospital.trim(),
        hospital_address: hospitalAddress.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        notes: notes.trim() || undefined,
      });
      Alert.alert(
        '🩸 Request Posted!',
        'We are notifying compatible donors in your area right now.',
        [{ text: 'View Request', onPress: () => router.push(`/request/${req.id}`) }]
      );
      // Reset form
      setHospital('');
      setHospitalAddress('');
      setNotes('');
      setUnits('1');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to post request. Try again.');
    } finally {
      setLoading(false);
    }
  }, [bloodGroup, urgency, units, hospital, hospitalAddress, notes, location, createRequest, refreshLocation, router]);

  const urgencyCfg = URGENCY_CONFIG[urgency];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenHeader title="Post Blood Request" subtitle="Connect with nearby donors instantly" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empathy banner */}
        <Card style={[styles.empathyBanner, { borderColor: `${theme.primary}44` }]}>
          <Text style={styles.empathyIcon}>💉</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.empathyTitle, { color: theme.textPrimary }]}>
              Your request can save a life in minutes
            </Text>
            <Text style={[styles.empathySub, { color: theme.textSecondary }]}>
              We'll instantly notify all compatible donors within 50 km using GPS geo-fencing.
            </Text>
          </View>
        </Card>

        {/* Blood Group */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Blood Group Needed</Text>
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity
                key={bg}
                onPress={() => setBloodGroup(bg)}
                style={[
                  styles.bloodOption,
                  {
                    borderColor: bloodGroup === bg ? theme.primary : theme.border,
                    backgroundColor: bloodGroup === bg ? `${theme.primary}18` : theme.card,
                  },
                ]}
                activeOpacity={0.8}
              >
                <BloodGroupBadge bloodGroup={bg} size="md" showGlow={bloodGroup === bg} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Urgency */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Urgency Level</Text>
          <View style={styles.urgencyRow}>
            {URGENCY_LEVELS.map((u) => {
              const cfg = URGENCY_CONFIG[u];
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[
                    styles.urgencyOption,
                    {
                      borderColor: urgency === u ? cfg.color : theme.border,
                      backgroundColor: urgency === u ? `${cfg.color}18` : theme.card,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.urgencyIcon}>{cfg.icon}</Text>
                  <Text style={[styles.urgencyLabel, { color: urgency === u ? cfg.color : theme.textSecondary }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Units */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Units Required</Text>
          <View style={styles.unitsRow}>
            {['1', '2', '3', '4', '5'].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setUnits(n)}
                style={[
                  styles.unitBtn,
                  {
                    borderColor: units === n ? theme.accent : theme.border,
                    backgroundColor: units === n ? `${theme.accent}18` : theme.card,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.unitLabel, { color: units === n ? theme.accent : theme.textSecondary }]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hospital details */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Hospital Information</Text>
          <Input
            label="Hospital Name"
            placeholder="City Hospital, Lahore"
            value={hospital}
            onChangeText={setHospital}
            leftIcon={<Text>🏥</Text>}
          />
          <Input
            label="Hospital Address"
            placeholder="Garden Town, Lahore"
            value={hospitalAddress}
            onChangeText={setHospitalAddress}
            leftIcon={<Text>📍</Text>}
            multiline
            numberOfLines={2}
          />
          <Input
            label="Additional Notes (optional)"
            placeholder="Patient name, ward number, contact info…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Location */}
        <Card style={[styles.locCard, { borderColor: location ? theme.success + '55' : theme.border }]}>
          <View style={styles.locRow}>
            <Text style={{ fontSize: 20 }}>{location ? '📍' : '🔍'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.locTitle, { color: theme.textPrimary }]}>
                {location ? 'Location detected' : 'Location required'}
              </Text>
              <Text style={[styles.locSub, { color: theme.textSecondary }]} numberOfLines={2}>
                {address ?? (locLoading ? 'Detecting location…' : 'Tap to detect your location')}
              </Text>
            </View>
            {!location && (
              <Button label="Allow" variant="outline" size="sm" onPress={refreshLocation} loading={locLoading} />
            )}
          </View>
        </Card>

        {/* Submit */}
        <Button
          label={`🩸 Post ${urgencyCfg.icon} ${urgencyCfg.label} Request`}
          variant="primary"
          size="lg"
          onPress={submit}
          loading={loading}
          fullWidth
        />

        <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
          🔒 Only your blood group and hospital location are shared with matched donors.
          Your full profile is shared only after a donor accepts.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: Spacing[4], paddingTop: Spacing[4], gap: Spacing[5] },
  empathyBanner: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start', borderWidth: 1 },
  empathyIcon:   { fontSize: 24 },
  empathyTitle:  { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginBottom: 2 },
  empathySub:    { fontSize: FontSize.xs, lineHeight: 18 },
  section:       { gap: Spacing[3] },
  sectionLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  bloodGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  bloodOption:   { borderRadius: BorderRadius.base, borderWidth: 2, padding: Spacing[2] },
  urgencyRow:    { flexDirection: 'row', gap: Spacing[2] },
  urgencyOption: {
    flex: 1, alignItems: 'center', padding: Spacing[3],
    borderRadius: BorderRadius.base, borderWidth: 2, gap: Spacing[1],
  },
  urgencyIcon:  { fontSize: 20 },
  urgencyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  unitsRow:     { flexDirection: 'row', gap: Spacing[2] },
  unitBtn: {
    width: 48, height: 48, borderRadius: BorderRadius.base,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  unitLabel:   { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  locCard:     { borderWidth: 1 },
  locRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  locTitle:    { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  locSub:      { fontSize: FontSize.xs, marginTop: 2 },
  disclaimer:  { fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },
});
