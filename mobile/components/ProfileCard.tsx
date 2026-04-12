// components/ProfileCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';
import BloodGroupBadge from './BloodGroupBadge';
import { FontSize, FontWeight, Spacing, Radius, LetterSpacing } from '@/constants/Typography';
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
  };
  compact?: boolean;
  onPress?: () => void;
  onCall?: () => void;
  onMessage?: () => void;
}

const ProfileCard = React.memo(function ProfileCard({
  profile, compact, onPress, onCall, onMessage,
}: ProfileCardProps) {
  const { theme } = useTheme();
  const { canDonate, daysLeft } = canDonateAgain(profile.last_donation_date);
  const available = profile.is_available_to_donate && canDonate;
  const statusColor = available ? theme.success : theme.warning;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        {/* Avatar */}
        <View style={[styles.avatarWrap, { borderColor: statusColor }]}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: theme.cardElevated }]}>
              <Text style={[styles.initial, { color: theme.textPrimary }]}>
                {profile.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.statusDot, { backgroundColor: statusColor, borderColor: theme.card }]} />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
              {profile.full_name}
            </Text>
            {profile.is_verified && (
              <Text style={[styles.verified, { color: theme.success }]}> ✓</Text>
            )}
          </View>
          <Text style={[styles.status, { color: statusColor }]}>
            {available ? 'Available to donate' : daysLeft > 0 ? `Eligible in ${daysLeft} days` : 'Unavailable'}
          </Text>
          {!compact && (
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {profile.total_donations} donation{profile.total_donations !== 1 ? 's' : ''}
              {profile.last_donation_date ? `  ·  Last: ${formatDate(profile.last_donation_date)}` : ''}
            </Text>
          )}
        </View>

        <BloodGroupBadge bloodGroup={profile.blood_group} size={compact ? 'sm' : 'md'} />
      </View>

      {/* Medical conditions */}
      {!compact && profile.share_medical_history && (profile.medical_conditions?.length ?? 0) > 0 && (
        <View style={[styles.medRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.medTitle, { color: theme.textMuted }]}>DISCLOSED CONDITIONS</Text>
          <View style={styles.tags}>
            {profile.medical_conditions!.map(c => (
              <View key={c} style={[styles.tag, { backgroundColor: theme.cardElevated }]}>
                <Text style={[styles.tagText, { color: theme.textSecondary }]}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      {(onCall || onMessage) && (
        <View style={[styles.actions, { borderTopColor: theme.border }]}>
          {onMessage && (
            <TouchableOpacity onPress={onMessage} style={[styles.actionBtn, { backgroundColor: theme.cardElevated }]} activeOpacity={0.7}>
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>💬  Message</Text>
            </TouchableOpacity>
          )}
          {onCall && (
            <TouchableOpacity onPress={onCall} style={[styles.actionBtn, { backgroundColor: theme.primary }]} activeOpacity={0.7}>
              <Text style={[styles.actionLabel, { color: '#fff' }]}>📞  Call</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card:         { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: Spacing[3] },
  header:       { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], padding: Spacing[4] },
  avatarWrap:   { borderRadius: Radius.full, borderWidth: 2, padding: 2 },
  avatar:       { width: 50, height: 50, borderRadius: 25 },
  avatarFallback:{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  initial:      { fontSize: FontSize.lg, fontWeight: FontWeight.black },
  statusDot:    { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  info:         { flex: 1, gap: 2 },
  nameRow:      { flexDirection: 'row', alignItems: 'center' },
  name:         { fontSize: FontSize.base, fontWeight: FontWeight.bold, flex: 1 },
  verified:     { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  status:       { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: LetterSpacing.wide },
  meta:         { fontSize: FontSize.xs },
  medRow:       { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing[4], paddingTop: Spacing[3], gap: Spacing[2] },
  medTitle:     { fontSize: FontSize['2xs'], fontWeight: FontWeight.bold, letterSpacing: LetterSpacing.widest, textTransform: 'uppercase' },
  tags:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[1] },
  tag:          { paddingHorizontal: Spacing[2], paddingVertical: 3, borderRadius: Radius.xs },
  tagText:      { fontSize: FontSize.xs },
  actions:      { flexDirection: 'row', gap: Spacing[2], borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing[3] },
  actionBtn:    { flex: 1, paddingVertical: Spacing[3], borderRadius: Radius.xs, alignItems: 'center' },
  actionLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});

export default ProfileCard;
