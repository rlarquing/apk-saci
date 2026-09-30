/**
 * Pantalla de Selección de Almacen
 * Usa Clean Architecture
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/presentation';
import { COLORS } from '@/src/shared/constants';
import { AlmacenAsignado } from '@/src/domain';

export default function SelectAlmacenScreen() {
  const router = useRouter();
  const { sesion, seleccionarAlmacen, logout } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [almacenes, setAlmacenes] = useState<AlmacenAsignado[]>([]);

  useEffect(() => {
    loadAlmacenes();
  }, []);

  const loadAlmacenes = () => {
    if (sesion?.usuario?.almacenesAsignados) {
      setAlmacenes(sesion.usuario.almacenesAsignados);
    } else {
      Alert.alert('Error', 'No hay almacenes disponibles');
    }
  };

  const handleSelectAlmacen = async (almacen: AlmacenAsignado) => {
    setIsLoading(true);
    try {
      await seleccionarAlmacen(almacen.id);
      router.replace('/(main)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo seleccionar el almacen');
    } finally {
      setIsLoading(false);
    }
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

  const renderAlmacen = ({ item }: { item: AlmacenAsignado }) => (
    <TouchableOpacity
      style={styles.almacenCard}
      onPress={() => handleSelectAlmacen(item)}
      disabled={isLoading}
    >
      <View style={styles.almacenIcon}>
        <MaterialCommunityIcons name="parking" size={28} color={COLORS.white} />
      </View>
      <View style={styles.almacenInfo}>
        <Text style={styles.almacenName}>{item.nombre}</Text>
        {item.descripcion && (
          <Text style={styles.almacenDescripcion}>{item.descripcion}</Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={28} color={COLORS.accent} />
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Configurando almacen...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Seleccionar Almacen</Text>
        <Text style={styles.subtitle}>
          Hola, {sesion?.usuario?.nombre || 'Usuario'}
        </Text>
        <Text style={styles.instructions}>
          Seleccione el almacen donde trabajará hoy
        </Text>
      </View>

      {/* Lista de almacenes */}
      <FlatList
        data={almacenes}
        keyExtractor={(item) => item.id}
        renderItem={renderAlmacen}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="parking" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>No hay almacenes asignados</Text>
          </View>
        }
      />

      {/* Botón de cerrar sesión */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color={COLORS.white} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  loadingText: {
    color: COLORS.white,
    marginTop: 15,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.lightGray,
    marginBottom: 10,
  },
  instructions: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  almacenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  almacenIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  almacenInfo: {
    flex: 1,
  },
  almacenName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 5,
  },
  almacenDescripcion: {
    fontSize: 14,
    color: COLORS.gray,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 16,
  },
  footer: {
    padding: 20,
    paddingBottom: 30,
  },
  logoutButton: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
