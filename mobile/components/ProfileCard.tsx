// components/ProfileCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';
import BloodGroupBadge from './BloodGroupBadge';
import Card from './Card';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/Typography';
import { formatDate, canDonateAgain } from '@/utils/helpers';

interface ProfileCardProps {
  profile: {
    id: string;
    full_name: string;
    blood_group: string;
    total_donations: number;
    last_donation_date: string | null;
    is_verified: boolean;
    is_available_to_donate: boolean;
    avatar_url: string | null;
    medical_conditions?: string[];
    share_medical_history?: boolean;
    gender?: string;
  };
  compact?: boolean;
  onPress?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
}

const ProfileCard = React.memo(function ProfileCard({
  profile,
  compact = false,
  onPress,
  onCall,
  onMessage,
}: ProfileCardProps) {
  const { theme } = useTheme();
  const { canDonate, daysLeft } = canDonateAgain(profile.last_donation_date);
  const availabilityColor = profile.is_available_to_donate && canDonate ? theme.success : theme.warning;
  const availabilityLabel =
    profile.is_available_to_donate && canDonate
      ? 'Available'
      : daysLeft > 0
      ? `Available in ${daysLeft}d`
      : 'Unavailable';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.82 : 1} disabled={!onPress}>
      <Card elevated style={styles.card}>
        <View style={styles.header}>
          {/* Avatar */}
          <View style={[styles.avatarWrap, { borderColor: availabilityColor }]}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.muted }]}>
                <Text style={styles.avatarInitial}>
                  {profile.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Availability dot */}
            <View style={[styles.dot, { backgroundColor: availabilityColor }]} />
          </View>

          {/* Info */}
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {profile.full_name}
              </Text>
              {profile.is_verified && (
                <Text style={styles.verifiedBadge}>✓</Text>
              )}
            </View>
            <Text style={[styles.availability, { color: availabilityColor }]}>
              {availabilityLabel}
            </Text>
            {!compact && (
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {profile.total_donations} donation{profile.total_donations !== 1 ? 's' : ''}
                {profile.last_donation_date ? ` · Last: ${formatDate(profile.last_donation_date)}` : ''}
              </Text>
            )}
          </View>

          <BloodGroupBadge bloodGroup={profile.blood_group} size={compact ? 'sm' : 'md'} showGlow />
        </View>

        {/* Medical history (if shared and not compact) */}
        {!compact && profile.share_medical_history && profile.medical_conditions && profile.medical_conditions.length > 0 && (
          <View style={[styles.medSection, { borderTopColor: theme.border }]}>
            <Text style={[styles.medLabel, { color: theme.textMuted }]}>Disclosed conditions:</Text>
            <View style={styles.medTags}>
              {profile.medical_conditions.map((c) => (
                <View key={c} style={[styles.medTag, { backgroundColor: theme.muted, borderColor: theme.border }]}>
                  <Text style={[styles.medTagText, { color: theme.textSecondary }]}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        {(onCall || onMessage) && (
          <View style={[styles.actions, { borderTopColor: theme.border }]}>
            {onMessage && (
              <TouchableOpacity
                onPress={onMessage}
                style={[styles.actionBtn, { backgroundColor: theme.muted }]}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Message</Text>
              </TouchableOpacity>
            )}
            {onCall && (
              <TouchableOpacity
                onPress={onCall}
                style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>📞</Text>
                <Text style={[styles.actionLabel, { color: '#fff' }]}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card:          { gap: Spacing[3] },
  header:        { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  avatarWrap:    { position: 'relative', borderRadius: BorderRadius.full, borderWidth: 2, padding: 2 },
  avatar:        { width: 52, height: 52, borderRadius: BorderRadius.full },
  avatarPlaceholder: {
    width: 52, height: 52, borderRadius: BorderRadius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#fff' },
  dot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: 'transparent',
  },
  info:          { flex: 1, gap: 2 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },
  name:          { fontSize: FontSize.base, fontWeight: FontWeight.semibold, flex: 1 },
  verifiedBadge: { fontSize: FontSize.sm, color: '#00D4FF' },
  availability:  { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  meta:          { fontSize: FontSize.xs },
  medSection:    { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3], gap: Spacing[2] },
  medLabel:      { fontSize: FontSize.xs },
  medTags:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[1] },
  medTag:        { paddingHorizontal: Spacing[2], paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1 },
  medTagText:    { fontSize: FontSize.xs },
  actions: {
    flexDirection: 'row', gap: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing[3],
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing[1.5], paddingVertical: Spacing[2.5], borderRadius: BorderRadius.base,
  },
  actionIcon:  { fontSize: FontSize.base },
  actionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

export default ProfileCard;
