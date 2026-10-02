/**
 * Pantalla Principal
 * Usa Clean Architecture con hooks de presentación
 * Incluye: cambio de almacén sin logout, auto-sync al recuperar conexión
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
import { LoteInventarioApiDto } from '@/src/data/dtos';

/** Ámbar para lotes próximos a vencer (backlog P3) */
const AMBAR_VENCIMIENTO = '#b45309';

export default function MainScreen() {
  const router = useRouter();
  const { sesion, logout, isAdministrador, hasMultipleAlmacenes, cambiarAlmacen } = useAuth();
  const { resumen, isLoading, refresh: refreshResumen } = useResumenAlmacen();
  const { sync, isSyncing, getPendingCount, progress, progressMessage } = useSync();
  const { isServerReachable, checkConnection } = useNetwork();

  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  /** Lotes vencidos o próximos a vencer (solo online — backlog P3) */
  const [lotesAlerta, setLotesAlerta] = useState<LoteInventarioApiDto[] | null>(null);

  /**
   * Lotes vencidos o por vencer en 30 días (GET /api/movimiento-inventario/
   * lotes?diasProximo=30). SOLO online: si la red falla se oculta la card
   * (null), nunca rompe el dashboard. checkConnection() fresco (no el estado
   * del hook) para evitar closures obsoletos al recuperar el foco.
   */
  const cargarLotesAlerta = async () => {
    try {
      if (!(await serviceContainer.network.checkConnection())) {
        setLotesAlerta(null);
        return;
      }
      const filas = await serviceContainer.remoteMovimiento.obtenerLotes(30);
      setLotesAlerta(
        filas.filter(f => f.estado === 'VENCIDO' || f.estado === 'PROXIMO')
      );
    } catch {
      setLotesAlerta(null);
    }
  };

  /**
   * Marca la bandera de "primera sincronización" solo si la base local
   * quedó poblada con etiquetas. Si el servidor falló, la bandera sigue false
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
        cargarLotesAlerta();
      },
    });
    await maybeMarkFirstSyncDone();
  };

  /**
   * Primera sincronización tras login online: pobla la base local
   * (etiquetas, productos, stock, categorías, almacenes) para uso sin conexión.
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
  // (al volver del escáner el movimiento ya está en el ledger local)
  useFocusEffect(
    React.useCallback(() => {
      loadPendingCount();
      refreshResumen();
      maybeFirstSync();
      cargarLotesAlerta();
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
    await cargarLotesAlerta();
    setRefreshing(false);
  };

  const handleOperationSelect = (operation: TipoOperacion) => {
    router.push({
      pathname: '/(main)/scanner',
      params: { operation },
    });
  };

  const goToHistorial = () => {
    router.push('/(main)/historial');
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

    // Mostrar selector de almacén como ActionSheet/Alert
    Alert.alert(
      'Cambiar Almacén',
      'Seleccione el almacén donde trabajará:',
      almacenes.map<AlertButton>(p => ({
        text: p.nombre,
        onPress: async () => {
          try {
            await cambiarAlmacen(p.id);
            refreshResumen();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo cambiar el almacén');
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
              <TouchableOpacity style={styles.headerButton} onPress={goToHistorial}>
                <MaterialCommunityIcons name="history" size={26} color={COLORS.white} />
              </TouchableOpacity>
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
        {/* Header con almacén seleccionado */}
        <View style={styles.header}>
          <Text style={styles.subtitle}>Sistema Automatizado de Control de Inventarios</Text>

          {/* Almacén seleccionado - clickeable si hay múltiples */}
          {sesion?.almacenSeleccionado && (
            <TouchableOpacity
              style={styles.almacenBadge}
              onPress={hasMultipleAlmacenes ? handleSwitchAlmacen : undefined}
              activeOpacity={hasMultipleAlmacenes ? 0.7 : 1}
            >
              <MaterialCommunityIcons name="warehouse" size={16} color={COLORS.white} />
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
            <Text style={styles.resumenTitle}>Resumen del Día</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="arrow-down-box" size={24} color={COLORS.success} />
                <Text style={styles.statValue}>{resumen.totalEntradas}</Text>
                <Text style={styles.statLabel}>Entradas Hoy (uds)</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="arrow-up-box" size={24} color={COLORS.error} />
                <Text style={styles.statValue}>{resumen.totalSalidas}</Text>
                <Text style={styles.statLabel}>Salidas Hoy (uds)</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="alert" size={24} color={COLORS.warning} />
                <Text style={styles.statValue}>{resumen.alertasBajoMinimo ?? 0}</Text>
                <Text style={styles.statLabel}>Bajo Mínimo</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="tune" size={24} color={COLORS.accent} />
                <Text style={styles.statValue}>{resumen.alertasReorden ?? 0}</Text>
                <Text style={styles.statLabel}>Punto Reorden</Text>
              </View>
            </View>

            {/* Requieren reposición (umbral efectivo por almacén — P2) */}
            {resumen.itemsReponer && resumen.itemsReponer.length > 0 && (
              <View style={styles.detalleContainer}>
                <Text style={styles.detalleTitle}>Requieren Reposición (punto de reorden)</Text>
                {resumen.itemsReponer.slice(0, 5).map((item, index) => (
                  <View key={index} style={styles.detalleRow}>
                    <Text
                      style={[
                        styles.detalleCategoria,
                        item.estado === 'BAJO_MINIMO' && { color: COLORS.error },
                      ]}
                      numberOfLines={1}
                    >
                      {item.productoCodigo} {item.productoNombre}
                    </Text>
                    <Text style={styles.detalleSalidas}>
                      {item.stock}/{item.puntoReorden} · +{item.sugerido}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Detalle por categoría */}
            {resumen.detalleCategorias && resumen.detalleCategorias.length > 0 && (
              <View style={styles.detalleContainer}>
                <Text style={styles.detalleTitle}>Detalle por Categoría (uds)</Text>
                {resumen.detalleCategorias.map((detalle, index) => (
                  <View key={index} style={styles.detalleRow}>
                    <Text style={styles.detalleCategoria}>{detalle.categoria}</Text>
                    <Text style={styles.detalleEntradas}>+{detalle.entradas}</Text>
                    <Text style={styles.detalleSalidas}>-{detalle.salidas}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Próximos a vencer (solo online — backlog P3): vencidos en rojo,
            próximos en ámbar. Sin conexión la card no se muestra. */}
        {lotesAlerta && lotesAlerta.length > 0 && (
          <View style={styles.lotesCard}>
            <View style={styles.lotesHeader}>
              <MaterialCommunityIcons name="calendar-alert" size={18} color={AMBAR_VENCIMIENTO} />
              <Text style={styles.lotesTitulo}>Próximos a vencer</Text>
              <Text style={styles.lotesContador}>{lotesAlerta.length}</Text>
            </View>
            {lotesAlerta.slice(0, 3).map((lote, index) => {
              const vencido = lote.estado === 'VENCIDO';
              const color = vencido ? COLORS.error : AMBAR_VENCIMIENTO;
              return (
                <View key={`${lote.productoId}-${lote.lote || index}`} style={styles.loteRow}>
                  <View style={styles.loteInfo}>
                    <Text style={styles.loteProducto} numberOfLines={1}>
                      {lote.productoCodigo} · {lote.productoNombre}
                    </Text>
                    <Text style={[styles.loteMeta, { color }]}>
                      {lote.lote ? `Lote: ${lote.lote}` : 'Sin lote'}
                      {` · stock ${lote.stock}`}
                    </Text>
                  </View>
                  <Text style={[styles.loteDias, { color }]}>
                    {vencido
                      ? `Vencido${typeof lote.diasParaVencer === 'number' ? ` hace ${Math.abs(lote.diasParaVencer)} d` : ''}`
                      : typeof lote.diasParaVencer === 'number'
                        ? `${lote.diasParaVencer} días`
                        : 'Próximo'}
                  </Text>
                </View>
              );
            })}
            {lotesAlerta.length > 3 && (
              <Text style={styles.loteMas}>+{lotesAlerta.length - 3} más</Text>
            )}
          </View>
        )}

        {/* Pendientes de sincronización */}
        {pendingCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleSync} disabled={isSyncing}>
            <MaterialCommunityIcons name="alert" size={20} color={COLORS.white} />
            <Text style={styles.syncBannerText}>
              {pendingCount} movimientos pendientes de sincronizar
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

        {/* Cambio de almacén - info para usuarios con múltiples */}
        {hasMultipleAlmacenes && (
          <TouchableOpacity style={styles.switchAlmacenBanner} onPress={handleSwitchAlmacen}>
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={COLORS.accent} />
            <Text style={styles.switchAlmacenText}>Toca el almacén o aquí para cambiar de almacén</Text>
          </TouchableOpacity>
        )}

        {/* Instrucciones */}
        <View style={styles.instructions}>
          <MaterialCommunityIcons name="information" size={20} color={COLORS.accent} />
          <Text style={styles.instructionText}>
            Seleccione la operación y escanee el código QR de la etiqueta del producto
            (o ingrese el SKU PRD-XXXXXX)
          </Text>
        </View>

        {/* Botones de operación */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.operationButton, styles.entryButton]}
            onPress={() => handleOperationSelect('entrada')}
          >
            <MaterialCommunityIcons name="package-variant" size={40} color={COLORS.success} />
            <Text style={styles.operationTitle}>ENTRADA</Text>
            <Text style={styles.operationSubtitle}>Registrar entrada de producto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.operationButton, styles.exitButton]}
            onPress={() => handleOperationSelect('salida')}
          >
            <MaterialCommunityIcons name="package-variant-closed" size={40} color={COLORS.error} />
            <Text style={styles.operationTitle}>SALIDA</Text>
            <Text style={styles.operationSubtitle}>Registrar salida de producto</Text>
          </TouchableOpacity>
        </View>

        {/* Acceso al conteo cíclico (backlog P1) */}
        <TouchableOpacity
          style={styles.conteosButton}
          onPress={() => router.push('/(main)/conteos')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="clipboard-check" size={26} color={COLORS.white} />
          <View style={styles.conteosTextos}>
            <Text style={styles.conteosTitulo}>CONTEOS CÍCLICOS</Text>
            <Text style={styles.conteosSubtitulo}>Verificar el inventario físico (requiere conexión)</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.accent} />
        </TouchableOpacity>
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
  detalleCategoria: {
    fontSize: 13,
    color: COLORS.white,
    flex: 1,
  },
  detalleEntradas: {
    fontSize: 13,
    color: COLORS.success,
    textAlign: 'center',
    width: 70,
  },
  detalleSalidas: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'right',
    width: 70,
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
  lotesCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(180, 83, 9, 0.45)',
  },
  lotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lotesTitulo: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
  },
  lotesContador: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: AMBAR_VENCIMIENTO,
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textAlign: 'center',
    overflow: 'hidden',
  },
  loteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  loteInfo: {
    flex: 1,
  },
  loteProducto: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  loteMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  loteDias: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  loteMas: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
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
    backgroundColor: 'rgba(20, 184, 166, 0.2)',
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
  conteosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 16,
    marginTop: 14,
  },
  conteosTextos: {
    flex: 1,
  },
  conteosTitulo: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  conteosSubtitulo: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
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
