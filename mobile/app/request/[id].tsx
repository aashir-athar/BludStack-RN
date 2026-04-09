// app/request/[id].tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabase';
import { BloodRequest, RequestResponse } from '@/hooks/useRequests';
import { useLocation } from '@/hooks/useLocation';
import BloodGroupBadge from '@/components/BloodGroupBadge';
import ProfileCard from '@/components/ProfileCard';
import Card from '@/components/Card';
import Button from '@/components/Button';
import LoadingScreen from '@/components/LoadingScreen';
import UrgencyBanner from '@/components/UrgencyBanner';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { URGENCY_CONFIG, DONOR_FOR_RECIPIENT } from '@/constants/BloodData';
import { formatDate, timeAgo } from '@/utils/helpers';
import { haversineDistance, formatDistance, estimateDriveMinutes, deltaFromKm } from '@/utils/geo';

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, isDark } = useTheme();
  const { user, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { location } = useLocation(true);

  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [responses, setResponses] = useState<RequestResponse[]>([]);
  const [myResponse, setMyResponse] = useState<RequestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('blood_requests')
        .select(`*, recipient:profiles!recipient_id (id, full_name, phone, avatar_url, blood_group, total_donations, is_verified, share_medical_history, medical_conditions)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      setRequest(data as any);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load request');
    }
  }, [id]);

  const fetchResponses = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('request_responses')
        .select(`*, donor:profiles!donor_id (full_name, phone, blood_group, avatar_url, total_donations, is_verified, share_medical_history, medical_conditions, latitude, longitude, is_available_to_donate, last_donation_date)`)
        .eq('request_id', id)
        .order('created_at', { ascending: false });
      setResponses((data as RequestResponse[]) ?? []);
      const mine = (data ?? []).find((r: any) => r.donor_id === user?.id);
      setMyResponse(mine as RequestResponse ?? null);
    } catch { /* silent */ }
  }, [id, user]);

  useEffect(() => {
    Promise.all([fetchRequest(), fetchResponses()]).finally(() => setLoading(false));

    const sub = supabase
      .channel(`request_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'request_responses', filter: `request_id=eq.${id}` }, fetchResponses)
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [fetchRequest, fetchResponses, id]);

  const handleAccept = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('request_responses')
        .upsert({ request_id: id, donor_id: user.id, status: 'accepted' }, { onConflict: 'request_id,donor_id' });
      if (error) throw error;
      await fetchResponses();
      Alert.alert('✅ Accepted!', 'The recipient has been notified. Head to the hospital as soon as possible.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setActionLoading(false);
    }
  }, [user, id, fetchResponses]);

  const handleDecline = useCallback(async () => {
    if (!user?.id || !id) return;
    setActionLoading(true);
    try {
      await supabase
        .from('request_responses')
        .upsert({ request_id: id, donor_id: user.id, status: 'declined' }, { onConflict: 'request_id,donor_id' });
      await fetchResponses();
    } catch { /* silent */ } finally {
      setActionLoading(false);
    }
  }, [user, id, fetchResponses]);

  const handleMarkComplete = useCallback(async () => {
    if (!id || !user?.id) return;
    Alert.alert(
      'Mark as Fulfilled?',
      'This will close the request and update the donor\'s donation record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Mark Fulfilled',
          onPress: async () => {
            setActionLoading(true);
            try {
              await supabase.from('blood_requests').update({ status: 'fulfilled' }).eq('id', id);
              // Update donor's donation count
              const acceptedDonor = responses.find((r) => r.status === 'accepted');
              if (acceptedDonor?.donor_id) {
                const { data: donorProfile } = await supabase.from('profiles').select('total_donations').eq('id', acceptedDonor.donor_id).single();
                await supabase.from('profiles').update({
                  total_donations: (donorProfile?.total_donations ?? 0) + 1,
                  last_donation_date: new Date().toISOString(),
                }).eq('id', acceptedDonor.donor_id);
                await supabase.from('request_responses').update({ status: 'completed' }).eq('id', acceptedDonor.id);
              }
              await fetchRequest();
              Alert.alert('🎉 Thank you!', 'The donation has been recorded. Your generosity saves lives!');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [id, user, responses, fetchRequest]);

  const callRecipient = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`);
  }, []);

  const messageRecipient = useCallback((phone: string) => {
    Linking.openURL(`sms:${phone}`);
  }, []);

  const openMaps = useCallback(() => {
    if (!request) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${request.latitude},${request.longitude}&travelmode=driving`;
    Linking.openURL(url);
  }, [request]);

  if (loading) return <LoadingScreen message="Loading request…" />;
  if (!request) return null;

  const urgency = URGENCY_CONFIG[request.urgency];
  const isMyRequest = request.recipient_id === user?.id;
  const distance = location
    ? haversineDistance(location.latitude, location.longitude, request.latitude, request.longitude)
    : null;

  const compatibleDonor = profile?.blood_group
    ? DONOR_FOR_RECIPIENT[request.blood_group as keyof typeof DONOR_FOR_RECIPIENT]?.includes(profile.blood_group as any)
    : false;

  const acceptedResponses = responses.filter((r) => r.status === 'accepted');
  const isFulfilled = request.status === 'fulfilled';
  const isCancelled = request.status === 'cancelled';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top, backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: theme.accent }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: theme.textPrimary }]}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing[10] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge */}
        <View style={[styles.statusBadge, {
          backgroundColor: isFulfilled ? `${theme.success}22` : isCancelled ? `${theme.textMuted}22` : `${urgency.color}22`,
          borderColor: isFulfilled ? theme.success : isCancelled ? theme.textMuted : urgency.color,
        }]}>
          <Text style={styles.statusIcon}>
            {isFulfilled ? '✅' : isCancelled ? '❌' : urgency.icon}
          </Text>
          <Text style={[styles.statusText, { color: isFulfilled ? theme.success : isCancelled ? theme.textMuted : urgency.color }]}>
            {isFulfilled ? 'Fulfilled' : isCancelled ? 'Cancelled' : urgency.label + ' · ' + timeAgo(request.created_at)}
          </Text>
        </View>

        {/* Blood group + details */}
        <Card elevated style={styles.mainCard}>
          <View style={styles.mainRow}>
            <BloodGroupBadge bloodGroup={request.blood_group} size="xl" showGlow />
            <View style={{ flex: 1, gap: Spacing[1] }}>
              <Text style={[styles.hospitalName, { color: theme.textPrimary }]}>{request.hospital_name}</Text>
              <Text style={[styles.hospitalAddress, { color: theme.textSecondary }]}>{request.hospital_address}</Text>
              <Text style={[styles.unitsText, { color: theme.primary }]}>
                {request.units_needed} unit{request.units_needed !== 1 ? 's' : ''} needed
              </Text>
            </View>
          </View>

          {/* Distance + ETA */}
          {distance !== null && (
            <View style={[styles.distRow, { borderTopColor: theme.border }]}>
              <View style={styles.distItem}>
                <Text style={styles.distIcon}>📍</Text>
                <View>
                  <Text style={[styles.distValue, { color: theme.accent }]}>{formatDistance(distance)}</Text>
                  <Text style={[styles.distLabel, { color: theme.textMuted }]}>Distance</Text>
                </View>
              </View>
              <View style={styles.distItem}>
                <Text style={styles.distIcon}>🚗</Text>
                <View>
                  <Text style={[styles.distValue, { color: theme.accent }]}>{estimateDriveMinutes(distance)} min</Text>
                  <Text style={[styles.distLabel, { color: theme.textMuted }]}>Est. drive</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={openMaps}
                style={[styles.directionsBtn, { backgroundColor: theme.accent }]}
                activeOpacity={0.85}
              >
                <Text style={styles.directionsBtnText}>🗺️ Directions</Text>
              </TouchableOpacity>
            </View>
          )}

          {request.notes && (
            <View style={[styles.notesBox, { backgroundColor: theme.muted, borderColor: theme.border }]}>
              <Text style={[styles.notesLabel, { color: theme.textMuted }]}>📝 Notes</Text>
              <Text style={[styles.notesText, { color: theme.textSecondary }]}>{request.notes}</Text>
            </View>
          )}
        </Card>

        {/* Map */}
        <Card noPadding elevated style={{ overflow: 'hidden' }}>
          <MapView
            style={{ height: 200, width: '100%' }}
            provider={PROVIDER_DEFAULT}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            region={{
              latitude: request.latitude,
              longitude: request.longitude,
              latitudeDelta: deltaFromKm(2),
              longitudeDelta: deltaFromKm(2),
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker
              coordinate={{ latitude: request.latitude, longitude: request.longitude }}
              title={request.hospital_name}
            />
          </MapView>
        </Card>

        {/* Recipient info (shown to accepted donors) */}
        {(myResponse?.status === 'accepted' || isMyRequest) && request.recipient && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              {isMyRequest ? '📋 Your Request' : '🏥 Recipient'}
            </Text>
            <ProfileCard
              profile={request.recipient as any}
              onCall={!isMyRequest ? () => callRecipient((request.recipient as any).phone) : undefined}
              onMessage={!isMyRequest ? () => messageRecipient((request.recipient as any).phone) : undefined}
            />
          </View>
        )}

        {/* Accepted donors (shown to recipient) */}
        {isMyRequest && acceptedResponses.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
              🩸 {acceptedResponses.length} Donor{acceptedResponses.length !== 1 ? 's' : ''} Accepted
            </Text>
            {acceptedResponses.map((resp) => resp.donor && (
              <ProfileCard
                key={resp.id}
                profile={resp.donor as any}
                onCall={() => callRecipient((resp.donor as any).phone)}
                onMessage={() => messageRecipient((resp.donor as any).phone)}
              />
            ))}
          </View>
        )}

        {/* Pending responses count */}
        {isMyRequest && responses.filter((r) => r.status === 'pending').length > 0 && (
          <Card style={[styles.pendingBanner, { borderColor: theme.warning + '55' }]}>
            <Text style={styles.pendingIcon}>⏳</Text>
            <Text style={[styles.pendingText, { color: theme.textSecondary }]}>
              {responses.filter((r) => r.status === 'pending').length} donor{responses.filter((r) => r.status === 'pending').length !== 1 ? 's' : ''} notified — waiting for responses
            </Text>
          </Card>
        )}

        {/* Donor action — Accept / Decline */}
        {!isMyRequest && !isFulfilled && !isCancelled && (
          <View style={styles.actionSection}>
            {!compatibleDonor && (
              <Card style={[styles.incompatibleBanner, { borderColor: theme.warning + '55' }]}>
                <Text style={styles.pendingIcon}>⚠️</Text>
                <Text style={[styles.pendingText, { color: theme.textSecondary }]}>
                  Your blood group ({profile?.blood_group}) may not be compatible with {request.blood_group}.
                  Please consult medical staff before donating.
                </Text>
              </Card>
            )}

            {myResponse?.status === 'accepted' ? (
              <Card style={[styles.acceptedCard, { borderColor: theme.success + '55' }]}>
                <Text style={{ fontSize: 24, textAlign: 'center' }}>✅</Text>
                <Text style={[styles.acceptedText, { color: theme.success }]}>
                  You've accepted this request
                </Text>
                <Text style={[styles.acceptedSub, { color: theme.textSecondary }]}>
                  Head to {request.hospital_name} as soon as possible.
                </Text>
                <Button label="🗺️ Get Directions" variant="secondary" onPress={openMaps} fullWidth />
              </Card>
            ) : myResponse?.status === 'declined' ? (
              <Text style={[styles.declinedText, { color: theme.textMuted }]}>
                You declined this request.
              </Text>
            ) : (
              <View style={styles.actionBtns}>
                <Button
                  label="✓ Accept & Donate"
                  variant="primary"
                  size="lg"
                  onPress={handleAccept}
                  loading={actionLoading}
                  style={{ flex: 2 }}
                />
                <Button
                  label="Decline"
                  variant="ghost"
                  onPress={handleDecline}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        )}

        {/* Recipient: mark as fulfilled */}
        {isMyRequest && request.status === 'active' && acceptedResponses.length > 0 && (
          <Button
            label="✅ Mark as Fulfilled"
            variant="success"
            size="lg"
            onPress={handleMarkComplete}
            loading={actionLoading}
            fullWidth
          />
        )}

        {/* Recipient: cancel request */}
        {isMyRequest && request.status === 'active' && (
          <Button
            label="Cancel Request"
            variant="ghost"
            onPress={async () => {
              Alert.alert('Cancel Request', 'Are you sure?', [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel Request', style: 'destructive',
                  onPress: async () => {
                    await supabase.from('blood_requests').update({ status: 'cancelled' }).eq('id', id);
                    await fetchRequest();
                  },
                },
              ]);
            }}
            fullWidth
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backIcon:      { fontSize: 22 },
  topTitle:      { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  scroll:        { padding: Spacing[4], gap: Spacing[4] },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    alignSelf: 'flex-start', paddingHorizontal: Spacing[3], paddingVertical: Spacing[1.5],
    borderRadius: BorderRadius.full, borderWidth: 1,
  },
  statusIcon:    { fontSize: 16 },
  statusText:    { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  mainCard:      { gap: Spacing[4] },
  mainRow:       { flexDirection: 'row', gap: Spacing[4], alignItems: 'flex-start' },
  hospitalName:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  hospitalAddress: { fontSize: FontSize.sm },
  unitsText:     { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  distRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  distItem:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flex: 1 },
  distIcon:      { fontSize: 18 },
  distValue:     { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  distLabel:     { fontSize: FontSize.xs },
  directionsBtn: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.base },
  directionsBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  notesBox: { padding: Spacing[3], borderRadius: BorderRadius.base, borderWidth: 1, gap: Spacing[1] },
  notesLabel:    { fontSize: FontSize.xs },
  notesText:     { fontSize: FontSize.sm, lineHeight: 20 },
  section:       { gap: Spacing[3] },
  sectionTitle:  { fontSize: FontSize.md, fontWeight: FontWeight.bold },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderWidth: 1 },
  incompatibleBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], borderWidth: 1 },
  pendingIcon:   { fontSize: 20 },
  pendingText:   { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  actionSection: { gap: Spacing[3] },
  actionBtns:    { flexDirection: 'row', gap: Spacing[3] },
  acceptedCard:  { gap: Spacing[3], alignItems: 'center', borderWidth: 1.5 },
  acceptedText:  { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  acceptedSub:   { fontSize: FontSize.sm, textAlign: 'center' },
  declinedText:  { fontSize: FontSize.sm, textAlign: 'center', fontStyle: 'italic' },
});
