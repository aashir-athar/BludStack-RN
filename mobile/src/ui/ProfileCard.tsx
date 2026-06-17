// Donor/recipient card: avatar, name, blood badge, status, donations. Contact
// pills (call / WhatsApp / chat) render ONLY when the parent passes the intent,
// so number disclosure stays parent-controlled.
import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';
import { Card } from './Card';
import { BloodGroupBadge } from './BloodGroupBadge';
import { ReputationBadge } from './ReputationBadge';
import { PressableScale } from './PressableScale';

export interface ProfileCardData {
  id: string;
  full_name: string;
  blood_group: string;
  avatar_url?: string | null;
  total_donations?: number;
  is_verified?: boolean;
  is_available_to_donate?: boolean;
  distanceKm?: number;
}

export interface ProfileCardProps {
  profile: ProfileCardData;
  onPress?: () => void;
  compact?: boolean;
  contact?: { onCall?: () => void; onWhatsApp?: () => void; onChat?: () => void };
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function ContactPill({ icon, label, onPress, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; color: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing[1],
        paddingVertical: Spacing[2], borderRadius: Radius.pill, borderCurve: 'continuous',
        backgroundColor: color + '1A',
      }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="labelSm" style={{ color }}>{label}</Text>
    </Pressable>
  );
}

function ProfileCardImpl({ profile, onPress, compact, contact }: ProfileCardProps) {
  const theme = useAppTheme();
  const available = profile.is_available_to_donate;
  const distance = profile.distanceKm != null
    ? profile.distanceKm < 1 ? `${Math.round(profile.distanceKm * 1000)} m` : `${profile.distanceKm.toFixed(1)} km`
    : null;

  return (
    <PressableScale onPress={onPress} haptic={!!onPress} accessibilityRole="button" accessibilityLabel={`${profile.full_name}, ${profile.blood_group}`}>
      <Card variant="elevated" style={{ gap: Spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[3] }}>
          <View style={{ width: 48, height: 48, borderRadius: Radius.pill, overflow: 'hidden', backgroundColor: theme.primaryGhost, alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url ? (
              <Image source={profile.avatar_url} style={{ width: 48, height: 48 }} contentFit="cover" cachePolicy="memory-disk" transition={150} />
            ) : (
              <Text variant="label" tone="brand">{initials(profile.full_name)}</Text>
            )}
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
              <Text variant="titleSm" numberOfLines={1} style={{ flexShrink: 1 }}>{profile.full_name}</Text>
              {profile.is_verified ? <Ionicons name="checkmark-circle" size={15} color={theme.success} /> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[2], flexWrap: 'wrap' }}>
              {profile.total_donations != null ? (
                <ReputationBadge totalDonations={profile.total_donations} size="sm" />
              ) : null}
              {distance ? <Text variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>{distance} away</Text> : null}
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', gap: Spacing[1] }}>
            <BloodGroupBadge group={profile.blood_group} size="md" />
            {!compact ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing[1] }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: available ? theme.success : theme.textTertiary }} />
                <Text variant="caption" tone={available ? 'success' : 'tertiary'}>{available ? 'Available' : 'Resting'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {contact ? (
          <View style={{ flexDirection: 'row', gap: Spacing[2] }}>
            {contact.onCall ? <ContactPill icon="call" label="Call" onPress={contact.onCall} color={theme.success} /> : null}
            {contact.onWhatsApp ? <ContactPill icon="logo-whatsapp" label="WhatsApp" onPress={contact.onWhatsApp} color={theme.success} /> : null}
            {contact.onChat ? <ContactPill icon="chatbubble-ellipses" label="Message" onPress={contact.onChat} color={theme.primary} /> : null}
          </View>
        ) : null}
      </Card>
    </PressableScale>
  );
}

export const ProfileCard = React.memo(ProfileCardImpl);
export default ProfileCard;
