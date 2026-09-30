/**
 * Pantalla Principal
 * Usa Clean Architecture con hooks de presentación
 * Incluye: cambio de almacen sin logout, auto-sync al recuperar conexión
 * Acciones en header en vez de botones flotantes
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  AlertButton,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/presentation';
import { useResumenAlmacen } from '@/src/presentation';
import { useSync } from '@/src/presentation';
import { useNetwork, setAutoSyncCallback } from '@/src/presentation';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { COLORS } from '@/src/shared/constants';
import { TipoOperacion } from '@/src/domain';

export default function MainScreen() {
  const router = useRouter();
  const { sesion, logout, isAdministrador, hasMultipleAlmacenes, cambiarAlmacen } = useAuth();
  const { resumen, isLoading, refresh: refreshResumen } = useResumenAlmacen();
  const { sync, isSyncing, getPendingCount, progress, progressMessage } = useSync();
  const { isServerReachable, checkConnection } = useNetwork();
  
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  /**
   * Marca la bandera de "primera sincronización" solo si la base local
   * quedó poblada con QRs. Si el servidor falló, la bandera sigue false
   * y se reintenta en el próximo foco o reconexión.
   */
  const maybeMarkFirstSyncDone = async () => {
    try {
      if (await serviceContainer.localConfig.obtenerPrimeraSyncCompletada()) return;
      const qrs = await serviceContainer.localQR.obtenerQRs();
      if (qrs.length > 0) {
        await serviceContainer.localConfig.guardarPrimeraSyncCompletada(true);
      }
    } catch {
      // ignore
    }
  };

  const runSync = async () => {
    await sync({
      onComplete: () => {
        loadPendingCount();
        refreshResumen();
      },
    });
    await maybeMarkFirstSyncDone();
  };

  /**
   * Primera sincronización tras login online: pobla la base local
   * (QRs, precios, almacenes, tipos de medio) para uso sin conexión.
   */
  const maybeFirstSync = async () => {
    try {
      if (await serviceContainer.localConfig.obtenerPrimeraSyncCompletada()) return;
      if (!(await checkConnection())) return;
      const s = await serviceContainer.auth.obtenerSesionLocal();
      if (!s || s.token === 'offline-token') return; // sin sesión online no hay sync
      await runSync();
    } catch {
      // ignore
    }
  };

  // Registrar auto-sync callback
  useEffect(() => {
    setAutoSyncCallback(async () => {
      // Nunca sincronizar con sesión offline: expulsaría al usuario (401 → refresh offline-fallido)
      const s = await serviceContainer.auth.obtenerSesionLocal();
      if (!s || s.token === 'offline-token') return;

      const primeraPendiente = !(await serviceContainer.localConfig.obtenerPrimeraSyncCompletada());
      const count = await getPendingCount();

      if (count > 0 || primeraPendiente) {
        await runSync();
      }
    });

    return () => {
      setAutoSyncCallback(null);
    };
  }, []);

  // Recargar resumen y pendientes cuando la pantalla toma foco
  // (al volver del escáner la entrada/salida ya está registrada en la API)
  useFocusEffect(
    React.useCallback(() => {
      loadPendingCount();
      refreshResumen();
      maybeFirstSync();
    }, [refreshResumen])
  );

  const loadPendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshResumen();
    await loadPendingCount();
    setRefreshing(false);
  };

  const handleOperationSelect = (operation: TipoOperacion) => {
    router.push({
      pathname: '/(main)/scanner',
      params: { operation },
    });
  };

  const goToSettings = () => {
    router.push('/settings');
  };

  const goToAdmin = () => {
    router.push('/admin');
  };

  const goToProfile = () => {
    router.push('/(main)/profile');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Está seguro que desea cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleMenu = () => {
    const options: any[] = [];

    if (isAdministrador) {
      options.push({
        text: 'Panel de Administración',
        onPress: goToAdmin,
      });
      options.push({
        text: 'Configuración',
        onPress: goToSettings,
      });
    }

    options.push({
      text: 'Cerrar Sesión',
      style: 'destructive',
      onPress: handleLogout,
    });

    options.push({
      text: 'Cancelar',
      style: 'cancel',
    });

    Alert.alert('Menú', 'Seleccione una opción:', options);
  };

  const handleSync = async () => {
    await runSync();
  };

  const handleSwitchAlmacen = () => {
    if (!sesion?.usuario?.almacenesAsignados) return;
    
    const almacenes = sesion.usuario.almacenesAsignados;
    
    if (almacenes.length <= 1) return;

    // Mostrar selector de almacen como ActionSheet/Alert
    const options = almacenes.map(p => p.nombre);
    options.push('Cancelar');

    Alert.alert(
      'Cambiar Almacen',
      'Seleccione el almacen donde trabajará:',
      almacenes.map<AlertButton>(p => ({
        text: p.nombre,
        onPress: async () => {
          try {
            await cambiarAlmacen(p.id);
            refreshResumen();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo cambiar el almacen');
          }
        },
      })).concat([{
        text: 'Cancelar',
        style: 'cancel' as const,
      }])
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header actions via Stack.Screen */}
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={goToProfile}>
                <MaterialCommunityIcons name="account-circle" size={28} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleMenu}>
                <MaterialCommunityIcons name="dots-vertical" size={28} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {/* Header con almacen seleccionado */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>Sistema Automatizado de Control de Inventarios</Text>
          
          {/* Almacen seleccionado - clickeable si hay múltiples */}
          {sesion?.almacenSeleccionado && (
            <TouchableOpacity 
              style={styles.almacenBadge}
              onPress={hasMultipleAlmacenes ? handleSwitchAlmacen : undefined}
              activeOpacity={hasMultipleAlmacenes ? 0.7 : 1}
            >
              <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.white} />
              <Text style={styles.almacenText}>{sesion.almacenSeleccionado.nombre}</Text>
              {hasMultipleAlmacenes && (
                <MaterialCommunityIcons name="swap-horizontal" size={16} color={COLORS.white} />
              )}
            </TouchableOpacity>
          )}

          {/* Estado de conexión */}
          <View style={[styles.connectionBadge, isServerReachable ? styles.connected : styles.disconnected]}>
            <MaterialCommunityIcons
              name={isServerReachable ? 'access-point' : 'access-point-off'}
              size={16}
              color={COLORS.white}
            />
            <Text style={styles.connectionText}>
              {isServerReachable ? 'En línea' : 'Sin conexión'}
            </Text>
          </View>
        </View>

        {/* Resumen del día */}
        {resumen && (
          <View style={styles.resumenContainer}>
            <Text style={styles.resumenTitle}>Resumen del Almacen</Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="car-side" size={24} color={COLORS.accent} />
                <Text style={styles.statValue}>{resumen.vehiculosDentro}</Text>
                <Text style={styles.statLabel}>Vehículos Dentro</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="car-arrow-right" size={24} color={COLORS.success} />
                <Text style={styles.statValue}>{resumen.vehiculosSalieronHoy}</Text>
                <Text style={styles.statLabel}>Salieron Hoy</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="cash-multiple" size={24} color={COLORS.warning} />
                <Text style={styles.statValue}>${resumen.ingresosHoy.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Ingresos Hoy</Text>
              </View>
            </View>

            {/* Detalle por tipo de medio */}
            {resumen.detallePorTipo && resumen.detallePorTipo.length > 0 && (
              <View style={styles.detalleContainer}>
                <Text style={styles.detalleTitle}>Detalle por Tipo</Text>
                {resumen.detallePorTipo.map((detalle, index) => (
                  <View key={index} style={styles.detalleRow}>
                    <Text style={styles.detalleTipo}>{detalle.categoria}</Text>
                    <Text style={styles.detalleCantidad}>{detalle.cantidad} uds</Text>
                    <Text style={styles.detalleIngreso}>${detalle.ingreso.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Pendientes de sincronización */}
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} disabled={isSyncing}>
            <MaterialCommunityIcons name="alert" size={20} color={COLORS.white} />
            <Text style={styles.syncBannerText}>
              {pendingCount} operaciones pendientes de sincronizar
            </Text>
            <Text style={styles.syncBannerAction}>
              {isSyncing ? 'Sincronizando...' : 'Tocar para sincronizar'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Progreso de sincronización */}
        {isSyncing && (
          <View style={styles.syncProgress}>
            <MaterialCommunityIcons name="sync" size={16} color={COLORS.white} />
            <Text style={styles.syncProgressText}>{progress}% - {progressMessage}</Text>
          </View>
        )}

        {/* Cambio de almacen - info para usuarios con múltiples */}
        {hasMultipleAlmacenes && (
          <TouchableOpacity style={styles.switchAlmacenBanner} onPress={handleSwitchAlmacen}>
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLORS.accent} />
            <Text style={styles.switchAlmacenText}>Toca el almacen o aquí para cambiar de almacen</Text>
          </TouchableOpacity>
        )}

        {/* Instrucciones */}
        <View style={styles.instructions}>
          <MaterialCommunityIcons name="information" size={20} color={COLORS.accent} />
          <Text style={styles.instructionText}>
            Seleccione la operación que desea realizar y escanee el código QR del vehículo
          </Text>
        </View>

        {/* Botones de operación */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.operationButton, styles.entryButton]}
            onPress={() => handleOperationSelect('entrada')}
          >
            <MaterialCommunityIcons name="car-side" size={40} color={COLORS.success} />
            <Text style={styles.operationTitle}>ENTRADA</Text>
            <Text style={styles.operationSubtitle}>Registrar ingreso de vehículo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.operationButton, styles.exitButton]}
            onPress={() => handleOperationSelect('salida')}
          >
            <MaterialCommunityIcons name="car-back" size={40} color={COLORS.error} />
            <Text style={styles.operationTitle}>SALIDA</Text>
            <Text style={styles.operationSubtitle}>Registrar salida de vehículo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.lightGray,
    marginTop: 3,
    letterSpacing: 1,
    textAlign: 'center',
  },
  almacenBadge: {
    marginTop: 15,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  almacenText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  connectionBadge: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 6,
  },
  connected: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  disconnected: {
    backgroundColor: 'rgba(244, 67, 54, 0.3)',
  },
  connectionText: {
    color: COLORS.white,
    fontSize: 12,
  },
  resumenContainer: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  resumenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.accent,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.lightGray,
    marginTop: 5,
    textAlign: 'center',
  },
  detalleContainer: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  detalleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.lightGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  detalleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  detalleTipo: {
    fontSize: 13,
    color: COLORS.white,
    flex: 1,
  },
  detalleCantidad: {
    fontSize: 13,
    color: COLORS.accent,
    textAlign: 'center',
    width: 70,
  },
  detalleIngreso: {
    fontSize: 13,
    color: COLORS.success,
    textAlign: 'right',
    width: 80,
  },
  syncBanner: {
    backgroundColor: COLORS.warning,
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  syncBannerText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  syncBannerAction: {
    color: COLORS.white,
    fontSize: 12,
    marginTop: 5,
    width: '100%',
    textAlign: 'center',
  },
  syncProgress: {
    backgroundColor: COLORS.info,
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  syncProgressText: {
    color: COLORS.white,
    fontSize: 12,
  },
  switchAlmacenBanner: {
    backgroundColor: 'rgba(108, 153, 204, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchAlmacenText: {
    color: COLORS.accent,
    fontSize: 13,
    flex: 1,
  },
  instructions: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  instructionText: {
    color: COLORS.lightGray,
    fontSize: 14,
    flex: 1,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 15,
  },
  operationButton: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
  },
  entryButton: {
    borderColor: COLORS.success,
  },
  exitButton: {
    borderColor: COLORS.error,
  },
  operationTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 10,
  },
  operationSubtitle: {
    color: COLORS.lightGray,
    fontSize: 12,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 4,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
});
