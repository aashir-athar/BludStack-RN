// components/ProfileCard.tsx
// Pill-radius profile card with avatar, status, blood badge, optional contact
// row (Call / WhatsApp / Message). Used by the recipient to see an accepted
// donor (and vice-versa). Contact rows only render when handlers are passed —
// the parent controls disclosure (e.g. show only after donor accepts).

import React from 'react';
import {
  View, Text, StyleSheet, Pressable, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import BloodGroupBadge from './BloodGroupBadge';
import {
  FontSize, FontWeight, Spacing, Radius, LetterSpacing, Elevation,
} from '@/constants/Typography';
import { canDonateAgain } from '@/utils/helpers';

export interface ProfileCardProfile {
  id: string;
  full_name: string;
  blood_group: string;
  total_donations: number;
  last_donation_date: string | null;
  is_verified: boolean;
  is_available_to_donate: boolean;
  avatar_url: string | null;
  phone?: string | null;
  whatsapp_available?: boolean;
  medical_conditions?: string[];
  share_medical_history?: boolean;
}

export interface ProfileCardProps {
  profile: ProfileCardProfile;
  compact?: boolean;
  onPress?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
  onWhatsApp?: () => void;
}

const ProfileCard = React.memo(function ProfileCard({
  profile, compact, onPress, onCall, onMessage, onWhatsApp,
}: ProfileCardProps) {
  const { theme } = useTheme();
  const { canDonate, daysLeft } = canDonateAgain(profile.last_donation_date);
  const available   = profile.is_available_to_donate && canDonate;
  const statusColor = available ? theme.success : theme.warning;
  const statusLabel = available
    ? 'Available'
    : daysLeft > 0
      ? `Cooldown · ${daysLeft}d`
      : 'Unavailable';

  // Default fallback handlers when parent passes the contact intent
  const handleCall = () => {
    if (onCall) onCall();
    else if (profile.phone) Linking.openURL(`tel:${profile.phone}`);
  };
  const handleWhatsApp = () => {
    if (onWhatsApp) onWhatsApp();
    else if (profile.phone) {
      const digits = profile.phone.replace(/\D/g, '');
      Linking.openURL(`https://wa.me/${digits}`);
    }
  };

  const Body = (
    <View>
      <View style={styles.header}>
        <View style={[styles.avatarWrap, { borderColor: statusColor }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: theme.cardElevated }]}>
              <Text style={[styles.initial, { color: theme.textPrimary }]}>
                {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor, borderColor: theme.card },
            ]}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
              {profile.full_name}
            </Text>
            {profile.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color={theme.success} style={{ marginLeft: 4 }} />
            )}
          </View>
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          {!compact && (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {profile.total_donations} donation{profile.total_donations !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <BloodGroupBadge bloodGroup={profile.blood_group} size={compact ? 'sm' : 'md'} variant="soft" />
      </View>

      {!compact && profile.share_medical_history && (profile.medical_conditions?.length ?? 0) > 0 && (
        <View style={[styles.medRow, { borderTopColor: theme.divider }]}>
          <Text style={[styles.medTitle, { color: theme.textMuted }]}>Disclosed conditions</Text>
          <View style={styles.tags}>
            {profile.medical_conditions!.map(c => (
              <View key={c} style={[styles.tag, { backgroundColor: theme.cardElevated, borderColor: theme.border }]}>
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Contact pill row — only shows when at least one handler is passed
          AND we have a phone (for call/whatsapp) or onMessage. The recipient
          gets these unmasked once the donor accepts (parent decides). */}
      {(onCall || onMessage || onWhatsApp || profile.phone) && (
        <View style={[styles.actions, { borderTopColor: theme.divider }]}>
          {(onCall || profile.phone) && (
            <Pressable
              onPress={handleCall}
              style={({ pressed }) => [
                styles.actionPill,
                { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Call ${profile.full_name}`}
            >
              <Ionicons name="call" size={16} color={theme.textOnPrimary} />
              <Text style={[styles.actionLabel, { color: theme.textOnPrimary }]}>Call</Text>
            </Pressable>
          )}
          {(onWhatsApp || (profile.phone && profile.whatsapp_available)) && (
            <Pressable
              onPress={handleWhatsApp}
              style={({ pressed }) => [
                styles.actionPill,
                { backgroundColor: theme.success, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${profile.full_name}`}
            >
              <Ionicons name="logo-whatsapp" size={16} color={theme.textOnPrimary} />
              <Text style={[styles.actionLabel, { color: theme.textOnPrimary }]}>WhatsApp</Text>
            </Pressable>
          )}
          {onMessage && (
            <Pressable
              onPress={onMessage}
              style={({ pressed }) => [
                styles.actionPill,
                { backgroundColor: theme.cardElevated, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Message ${profile.full_name}`}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.textPrimary} />
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Chat</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.95 : 1 },
        Elevation.xs,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${profile.full_name}`}
    >
      {Body}
    </Pressable>
  ) : (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
        Elevation.xs,
      ]}
    >
      {Body}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
  },
  avatarWrap: { borderRadius: Radius.pill, borderWidth: 2, padding: 2 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarFallback: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  initial: { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  statusDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
  },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: {
    fontSize: FontSize.base, fontWeight: FontWeight.bold,
    flexShrink: 1, letterSpacing: LetterSpacing.snug,
  },
  status: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.wide, textTransform: 'uppercase',
  },
  meta: { fontSize: FontSize.xs },
  medRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    gap: Spacing[2],
  },
  medTitle: {
    fontSize: FontSize['2xs'], fontWeight: FontWeight.black,
    letterSpacing: LetterSpacing.widest, textTransform: 'uppercase',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[1] },
  tag: {
    paddingHorizontal: Spacing[2], paddingVertical: 3,
    borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth,
  },
  tagText: { fontSize: FontSize.xs },
  actions: {
    flexDirection: 'row', gap: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing[3], paddingVertical: Spacing[3],
  },
  actionPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing[1],
    paddingVertical: Spacing[3],
    borderRadius: Radius.pill,
  },
  actionLabel: {
    fontSize: FontSize.sm, fontWeight: FontWeight.bold,
    letterSpacing: LetterSpacing.snug,
  },
});

export default ProfileCard;
