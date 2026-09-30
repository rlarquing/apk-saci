/**
 * Pantalla de Perfil del Usuario
 * Muestra información del usuario y permite cambiar contraseña y almacen
 * Cambio de contraseña es online-only
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  AlertButton,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/presentation';
import { useNetwork } from '@/src/presentation';
import { COLORS } from '@/src/shared/constants';

export default function ProfileScreen() {
  const router = useRouter();
  const { sesion, isAdministrador, hasMultipleAlmacenes, cambiarAlmacen } = useAuth();
  const { isServerReachable } = useNetwork();

  const handleChangePassword = () => {
    if (!isServerReachable) {
      Alert.alert(
        'Sin conexión',
        'Para cambiar su contraseña necesita estar conectado al servidor.'
      );
      return;
    }
    router.push('/(main)/change-password');
  };

  const handleSwitchAlmacen = () => {
    if (!sesion?.usuario?.almacenesAsignados) return;
    
    const almacenes = sesion.usuario.almacenesAsignados;
    if (almacenes.length <= 1) return;

    Alert.alert(
      'Cambiar Almacen',
      'Seleccione el almacen donde trabajará:',
      almacenes.map<AlertButton>(p => ({
        text: p.nombre,
        onPress: async () => {
          try {
            await cambiarAlmacen(p.id);
            Alert.alert('Almacen cambiado', `Ahora trabajando en: ${p.nombre}`);
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

  const usuario = sesion?.usuario;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header con avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={80} color={COLORS.accent} />
        </View>
        <Text style={styles.userName}>{usuario?.nombre || 'Usuario'}</Text>
        <Text style={styles.userEmail}>{usuario?.email || ''}</Text>
      </View>

      {/* Información del usuario */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account" size={20} color={COLORS.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Usuario</Text>
              <Text style={styles.infoValue}>{usuario?.nombre || '-'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="email" size={20} color={COLORS.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Correo</Text>
              <Text style={styles.infoValue}>{usuario?.email || '-'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="shield-account" size={20} color={COLORS.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Rol</Text>
              <Text style={styles.infoValue}>
                {usuario?.roles?.map(r => r.nombre).join(', ') || 'Sin rol asignado'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="parking" size={20} color={COLORS.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Almacen Actual</Text>
              <Text style={styles.infoValue}>
                {sesion?.almacenSeleccionado?.nombre || 'No seleccionado'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Acciones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cuenta</Text>

        {/* Cambiar Almacen - solo si tiene múltiples */}
        {hasMultipleAlmacenes && (
          <TouchableOpacity style={styles.actionCard} onPress={handleSwitchAlmacen}>
            <View style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: '#4CAF50' }]}>
                <MaterialCommunityIcons name="swap-horizontal" size={22} color={COLORS.white} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Cambiar Almacen</Text>
                <Text style={styles.actionSubtitle}>
                  {sesion?.usuario?.almacenesAsignados?.length || 0} almacenes asignados
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard} onPress={handleChangePassword}>
          <View style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: COLORS.warning }]}>
              <MaterialCommunityIcons name="lock-reset" size={22} color={COLORS.white} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Cambiar Contraseña</Text>
              <Text style={styles.actionSubtitle}>
                {isServerReachable ? 'Requiere conexión al servidor' : 'Sin conexión al servidor'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
          </View>
        </TouchableOpacity>

        {isAdministrador && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: '#8B5CF6' }]}>
                <MaterialCommunityIcons name="shield-crown" size={22} color={COLORS.white} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Panel de Administración</Text>
                <Text style={styles.actionSubtitle}>Gestionar caché, URL del API y sincronización</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
            </View>
          </TouchableOpacity>
        )}

        {isAdministrador && (
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/settings')}
          >
            <View style={styles.actionRow}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.secondary }]}>
                <MaterialCommunityIcons name="cog" size={22} color={COLORS.white} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Configuración</Text>
                <Text style={styles.actionSubtitle}>URL del servidor y ajustes</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.gray} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Estado de conexión */}
      <View style={styles.connectionSection}>
        <View style={[styles.connectionBadge, isServerReachable ? styles.connected : styles.disconnected]}>
          <MaterialCommunityIcons
            name={isServerReachable ? 'access-point' : 'access-point-off'}
            size={16}
            color={COLORS.white}
          />
          <Text style={styles.connectionText}>
            {isServerReachable ? 'Conectado al servidor' : 'Sin conexión al servidor'}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.lightGray,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.lightGray,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 32,
  },
  actionCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  connectionSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    gap: 8,
  },
  connected: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  disconnected: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
  connectionText: {
    color: COLORS.lightGray,
    fontSize: 13,
  },
});
