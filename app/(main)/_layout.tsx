import { Stack } from 'expo-router';
import { COLORS } from '@/src/shared/constants';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: COLORS.primary },
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: '', headerShown: true }}
      />
      <Stack.Screen
        name="scanner"
        options={{ title: 'Escáner QR', headerShown: true }}
      />
      <Stack.Screen
        name="profile"
        options={{ title: 'Mi Perfil', headerShown: true }}
      />
      <Stack.Screen
        name="change-password"
        options={{ title: 'Cambiar Contraseña', headerShown: true }}
      />
    </Stack>
  );
}
