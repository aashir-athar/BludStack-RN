// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { useAppTheme } from '@/stores/themeStore';

export default function AuthLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: 'fade',
      }}
    />
  );
}
