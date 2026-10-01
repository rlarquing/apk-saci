/**
 * Pantalla de ejecución de un conteo cíclico (backlog P1) — detalle.
 * Flujo: buscar por SKU o escanear la etiqueta QR → identificar producto →
 * registrar la cantidad física contada. El cierre (JEFE/ADMIN) compara contra
 * el stock real del API y genera ajustes auditables.
 * ONLINE-ONLY: sin conexión se bloquea la operación con aviso claro.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QRScanner } from '@/components/QRScanner';
import { ConteoCantidadModal } from '@/components/ConteoCantidadModal';
import { useAuth } from '@/src/presentation';
import { useConteoInventario } from '@/src/presentation/hooks/useConteoInventario';
import { useNetwork } from '@/src/presentation/hooks/useNetwork';
import { COLORS } from '@/src/shared/constants';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { ROLES } from '@/src/domain';
import { ConteoLinea } from '@/src/domain/entities/Conteo';

/** Prefijo del SKU autogenerado por el API para productos */
const PREFIJO_SKU = /^PRD-[0-9A-Za-z]+$/i;

export default function ConteoActivoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const conteoId = params.id;
  const { sesion, isAdministrador } = useAuth();
  const esJefe =
    sesion?.usuario?.roles?.some(r => r.nombre === ROLES.JEFE_DE_ALMACEN) ?? false;
  const puedeGestionar = esJefe || isAdministrador;
  const { isServerReachable } = useNetwork();
  const { conteo, isLoading, mensaje, cargarConteo, registrarCantidad, cerrarConteo, cancelarConteo } =
    useConteoInventario();

  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [lineaModal, setLineaModal] = useState<ConteoLinea | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (conteoId) cargarConteo(conteoId);
    }, [conteoId, cargarConteo])
  );

  useEffect(() => {
    if (mensaje) {
      // Mensajes de las operaciones (éxito o error) como alerta nativa
      if (mensaje.tipo === 'error') {
        Alert.alert('Conteo', mensaje.texto);
      }
      setAviso(mensaje.tipo === 'success' ? mensaje.texto : null);
    }
  }, [mensaje]);

  /** Muestra el modal de cantidad para una línea del conteo. */
  const contarLinea = (linea: ConteoLinea) => {
    if (conteo?.estado !== 'ABIERTO') {
      Alert.alert('Conteo', 'El conteo ya no está abierto');
      return;
    }
    setEscaneando(false);
    setAviso(null);
    setLineaModal(linea);
  };

  /** Resuelve el código escaneado (etiqueta QR o SKU) contra catálogo/API. */
  const resolverEscaneo = async (codigo: string) => {
    setAviso(null);
    try {
      let productoId: string | null = null;
      if (PREFIJO_SKU.test(codigo)) {
        const producto = await serviceContainer.localProducto.buscarPorCodigo(codigo);
        productoId = producto?.id ?? null;
      } else {
        const almacenId = sesion?.almacenSeleccionado?.id;
        if (almacenId) {
          const resultadoQR = await serviceContainer.qr.validarQR(codigo, almacenId);
          productoId = resultadoQR.valido ? resultadoQR.qr?.productoId ?? null : null;
        }
      }

      if (!productoId) {
        Alert.alert('Conteo', 'No se pudo identificar el producto escaneado');
        return;
      }

      const linea = conteo?.lineas.find(l => l.productoId === productoId);
      if (!linea) {
        Alert.alert('Conteo', 'El producto escaneado no pertenece a este conteo');
        return;
      }
      contarLinea(linea);
    } catch (error) {
      Alert.alert(
        'Conteo',
        error instanceof Error ? error.message : 'Error al procesar la etiqueta'
      );
    }
  };

  /** Busca por SKU/nombre la primera línea sin contar y abre el modal. */
  const buscarYContar = () => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return;
    const linea = conteo?.lineas.find(
      l =>
        l.cantidadContada === null &&
        (l.productoCodigo.toLowerCase().includes(q) || l.productoNombre.toLowerCase().includes(q))
    ) ?? conteo?.lineas.find(
      l => l.productoCodigo.toLowerCase().includes(q) || l.productoNombre.toLowerCase().includes(q)
    );
    if (!linea) {
      Alert.alert('Conteo', 'Ningún producto del conteo coincide con la búsqueda');
      return;
    }
    contarLinea(linea);
  };

  const confirmarCantidad = async (cantidad: number) => {
    if (!lineaModal || !conteoId) return;
    setGuardando(true);
    try {
      const resultado = await registrarCantidad(conteoId, lineaModal.productoId, cantidad);
      if (resultado.exito) {
        setLineaModal(null);
      }
    } finally {
      setGuardando(false);
    }
  };

  const cerrar = () => {
    Alert.alert(
      'Cerrar conteo',
      'Se comparará lo contado contra el stock real y se generarán ajustes por cada diferencia. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar conteo',
          onPress: async () => {
            if (!conteoId) return;
            const resultado = await cerrarConteo(conteoId);
            if (resultado.exito) Alert.alert('Conteo', resultado.mensaje);
          },
        },
      ]
    );
  };

  const cancelarConteoActual = () => {
    Alert.alert('Cancelar conteo', 'Se descartarán las cantidades contadas sin generar ajustes.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          if (!conteoId) return;
          const resultado = await cancelarConteo(conteoId);
          if (resultado.exito) router.back();
        },
      },
    ]);
  };

  if (!conteo && isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!conteo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.vacio}>
          <MaterialCommunityIcons name="clipboard-alert-outline" size={48} color={COLORS.gray} />
          <Text style={styles.vacioTexto}>No se pudo cargar el conteo</Text>
          <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
            <Text style={styles.botonVolverTexto}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const abierto = conteo.estado === 'ABIERTO';
  const ocultarEsperado = conteo.esCiego && abierto;
  const progreso =
    conteo.totalLineas > 0
      ? Math.round((conteo.totalContadas / conteo.totalLineas) * 100)
      : 0;
  const q = busqueda.trim().toLowerCase();
  const lineasFiltradas = q
    ? conteo.lineas.filter(
        l => l.productoCodigo.toLowerCase().includes(q) || l.productoNombre.toLowerCase().includes(q)
      )
    : conteo.lineas;

  return (
    <SafeAreaView style={styles.container}>
      {escaneando ? (
        <View style={styles.escanerWrapper}>
          <QRScanner
            operationType="entrada"
            onScanSuccess={data => {
              try {
                let codigo = data.trim();
                try {
                  const parsed = JSON.parse(data);
                  if (parsed && typeof parsed.codigo === 'string') codigo = parsed.codigo;
                } catch {
                  // No es JSON: usar el texto crudo
                }
                setEscaneando(false);
                resolverEscaneo(codigo);
              } catch {
                setEscaneando(false);
              }
            }}
            onScanError={() => {}}
            onClose={() => setEscaneando(false)}
            isLoading={false}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.titulo}>{conteo.almacenNombre}</Text>
          <View style={styles.chips}>
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
            {conteo.esCiego && (
              <View style={styles.chipCiego}>
                <Text style={styles.estadoTexto}>A CIEGAS</Text>
              </View>
            )}
            {!isServerReachable && (
              <View style={[styles.estadoChip, styles.estadoCancelado]}>
                <Text style={styles.estadoTexto}>SIN CONEXIÓN</Text>
              </View>
            )}
          </View>

          <View style={styles.cardProgreso}>
            <Text style={styles.progresoTexto}>
              {conteo.totalContadas}/{conteo.totalLineas} productos contados
            </Text>
            <View style={styles.barraFondo}>
              <View style={[styles.barraProgreso, { width: `${progreso}%` }]} />
            </View>
          </View>

          {aviso && (
            <View style={styles.avisoOk}>
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.white} />
              <Text style={styles.avisoTexto}>{aviso}</Text>
              <TouchableOpacity onPress={() => setAviso(null)}>
                <MaterialCommunityIcons name="close" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}

          {conteo.estado === 'CERRADO' && conteo.resumen && (
            <View style={styles.resumenCard}>
              <Text style={styles.resumenTitulo}>Informe del conteo</Text>
              <Text style={styles.resumenLinea}>
                Sobrantes: {conteo.resumen.sobrantes} · Faltantes: {conteo.resumen.faltantes} ·
                Ajustes: {conteo.resumen.ajustesGenerados}
              </Text>
              {(conteo.resumen.errores ?? []).length > 0 && (
                <Text style={[styles.resumenLinea, { color: COLORS.error }]}>
                  Sin ajustar: {(conteo.resumen.errores ?? []).length} (revisar informe en la web)
                </Text>
              )}
            </View>
          )}

          {abierto && (
            <>
              {!isServerReachable && (
                <View style={styles.bannerOffline}>
                  <MaterialCommunityIcons name="access-point-off" size={18} color={COLORS.white} />
                  <Text style={styles.bannerTexto}>
                    El conteo requiere conexión con el servidor
                  </Text>
                </View>
              )}
              <View style={styles.buscadorFila}>
                <TextInput
                  style={styles.buscador}
                  placeholder="Buscar SKU o nombre…"
                  placeholderTextColor={COLORS.gray}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  onSubmitEditing={buscarYContar}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.botonBuscar} onPress={buscarYContar}>
                  <MaterialCommunityIcons name="magnify" size={22} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.botonBuscar, { backgroundColor: COLORS.accent }]}
                  onPress={() => setEscaneando(true)}
                  disabled={!isServerReachable}
                >
                  <MaterialCommunityIcons name="qrcode-scan" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </>
          )}

          {lineasFiltradas.map(linea => {
            const diferenciaVisible = !ocultarEsperado && linea.diferencia !== null;
            return (
              <TouchableOpacity
                key={linea.productoId}
                style={styles.lineaCard}
                disabled={!abierto}
                activeOpacity={abierto ? 0.7 : 1}
                onPress={() => contarLinea(linea)}
              >
                <View style={styles.lineaInfo}>
                  <Text style={styles.lineaSku}>{linea.productoCodigo}</Text>
                  <Text style={styles.lineaNombre} numberOfLines={2}>
                    {linea.productoNombre}
                  </Text>
                </View>
                <View style={styles.lineaCantidades}>
                  <Text style={styles.lineaEsperado}>
                    {ocultarEsperado ? 'esperado —' : `esperado ${linea.cantidadEsperada}`}
                  </Text>
                  <Text style={styles.lineaContado}>
                    {linea.cantidadContada === null ? 'sin contar' : `contado ${linea.cantidadContada}`}
                  </Text>
                  {diferenciaVisible && (
                    <Text
                      style={[
                        styles.lineaDiferencia,
                        linea.diferencia! > 0 && { color: COLORS.success },
                        linea.diferencia! < 0 && { color: COLORS.error },
                      ]}
                    >
                      {linea.diferencia! > 0 ? '+' : ''}
                      {linea.diferencia}
                      {linea.ajusteId ? ' · ajustado' : ''}
                    </Text>
                  )}
                </View>
                {abierto && (
                  <MaterialCommunityIcons
                    name={linea.cantidadContada === null ? 'pencil' : 'check-circle'}
                    size={22}
                    color={linea.cantidadContada === null ? COLORS.gray : COLORS.success}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          {lineasFiltradas.length === 0 && (
            <Text style={styles.vacioTexto}>Sin resultados</Text>
          )}

          {abierto && puedeGestionar && (
            <View style={styles.botonesGestion}>
              <TouchableOpacity
                style={[styles.botonGestion, { backgroundColor: COLORS.success }]}
                onPress={cerrar}
                disabled={isLoading || conteo.totalContadas < conteo.totalLineas}
              >
                <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.white} />
                <Text style={styles.botonGestionTexto}>
                  Cerrar ({conteo.totalContadas}/{conteo.totalLineas})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonGestion, { backgroundColor: COLORS.error }]}
                onPress={cancelarConteoActual}
                disabled={isLoading}
              >
                <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.white} />
                <Text style={styles.botonGestionTexto}>Cancelar conteo</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      <ConteoCantidadModal
        visible={lineaModal !== null}
        codigo={lineaModal?.productoCodigo || ''}
        productoNombre={lineaModal?.productoNombre || ''}
        productoCodigo={lineaModal?.productoCodigo || ''}
        cantidadEsperada={ocultarEsperado ? null : lineaModal?.cantidadEsperada ?? null}
        productoFotoUrl={null}
        onCancel={() => setLineaModal(null)}
        onConfirm={confirmarCantidad}
        guardando={guardando}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  escanerWrapper: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  estadoChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  chipCiego: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: COLORS.warning,
  },
  estadoTexto: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardProgreso: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  progresoTexto: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  barraFondo: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  barraProgreso: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  avisoOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  avisoTexto: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  resumenCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
  },
  resumenTitulo: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  resumenLinea: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 19,
  },
  buscadorFila: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  buscador: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
  },
  botonBuscar: {
    width: 46,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineaCard: {
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lineaInfo: {
    flex: 1,
  },
  lineaSku: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: 'bold',
  },
  lineaNombre: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 18,
  },
  lineaCantidades: {
    alignItems: 'flex-end',
  },
  lineaEsperado: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  lineaContado: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  lineaDiferencia: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: 'bold',
  },
  botonesGestion: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  botonGestion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 13,
  },
  botonGestionTexto: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  vacio: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  vacioTexto: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  botonVolver: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  botonVolverTexto: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
});
