// ui/layout.tsx
// Lightweight Tamagui layout primitives (avoids pulling the whole `tamagui`
// package). Tamagui's View is already a flex container; these just name the
// direction so screens read clearly.
import { View, styled } from '@tamagui/core';

export const Box = View;

export const YStack = styled(View, {
  name: 'YStack',
  flexDirection: 'column',
});

export const XStack = styled(View, {
  name: 'XStack',
  flexDirection: 'row',
});
