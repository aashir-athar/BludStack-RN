// ui/index.ts
// BludStack design-system barrel. Phase C foundation primitives; Phase D adds
// the composite components (ProfileCard, RequestCard, ScreenHeader, Toast, …).
export { Text, Heading, type TextProps } from './Text';
export { Card, type CardProps } from './Card';
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';
export { Surface, type SurfaceProps, type SurfaceVariant } from './Surface';
export { Skeleton, type SkeletonProps } from './Skeleton';
export { PressableScale, type PressableScaleProps } from './PressableScale';
export { BrandMark, type BrandMarkProps, type BrandMarkVariant } from './BrandMark';

// Layout primitives screens compose with.
export { View } from '@tamagui/core';
export { Box, XStack, YStack } from './layout';
