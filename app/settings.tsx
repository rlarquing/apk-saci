/**
 * Pantalla de Configuración
 * Usa Clean Architecture
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { useSync, useNetwork } from '@/src/presentation';
import { COLORS } from '@/src/shared/constants';

export default function SettingsScreen() {
  const router = useRouter();
  const [apiUrl, setApiUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const { sync, isSyncing, progress, progressMessage, getPendingCount, getLastSyncDate } = useSync();
  const { isServerReachable, checkConnection } = useNetwork();

  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);

  useEffect(() => {
    loadSavedUrl();
    loadSyncStatus();
  }, []);

  /**
   * Carga el estado de sincronización: pendientes, última fecha y si la
   * sesión activa es offline (en cuyo caso no se puede sincronizar).
   */
  const loadSyncStatus = async () => {
    try {
      const [count, fecha, sesion] = await Promise.all([
        getPendingCount(),
        getLastSyncDate(),
        serviceContainer.auth.obtenerSesionLocal(),
      ]);
      setPendingCount(count);
      setLastSync(fecha);
      setIsOfflineSession(!sesion || sesion.token === 'offline-token');
    } catch (error) {
      // ignore
    }
  };

  const formatLastSync = (fecha: Date | null): string => {
    if (!fecha) return 'Nunca';
    return new Date(fecha).toLocaleString();
  };

  /**
   * Sincronización manual bajo demanda.
   *
   * Se bloquea con sesión offline: sincronizar con 'offline-token' provoca
   * un 401, el refresh falla y el usuario queda expulsado de la app en
   * plena operación.
   */
  const handleSync = async () => {
    if (isOfflineSession) {
      Alert.alert(
        'Sincronización no disponible',
        'La sesión actual es offline. Vuelva a iniciar sesión con conexión al servidor para poder sincronizar.'
      );
      return;
    }

    const hayConexion = await checkConnection();
    if (!hayConexion) {
      Alert.alert(
        'Sin conexión',
        'No se pudo contactar al servidor. Verifique la URL configurada y su conexión a la red.'
      );
      return;
    }

    const resultado = await sync();
    await loadSyncStatus();

    if (resultado.exito) {
      const datos = resultado.datosActualizados;
      const detalle = [
        `Movimientos enviados: ${resultado.movimientosSincronizados}`,
        resultado.movimientosConError > 0
          ? `Movimientos con error: ${resultado.movimientosConError}`
          : null,
        `Etiquetas QR: ${datos.qrs ?? 0}`,
        `Productos: ${datos.productos}`,
        `Categorías: ${datos.categorias}`,
        `Stock: ${datos.stock ?? 0}`,
        `Almacenes: ${datos.almacenes ?? 0}`,
      ]
        .filter(Boolean)
        .join('\n');

      Alert.alert('Sincronización completada', detalle);
    } else if (resultado.errores[0]?.operacion === 'concurrencia') {
      // El auto-sync en segundo plano ya estaba corriendo
      Alert.alert(
        'Sincronización en curso',
        'Ya hay una sincronización ejecutándose. Espere a que termine.'
      );
    } else {
      Alert.alert(
        'Error de sincronización',
        resultado.errores[0]?.error || 'No se pudo completar la sincronización'
      );
    }
  };

  const loadSavedUrl = async () => {
    try {
      const savedUrl = serviceContainer.getApiUrl();
      if (savedUrl) {
        setApiUrl(savedUrl);
      }
    } catch (error) {
      // ignore
    }
  };

  const handleSave = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL válida');
      return;
    }

    setIsLoading(true);
    try {
      await serviceContainer.setApiUrl(apiUrl.trim());
      Alert.alert('Éxito', 'URL de API guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL para probar');
      return;
    }

    setIsTesting(true);
    try {
      // Temporalmente establecer la URL para probar
      serviceContainer.network.setBaseUrl(apiUrl.trim());
      const isConnected = await serviceContainer.network.checkConnection();
      if (isConnected) {
        Alert.alert('Éxito', 'Conexión exitosa con la API');
      } else {
        Alert.alert('Error', 'No se pudo conectar con la API');
      }
    } catch (error) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Confirmar',
      '¿Estás seguro de restablecer la configuración por defecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            setApiUrl('');
            Alert.alert('Éxito', 'Configuración restablecida');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <MaterialCommunityIcons name="cog" size={28} color={COLORS.white} />
        </View>
        <Text style={styles.headerTitle}>Configuración</Text>
      </View>

      {/* URL de la API */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <MaterialCommunityIcons name="link-variant" size={18} color={COLORS.white} />
          <Text style={styles.label}>URL de la API</Text>
        </View>
        <Text style={styles.hint}>
          Ingresa la URL base de tu servidor de almacen
        </Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://tu-api-url.com/api"
          placeholderTextColor={COLORS.gray}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      {/* Botones de acción */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="content-save" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Guardar URL</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={handleTestConnection}
          disabled={isTesting}
        >
          {isTesting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="connection" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Probar Conexión</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={handleReset}
        >
          <View style={styles.buttonContent}>
            <MaterialCommunityIcons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.buttonText}>Restablecer</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Sincronización manual */}
      <View style={styles.syncCard}>
        <View style={styles.labelRow}>
          <MaterialCommunityIcons name="sync" size={18} color={COLORS.white} />
          <Text style={styles.label}>Sincronización</Text>
        </View>
        <Text style={styles.hint}>
          Envía las operaciones pendientes y descarga los datos actualizados del servidor
        </Text>

        <View style={styles.syncStatusRow}>
          <Text style={styles.syncStatusLabel}>Última sincronización</Text>
          <Text style={styles.syncStatusValue}>{formatLastSync(lastSync)}</Text>
        </View>

        <View style={styles.syncStatusRow}>
          <Text style={styles.syncStatusLabel}>Pendientes por enviar</Text>
          <Text
            style={[
              styles.syncStatusValue,
              pendingCount > 0 && styles.syncStatusValueAlert,
            ]}
          >
            {pendingCount}
          </Text>
        </View>

        <View style={styles.syncStatusRow}>
          <Text style={styles.syncStatusLabel}>Servidor</Text>
          <View style={styles.syncStatusRight}>
            <View
              style={[
                styles.syncDot,
                { backgroundColor: isServerReachable ? COLORS.success : COLORS.error },
              ]}
            />
            <Text style={styles.syncStatusValue}>
              {isServerReachable ? 'Conectado' : 'Sin conexión'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.syncButton,
            (isSyncing || !isServerReachable || isOfflineSession) && styles.buttonDisabled,
          ]}
          onPress={handleSync}
          disabled={isSyncing || !isServerReachable || isOfflineSession}
        >
          {isSyncing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="cloud-sync" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Sincronizar ahora</Text>
            </View>
          )}
        </TouchableOpacity>

        {isSyncing && (
          <View style={styles.syncProgressContainer}>
            <View style={styles.syncProgressTrack}>
              <View style={[styles.syncProgressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.syncProgressText}>
              {progress}% — {progressMessage}
            </Text>
          </View>
        )}

        {/* Motivo cuando el botón está bloqueado */}
        {!isSyncing && isOfflineSession && (
          <Text style={styles.syncDisabledHint}>
            Sesión offline: inicie sesión con conexión al servidor para sincronizar.
          </Text>
        )}
        {!isSyncing && !isOfflineSession && !isServerReachable && (
          <Text style={styles.syncDisabledHint}>
            Sin conexión con el servidor. Verifique la URL y su red.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F766E',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
    gap: 12,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  section: {
    marginBottom: 30,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  hint: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  buttonsContainer: {
    gap: 15,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: COLORS.success,
  },
  testButton: {
    backgroundColor: '#14B8A6',
  },
  resetButton: {
    backgroundColor: COLORS.error,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  syncCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 15,
    marginTop: 30,
  },
  syncButton: {
    backgroundColor: COLORS.accent,
    marginTop: 15,
  },
  syncStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  syncStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncStatusLabel: {
    fontSize: 13,
    color: COLORS.lightGray,
  },
  syncStatusValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  syncStatusValueAlert: {
    color: COLORS.warning,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncProgressContainer: {
    marginTop: 12,
    gap: 6,
  },
  syncProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  syncProgressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  syncProgressText: {
    fontSize: 12,
    color: COLORS.lightGray,
  },
  syncDisabledHint: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.warning,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.lightGray,
  },
});
