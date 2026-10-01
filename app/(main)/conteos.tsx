/**
 * Pantalla de Conteos Cíclicos (backlog P1) — listado.
 * Muestra los conteos del almacén (activos por defecto), permite abrir un
 * conteo nuevo (solo JEFE/ADMIN) y navegar al detalle para contar.
 * ONLINE-ONLY: sin conexión se muestra el error devuelto por el repositorio.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/src/presentation';
import { useConteoInventario } from '@/src/presentation/hooks/useConteoInventario';
import { useNetwork } from '@/src/presentation/hooks/useNetwork';
import { COLORS } from '@/src/shared/constants';
import { ROLES } from '@/src/domain';

const FILTROS = [
  { key: 'ABIERTO', label: 'Abiertos' },
  { key: 'CERRADO', label: 'Cerrados' },
  { key: '', label: 'Todos' },
] as const;

export default function ConteosScreen() {
  const router = useRouter();
  const { sesion, isAdministrador } = useAuth();
  const esJefe =
    sesion?.usuario?.roles?.some(r => r.nombre === ROLES.JEFE_DE_ALMACEN) ?? false;
  const puedeGestionar = esJefe || isAdministrador;
  const { isServerReachable } = useNetwork();
  const { conteos, isLoading, cargarConteos, crearConteo } = useConteoInventario();

  const [filtro, setFiltro] = useState<string>('ABIERTO');
  const [refrescando, setRefrescando] = useState(false);
  const [modalCrear, setModalCrear] = useState(false);
  const [esCiego, setEsCiego] = useState(false);

  const cargar = useCallback(
    async (estado?: string) => {
      await cargarConteos((estado || undefined) as any);
    },
    [cargarConteos]
  );

  useFocusEffect(
    useCallback(() => {
      cargar(filtro);
    }, [cargar, filtro])
  );

  const onRefresh = async () => {
    setRefrescando(true);
    await cargar(filtro);
    setRefrescando(false);
  };

  const abrirConteo = async () => {
    const almacenId = sesion?.almacenSeleccionado?.id;
    if (!almacenId) {
      Alert.alert('Conteo', 'No hay almacén seleccionado');
      return;
    }
    const resultado = await crearConteo(almacenId, esCiego);
    if (resultado.exito && resultado.conteoId) {
      setModalCrear(false);
      setEsCiego(false);
      router.push({ pathname: '/(main)/conteo-activo', params: { id: resultado.conteoId } });
    } else {
      Alert.alert('Conteo', resultado.mensaje);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        <Text style={styles.titulo}>Conteos Cíclicos</Text>
        <Text style={styles.subtitulo}>
          Verificación física del inventario contra el stock del sistema
        </Text>

        {!isServerReachable && (
          <View style={styles.bannerOffline}>
            <MaterialCommunityIcons name="access-point-off" size={18} color={COLORS.white} />
            <Text style={styles.bannerTexto}>
              El conteo requiere conexión con el servidor
            </Text>
          </View>
        )}

        {/* Filtros de estado */}
        <View style={styles.filtros}>
          {FILTROS.map(f => (
            <TouchableOpacity
              key={f.key || 'todos'}
              style={[styles.filtroChip, filtro === f.key && styles.filtroChipActivo]}
              onPress={() => setFiltro(f.key)}
            >
              <Text style={[styles.filtroTexto, filtro === f.key && styles.filtroTextoActivo]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && conteos.length === 0 ? (
          <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
        ) : conteos.length === 0 ? (
          <View style={styles.vacio}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={48} color={COLORS.gray} />
            <Text style={styles.vacioTexto}>No hay conteos en este estado</Text>
          </View>
        ) : (
          conteos.map(conteo => {
            const progreso =
              conteo.totalLineas > 0
                ? Math.round((conteo.totalContadas / conteo.totalLineas) * 100)
                : 0;
            return (
              <TouchableOpacity
                key={conteo.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() =>
                  router.push({ pathname: '/(main)/conteo-activo', params: { id: conteo.id } })
                }
              >
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="warehouse" size={18} color={COLORS.accent} />
                  <Text style={styles.cardAlmacen}>{conteo.almacenNombre}</Text>
                  <View
                    style={[
                      styles.estadoChip,
                      conteo.estado === 'ABIERTO' && styles.estadoAbierto,
                      conteo.estado === 'CERRADO' && styles.estadoCerrado,
                      conteo.estado === 'CANCELADO' && styles.estadoCancelado,
                    ]}
                  >
                    <Text style={styles.estadoTexto}>{conteo.estado}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>
                  {conteo.totalContadas}/{conteo.totalLineas} contadas · por {conteo.userName}
                  {conteo.esCiego ? ' · a ciegas' : ''}
                </Text>
                <View style={styles.barraFondo}>
                  <View style={[styles.barraProgreso, { width: `${progreso}%` }]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {puedeGestionar && (
          <TouchableOpacity style={styles.botonAbrir} onPress={() => setModalCrear(true)}>
            <MaterialCommunityIcons name="plus" size={22} color={COLORS.white} />
            <Text style={styles.botonAbrirTexto}>Abrir nuevo conteo</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal de creación */}
      <Modal visible={modalCrear} transparent animationType="fade" onRequestClose={() => setModalCrear(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Abrir conteo cíclico</Text>
            <Text style={styles.modalDescripcion}>
              Se congelará el stock esperado de todos los productos activos de{' '}
              <Text style={styles.modalAlmacen}>{sesion?.almacenSeleccionado?.nombre}</Text>. Solo
              puede haber un conteo abierto por almacén y el cierre exige contar todas las líneas.
            </Text>
            <View style={styles.switchFila}>
              <Switch
                value={esCiego}
                onValueChange={setEsCiego}
                trackColor={{ true: COLORS.accent, false: COLORS.lightGray }}
                thumbColor={COLORS.white}
              />
              <Text style={styles.switchTexto}>Conteo a ciegas (ocultar esperado)</Text>
            </View>
            <View style={styles.modalBotones}>
              <TouchableOpacity
                style={[styles.modalBoton, styles.modalBotonCancelar]}
                onPress={() => setModalCrear(false)}
              >
                <Text style={[styles.modalBotonTexto, { color: COLORS.gray }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBoton, styles.modalBotonOk]}
                onPress={abrirConteo}
                disabled={isLoading}
              >
                <Text style={styles.modalBotonTexto}>
                  {isLoading ? 'Abriendo…' : 'Abrir conteo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitulo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
    marginBottom: 14,
  },
  bannerOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerTexto: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  filtros: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filtroChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
  },
  filtroChipActivo: {
    backgroundColor: COLORS.accent,
  },
  filtroTexto: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  filtroTextoActivo: {
    color: COLORS.primary,
  },
  vacio: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  vacioTexto: {
    color: COLORS.gray,
    fontSize: 14,
  },
  card: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardAlmacen: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  estadoChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: COLORS.gray,
  },
  estadoAbierto: {
    backgroundColor: COLORS.accent,
  },
  estadoCerrado: {
    backgroundColor: COLORS.success,
  },
  estadoCancelado: {
    backgroundColor: COLORS.error,
  },
  estadoTexto: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 10,
  },
  barraFondo: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barraProgreso: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  botonAbrir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 15,
    paddingVertical: 14,
    marginTop: 8,
  },
  botonAbrirTexto: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  modalTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  modalDescripcion: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 19,
    marginBottom: 12,
  },
  modalAlmacen: {
    fontWeight: 'bold',
  },
  switchFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  switchTexto: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray,
  },
  modalBotones: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBoton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBotonCancelar: {
    backgroundColor: '#f3f4f6',
  },
  modalBotonOk: {
    backgroundColor: COLORS.primary,
  },
  modalBotonTexto: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
