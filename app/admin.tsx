/**
 * Pantalla de Administración
 * Panel exclusivo para usuarios con rol ADMINISTRADOR
 * Permite: configurar URL del API, limpiar caché, ver estadísticas, forzar sincronización
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { useAuth } from '@/src/presentation';
import { useSync } from '@/src/presentation';
import { useNetwork } from '@/src/presentation';
import { COLORS } from '@/src/shared/constants';

interface CacheStat {
  key: string;
  label: string;
  count: number;
  icon: string;
}

export default function AdminScreen() {
  const router = useRouter();
  const { sesion, logout, isAdministrador, seleccionarAlmacen } = useAuth();
  const { sync, isSyncing, progress, progressMessage } = useSync();
  const { isServerReachable, checkConnection } = useNetwork();

  // API URL
  const [apiUrl, setApiUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Cache stats
  const [cacheStats, setCacheStats] = useState<CacheStat[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // App info
  const [lastSync, setLastSync] = useState<string>('Nunca');

  // Si no es administrador, redirigir
  useEffect(() => {
    if (!isAdministrador) {
      router.replace('/(main)');
    }
  }, [isAdministrador]);

  // Cargar datos iniciales
  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    // Cargar URL
    const savedUrl = serviceContainer.getApiUrl();
    if (savedUrl) {
      setApiUrl(savedUrl);
    }

    // Cargar stats
    await loadCacheStats();

    // Cargar última sincronización
    const ultSync = await serviceContainer.getUltimaSincronizacion();
    setLastSync(ultSync ? formatDate(ultSync) : 'Nunca');
  };

  const loadCacheStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await serviceContainer.getCacheStats();
      const statList: CacheStat[] = [
        { key: 'movimientos_cache', label: 'Movimientos (caché)', count: stats.movimientos_cache || 0, icon: 'swap-vertical' },
        { key: 'movimientos_pendientes', label: 'Pendientes de sincronizar', count: stats.movimientos_pendientes || 0, icon: 'cloud-upload' },
        { key: 'qrs_cache', label: 'Etiquetas QR', count: stats.qrs_cache || 0, icon: 'qrcode' },
        { key: 'productos_cache', label: 'Productos', count: stats.productos_cache || 0, icon: 'package-variant' },
        { key: 'stock_cache', label: 'Stock', count: stats.stock_cache || 0, icon: 'clipboard-list' },
        { key: 'categorias_cache', label: 'Categorías', count: stats.categorias_cache || 0, icon: 'tag-multiple' },
        { key: 'almacenes_cache', label: 'Almacenes', count: stats.almacenes_cache || 0, icon: 'warehouse' },
        { key: 'usuarios_offline', label: 'Usuarios Offline', count: stats.usuarios_offline || 0, icon: 'account-lock' },
      ];
      setCacheStats(statList);
    } catch (error) {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    setRefreshing(false);
  };

  // ==================== API URL ====================

  const handleSaveApiUrl = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL válida');
      return;
    }

    setIsSavingUrl(true);
    try {
      await serviceContainer.setApiUrl(apiUrl.trim());
      Alert.alert('Éxito', 'URL del API guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la URL');
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL para probar');
      return;
    }

    setIsTestingConnection(true);
    try {
      serviceContainer.network.setBaseUrl(apiUrl.trim());
      const isConnected = await checkConnection();
      Alert.alert(
        isConnected ? 'Conexión exitosa' : 'Error de conexión',
        isConnected
          ? 'Se pudo conectar al servidor correctamente.'
          : 'No se pudo conectar al servidor. Verifique la URL y que el servidor esté activo.'
      );
    } catch (error) {
      Alert.alert('Error', 'Error al probar la conexión');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // ==================== CACHE MANAGEMENT ====================

  const handleClearCache = (key: string, label: string) => {
    Alert.alert(
      'Confirmar limpieza',
      `¿Está seguro de eliminar todos los registros de "${label}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await serviceContainer.limpiarTablaCache(key);
              Alert.alert('Éxito', `"${label}" limpiado correctamente`);
              await loadCacheStats();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo limpiar');
            }
          },
        },
      ]
    );
  };

  const handleClearAllCache = () => {
    Alert.alert(
      '⚠️ Confirmar limpieza total',
      '¿Está seguro de eliminar TODOS los datos de caché? Los datos de sesión y configuración (URL del API) se mantendrán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await serviceContainer.limpiarTodoCache();
              Alert.alert('Éxito', 'Todo el caché fue limpiado correctamente');
              await loadCacheStats();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo limpiar el caché');
            }
          },
        },
      ]
    );
  };

  const handleResetApp = () => {
    Alert.alert(
      '🚨 Resetear Aplicación',
      'Esta acción eliminará TODOS los datos locales incluyendo la sesión actual. Solo se mantendrá la URL del API configurada.\n\nDeberá iniciar sesión nuevamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetear todo',
          style: 'destructive',
          onPress: async () => {
            try {
              await serviceContainer.resetearAplicacion();
              await logout();
              router.replace('/login');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo resetear');
            }
          },
        },
      ]
    );
  };

  // ==================== SYNC ====================

  const handleForceSync = async () => {
    await sync({
      onComplete: async () => {
        await loadCacheStats();
        const ultSync = await serviceContainer.getUltimaSincronizacion();
        setLastSync(ultSync ? formatDate(ultSync) : 'Nunca');
      },
    });
  };

  // ==================== NAVIGATE TO MAIN ====================

  const handleGoToMain = async () => {
    // Si el admin tiene almacenes asignados y no tiene uno seleccionado, seleccionar el primero
    if (sesion?.usuario?.almacenesAsignados?.length) {
      if (!sesion.almacenSeleccionado) {
        const almacenes = sesion.usuario.almacenesAsignados;
        if (almacenes.length > 0) {
          try {
            await seleccionarAlmacen(almacenes[0].id);
          } catch (error) {
            // ignore
          }
        }
      }
      router.replace('/(main)');
    } else {
      Alert.alert('Sin almacenes', 'No tiene almacenes asignados. Contacte al administrador del sistema.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="shield-crown" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.headerTitle}>Panel de Administración</Text>
          <Text style={styles.headerSubtitle}>
            {sesion?.usuario?.nombre || 'Admin'}
          </Text>
        </View>

        {/* ============ SECCIÓN: CONEXIÓN ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="connection" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Conexión al Servidor</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>URL del API</Text>
              <TextInput
                style={styles.input}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://tu-api-url.com"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveApiUrl}
                disabled={isSavingUrl}
              >
                {isSavingUrl ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <MaterialCommunityIcons name="content-save" size={18} color={COLORS.white} />
                    <Text style={styles.buttonText}>Guardar</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.testButton]}
                onPress={handleTestConnection}
                disabled={isTestingConnection}
              >
                {isTestingConnection ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <View style={styles.buttonContent}>
                    <MaterialCommunityIcons name="access-point" size={18} color={COLORS.white} />
                    <Text style={styles.buttonText}>Probar</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, isServerReachable ? styles.dotOnline : styles.dotOffline]} />
              <Text style={[styles.statusText, isServerReachable ? styles.textOnline : styles.textOffline]}>
                {isServerReachable ? 'Servidor conectado' : 'Sin conexión al servidor'}
              </Text>
            </View>
          </View>
        </View>

        {/* ============ SECCIÓN: SINCRONIZACIÓN ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="sync" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Sincronización</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.lightGray} />
              <Text style={styles.infoLabel}>Última sincronización:</Text>
              <Text style={styles.infoValue}>{lastSync}</Text>
            </View>

            {isSyncing && (
              <View style={styles.syncProgress}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.syncProgressText}>{progress}% - {progressMessage}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.syncButton]}
              onPress={handleForceSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <View style={styles.buttonContent}>
                  <MaterialCommunityIcons name="cloud-sync" size={20} color={COLORS.white} />
                  <Text style={styles.buttonText}>Forzar Sincronización</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ============ SECCIÓN: DATOS DE CACHÉ ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="database" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Datos Locales (Caché)</Text>
          </View>

          {isLoadingStats ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.accent} />
              <Text style={styles.loadingText}>Cargando estadísticas...</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {cacheStats.map((stat) => (
                <View key={stat.key} style={styles.cacheRow}>
                  <View style={styles.cacheRowLeft}>
                    <MaterialCommunityIcons name={stat.icon as any} size={20} color={COLORS.accent} />
                    <Text style={styles.cacheLabel}>{stat.label}</Text>
                  </View>
                  <View style={styles.cacheRowRight}>
                    <View style={[styles.cacheCountBadge, stat.count > 0 ? styles.countActive : styles.countEmpty]}>
                      <Text style={[styles.cacheCountText, stat.count > 0 ? styles.countTextActive : styles.countTextEmpty]}>
                        {stat.count}
                      </Text>
                    </View>
                    {stat.count > 0 && (
                      <TouchableOpacity
                        style={styles.clearTableButton}
                        onPress={() => handleClearCache(stat.key, stat.label)}
                      >
                        <MaterialCommunityIcons name="delete-outline" size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.button, styles.clearAllButton]}
                onPress={handleClearAllCache}
              >
                <View style={styles.buttonContent}>
                  <MaterialCommunityIcons name="delete-sweep" size={20} color={COLORS.white} />
                  <Text style={styles.buttonText}>Limpiar Todo el Caché</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ============ SECCIÓN: ACCIONES ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="wrench" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Acciones</Text>
          </View>

          <View style={styles.card}>
            {/* Ir al Dashboard */}
            <TouchableOpacity style={styles.actionRow} onPress={handleGoToMain}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.success }]}>
                <MaterialCommunityIcons name="view-dashboard" size={22} color={COLORS.white} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Ir al Dashboard</Text>
                <Text style={styles.actionSubtitle}>Operaciones de entrada/salida de vehículos</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
            </TouchableOpacity>

            <View style={styles.actionDivider} />

            {/* Resetear App */}
            <TouchableOpacity style={styles.actionRow} onPress={handleResetApp}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.error }]}>
                <MaterialCommunityIcons name="alert-octagon" size={22} color={COLORS.white} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Resetear Aplicación</Text>
                <Text style={styles.actionSubtitle}>Borra todos los datos locales y cierra sesión</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============ SECCIÓN: INFO ============ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information" size={20} color={COLORS.accent} />
            <Text style={styles.sectionTitle}>Información</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="application" size={18} color={COLORS.lightGray} />
              <Text style={styles.infoLabel}>Versión:</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-cog" size={18} color={COLORS.lightGray} />
              <Text style={styles.infoLabel}>Rol:</Text>
              <Text style={styles.infoValue}>
                {sesion?.usuario?.roles?.map(r => r.nombre).join(', ') || 'Sin rol'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="parking" size={18} color={COLORS.lightGray} />
              <Text style={styles.infoLabel}>Almacenes asignados:</Text>
              <Text style={styles.infoValue}>
                {sesion?.usuario?.almacenesAsignados?.length || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Botón de cerrar sesión */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
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
          }}
        >
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.white} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.lightGray,
    marginTop: 4,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.lightGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 16,
  },

  // Inputs
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: COLORS.lightGray,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.success,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#14B8A6',
  },
  syncButton: {
    backgroundColor: COLORS.accent,
    marginTop: 8,
  },
  clearAllButton: {
    backgroundColor: COLORS.warning,
    marginTop: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: COLORS.success,
  },
  dotOffline: {
    backgroundColor: COLORS.error,
  },
  statusText: {
    fontSize: 13,
  },
  textOnline: {
    color: COLORS.success,
  },
  textOffline: {
    color: COLORS.error,
  },

  // Sync
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.lightGray,
  },
  infoValue: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '500',
    flex: 1,
  },
  syncProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(108, 153, 204, 0.2)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  syncProgressText: {
    color: COLORS.accent,
    fontSize: 12,
  },

  // Cache
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cacheRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cacheRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cacheLabel: {
    fontSize: 14,
    color: COLORS.white,
  },
  cacheCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  countActive: {
    backgroundColor: COLORS.accent,
  },
  countEmpty: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cacheCountText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  countTextActive: {
    color: COLORS.white,
  },
  countTextEmpty: {
    color: COLORS.gray,
  },
  clearTableButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
  },
  actionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: COLORS.lightGray,
    fontSize: 13,
  },

  // Logout
  logoutButton: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
