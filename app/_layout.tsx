/**
 * Punto de entrada principal de la app
 * Inicializa el ServiceContainer y configura el provider de autenticación
 * Splash screen personalizado a pantalla completa
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Image, StyleSheet, Dimensions } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/src/presentation';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { COLORS } from '@/src/shared/constants';

// Precargar la imagen del splash
const splashImage = require('@/assets/splash.png');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function RootLayoutNav() {
  const { isLoading, isAuthenticated, sesion, isAdministrador } = useAuth();

  // Verificar si necesita seleccionar almacen
  // Los administradores NO necesitan seleccionar almacen para entrar al admin panel
  const needsAlmacenSelection = isAuthenticated && sesion?.usuario && 
    !isAdministrador &&
    sesion.usuario.almacenesAsignados.length > 1 && !sesion.almacenSeleccionado;

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <Image source={splashImage} style={styles.splashFullImage} resizeMode="cover" />
        <View style={styles.splashLoadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.splashLoadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  // Si no está autenticado, mostrar login
  if (!isAuthenticated && !needsAlmacenSelection) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.primary },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="forgot-password" options={{ title: 'Recuperar Contraseña', headerShown: true }} />
      </Stack>
    );
  }

  // Si es administrador autenticado, mostrar flujo admin + main
  if (isAuthenticated && isAdministrador) {
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
          name="admin"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="(main)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Configuración', headerShown: true }}
        />
      </Stack>
    );
  }

  // Si necesita seleccionar almacen (usuarios no-admin con múltiples almacenes)
  if (needsAlmacenSelection) {
    return (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.primary },
        }}
      >
        <Stack.Screen name="select-almacen" />
      </Stack>
    );
  }

  // Si está autenticado con almacen seleccionado (usuario normal)
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
        name="(main)"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Prevenir que el splash nativo se oculte automáticamente
    // Se mantiene visible hasta que la app esté completamente lista
    SplashScreen.preventAutoHideAsync().catch(() => {});

    // Seguridad: si la inicialización se cuelga, forzar el ocultamiento del
    // splash nativo Y desbloquear el estado en JS, para que la app nunca quede
    // atascada en la pantalla de carga sin posibilidad de recuperarse.
    const forceHide = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setInitError((prev) => prev ?? 'La inicialización tardó demasiado (timeout). Reinicia la aplicación.');
    }, 8000);

    initializeApp().finally(() => clearTimeout(forceHide));
  }, []);

  async function initializeApp() {
    try {
      // Inicializar el ServiceContainer
      await serviceContainer.initialize();
      setIsInitialized(true);
    } catch (error) {
      setInitError(error instanceof Error ? error.message : 'Error al inicializar');
    } finally {
      // Ocultar el splash nativo en todos los casos (éxito o error)
      await SplashScreen.hideAsync().catch(() => {});
    }
  }

  if (initError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary, padding: 20 }}>
        <Text style={{ color: COLORS.error, fontSize: 18, marginBottom: 10 }}>Error de inicialización</Text>
        <Text style={{ color: COLORS.white, textAlign: 'center' }}>{initError}</Text>
      </View>
    );
  }

  if (!isInitialized) {
    // Mientras inicializa, mostrar splash personalizado a pantalla completa
    return (
      <View style={styles.splashContainer}>
        <Image source={splashImage} style={styles.splashFullImage} resizeMode="cover" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  splashFullImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  splashLoadingOverlay: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    gap: 8,
  },
  splashLoadingText: {
    color: COLORS.lightGray,
    fontSize: 14,
  },
});
