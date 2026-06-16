// Verb-led empty state: icon circle, title, one line of why, one action. Speaks
// to the moment and always gives a way forward (state law).
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, Radius } from '@/constants/Typography';
import { useAppTheme } from '@/stores/themeStore';
import { Text } from './Text';
import { Button } from './Button';
import { BrandMark } from './BrandMark';

export interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  brand?: boolean;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

function EmptyStateImpl({ icon = 'sparkles-outline', brand, title, body, actionLabel, onAction }: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={{ alignItems: 'center', paddingHorizontal: Spacing[8], gap: Spacing[4] }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: Radius.pill,
          borderCurve: 'continuous',
          backgroundColor: theme.primaryGhost,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {brand ? <BrandMark size={36} /> : <Ionicons name={icon} size={32} color={theme.primary} />}
      </View>

      <View style={{ gap: Spacing[1], alignItems: 'center' }}>
        <Text variant="title" style={{ textAlign: 'center' }}>{title}</Text>
        {body ? (
          <Text variant="bodySm" tone="muted" style={{ textAlign: 'center' }}>{body}</Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="md" style={{ marginTop: Spacing[2] }} />
      ) : null}
    </View>
  );
}

export const EmptyState = React.memo(EmptyStateImpl);
export default EmptyState;
