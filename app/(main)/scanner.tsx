/**
 * Pantalla de Escáner QR
 * Flujo: escanear → identificar (etiqueta QR o SKU) → capturar cantidad →
 * registrar → mostrar resultado.
 *
 * 1. Etiqueta QR (QR-XXXXXX): se valida contra el API (o el cache offline)
 *    ANTES de pedir la cantidad, para mostrar el producto y el stock local.
 * 2. SKU manual (PRD-XXXXXX): se resuelve contra el catálogo local.
 *
 * MODO RÁFAGA (backlog P2): tras cada escaneo exitoso se vuelve directo a
 * cámara SIN modal de confirmación; cada lectura suma +1 a un acumulador de
 * sesión. Al final se confirma por lote (un movimiento por producto con la
 * cantidad acumulada), reutilizando el mismo flujo offline de pendientes.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QRScanner } from '@/components/QRScanner';
import { ResultModal } from '@/components/ResultModal';
import { CantidadModal } from '@/components/CantidadModal';
import { useOperacionInventario } from '@/src/presentation';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { TipoOperacion, ResultadoOperacion } from '@/src/domain';
import { COLORS } from '@/src/shared/constants';

interface InfoEscaneo {
  codigo: string;
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  stockDisponible: number | null;
  /** Foto del producto (endpoint público del API; null si no tiene) */
  productoFotoUrl: string | null;
}

/** Ítem acumulado en la sesión de ráfaga. */
interface ItemRafaga {
  /** Código usado para el movimiento (QR de la etiqueta o SKU). */
  codigo: string;
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  cantidad: number;
  stockDisponible: number | null;
  productoFotoUrl: string | null;
}

interface ResumenLote {
  ok: number;
  encolados: number;
  errores: string[];
}

/** Prefijo del SKU autogenerado por el API para productos */
const PREFIJO_SKU = /^PRD-[0-9A-Za-z]+$/i;

/** Construye la URL pública de la foto de un producto. */
const urlFotoProducto = (productoId: string): string | null => {
  if (!productoId) return null;
  const base = serviceContainer.network.getBaseUrl().replace(/\/$/, '');
  return `${base}/api/producto-foto/${productoId}`;
};

export default function ScannerScreen() {
  const params = useLocalSearchParams<{ operation: TipoOperacion }>();
  const router = useRouter();
  const [operationType, setOperationType] = useState<TipoOperacion>('entrada');
  const [modalVisible, setModalVisible] = useState(false);
  const [cantidadVisible, setCantidadVisible] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [escaneo, setEscaneo] = useState<InfoEscaneo | null>(null);
  const [errorPrevio, setErrorPrevio] = useState<ResultadoOperacion | null>(null);

  // Modo ráfaga (P2)
  const [modoRafaga, setModoRafaga] = useState(false);
  const [itemsRafaga, setItemsRafaga] = useState<Record<string, ItemRafaga>>({});
  const [avisoRafaga, setAvisoRafaga] = useState<string | null>(null);
  const [resumenLote, setResumenLote] = useState<ResumenLote | null>(null);
  const [skuManual, setSkuManual] = useState('');
  const [rearmarToken, setRearmarToken] = useState(0);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isLoading, result, executeOperacion, reset } = useOperacionInventario();

  useEffect(() => {
    if (params.operation) {
      setOperationType(params.operation);
    }
  }, [params.operation]);

  useEffect(() => {
    return () => {
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
    };
  }, []);

  /** Muestra un aviso transitorio en el panel de ráfaga. */
  const mostrarAviso = (mensaje: string) => {
    setAvisoRafaga(mensaje);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAvisoRafaga(null), 2500);
  };

  /**
   * Extrae el código de etiqueta del contenido escaneado. El payload del QR
   * puede ser un JSON con {codigo} o el código en texto plano.
   */
  const extraerCodigo = (data: string): string => {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed.codigo === 'string') {
        return parsed.codigo;
      }
    } catch {
      // No es JSON: usar el texto crudo
    }
    return data.trim();
  };

  /** Resuelve un código (QR o SKU) a InfoEscaneo. Lanza Error si es inválido. */
  const resolverCodigo = async (codigo: string): Promise<InfoEscaneo> => {
    const almacenId =
      serviceContainer.auth &&
      (await serviceContainer.auth.obtenerSesionLocal())?.almacenSeleccionado?.id;

    if (PREFIJO_SKU.test(codigo)) {
      // Modo manual por SKU: resolver contra el catálogo local
      const producto = await serviceContainer.localProducto.buscarPorCodigo(codigo);
      if (!producto) {
        throw new Error(
          'Producto no encontrado en la caché local. Sincronice la aplicación e intente de nuevo.'
        );
      }
      const stock = almacenId
        ? await serviceContainer.localStock.obtenerStock(producto.id, almacenId)
        : null;
      return {
        codigo,
        productoId: producto.id,
        productoNombre: producto.nombre,
        productoCodigo: producto.codigo,
        stockDisponible: stock,
        productoFotoUrl: urlFotoProducto(producto.id),
      };
    }

    // Modo etiqueta QR: validar antes de pedir la cantidad
    if (!almacenId) {
      throw new Error('No hay almacén seleccionado');
    }
    const resultadoQR = await serviceContainer.qr.validarQR(codigo, almacenId);
    if (!resultadoQR.valido) {
      throw new Error(resultadoQR.mensaje || 'Etiqueta no válida');
    }
    const qr = resultadoQR.qr;
    const stock = qr?.productoId
      ? await serviceContainer.localStock.obtenerStock(qr.productoId, almacenId)
      : null;
    return {
      codigo: qr?.codigo || codigo,
      productoId: qr?.productoId || '',
      productoNombre: qr?.productoNombre || '',
      productoCodigo: qr?.productoCodigo || '',
      stockDisponible: stock,
      productoFotoUrl: urlFotoProducto(qr?.productoId || ''),
    };
  };

  /** Suma +1 al acumulador de ráfaga para el producto escaneado. */
  const acumularRafaga = (info: InfoEscaneo) => {
    setItemsRafaga(prev => {
      const clave = info.productoId || info.codigo;
      const actual = prev[clave];
      const nuevaCantidad = (actual?.cantidad ?? 0) + 1;

      if (
        operationType === 'salida' &&
        info.stockDisponible !== null &&
        nuevaCantidad > info.stockDisponible
      ) {
        Vibration.vibrate([80, 60, 80]);
        mostrarAviso(
          `Supera el stock disponible de ${info.productoCodigo} (${info.stockDisponible})`
        );
        return prev;
      }

      Vibration.vibrate(60);
      mostrarAviso(`+1 · ${info.productoNombre || info.productoCodigo}`);
      setRearmarToken(t => t + 1);
      return {
        ...prev,
        [clave]: {
          codigo: info.codigo,
          productoId: info.productoId,
          productoNombre: info.productoNombre,
          productoCodigo: info.productoCodigo,
          cantidad: nuevaCantidad,
          stockDisponible: info.stockDisponible,
          productoFotoUrl: info.productoFotoUrl,
        },
      };
    });
  };

  const handleScanSuccess = useCallback(
    async (data: string, _operation: TipoOperacion) => {
      if (procesando || isLoading) return;
      setProcesando(true);

      const codigo = extraerCodigo(data);

      try {
        const info = await resolverCodigo(codigo);

        if (modoRafaga) {
          // RÁFAGA: sin modal, volver directo a cámara con +1
          acumularRafaga(info);
          return;
        }

        setEscaneo(info);
        // Pedir la cantidad al operador
        setCantidadVisible(true);
      } catch (error) {
        setErrorPrevio({
          exito: false,
          movimiento: null,
          mensaje: error instanceof Error ? error.message : 'Error al procesar la etiqueta',
          tipo: operationType,
        });
        setModalVisible(true);
      } finally {
        setProcesando(false);
      }
    },
    [operationType, procesando, isLoading, modoRafaga]
  );

  /** Alta manual por SKU en modo ráfaga (sin escáner). */
  const agregarSkuManual = async () => {
    const codigo = skuManual.trim();
    if (!codigo || procesando) return;
    setProcesando(true);
    try {
      const info = await resolverCodigo(codigo);
      acumularRafaga(info);
      setSkuManual('');
    } catch (error) {
      mostrarAviso(error instanceof Error ? error.message : 'SKU no válido');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarCantidad = async (cantidad: number) => {
    if (!escaneo) return;
    setCantidadVisible(false);
    await executeOperacion(escaneo.codigo, operationType, cantidad);
  };

  const handleCancelCantidad = () => {
    setCantidadVisible(false);
    setEscaneo(null);
  };

  const handleClose = () => {
    router.back();
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setErrorPrevio(null);
    reset();
    router.back();
  };

  // Mostrar modal cuando hay un resultado de la operación
  useEffect(() => {
    if (result) {
      setModalVisible(true);
    }
  }, [result]);

  // ==================== RÁFAGA: ajustes de cantidad ====================

  const ajustarItem = (clave: string, delta: number) => {
    setItemsRafaga(prev => {
      const item = prev[clave];
      if (!item) return prev;
      const nueva = item.cantidad + delta;
      if (nueva < 1) return prev;

      if (
        delta > 0 &&
        operationType === 'salida' &&
        item.stockDisponible !== null &&
        nueva > item.stockDisponible
      ) {
        mostrarAviso(`Supera el stock disponible (${item.stockDisponible})`);
        return prev;
      }
      return { ...prev, [clave]: { ...item, cantidad: nueva } };
    });
  };

  const quitarItem = (clave: string) => {
    setItemsRafaga(prev => {
      const copia = { ...prev };
      delete copia[clave];
      return copia;
    });
  };

  /** Confirma el lote: un movimiento por producto con su cantidad acumulada. */
  const confirmarLote = async () => {
    const items = Object.values(itemsRafaga).filter(i => i.cantidad > 0);
    if (items.length === 0) return;

    setProcesando(true);
    const resumen: ResumenLote = { ok: 0, encolados: 0, errores: [] };

    for (const item of items) {
      try {
        // Mismo camino que el modo normal (executeOperacion): registra online
        // o degrada a pendiente offline de forma independiente por ítem.
        const usarUseCase =
          operationType === 'entrada'
            ? serviceContainer.registrarEntrada
            : serviceContainer.registrarSalida;
        const sesion = await serviceContainer.auth.obtenerSesionLocal();
        const almacenId = sesion?.almacenSeleccionado?.id;
        if (!almacenId) throw new Error('No hay almacén seleccionado');

        const resultado = await usarUseCase.execute(item.codigo, almacenId, item.cantidad);
        if (resultado.exito) {
          if (resultado.movimiento) resumen.ok++;
          else resumen.encolados++;
        } else {
          resumen.errores.push(
            `${item.productoCodigo}: ${resultado.mensaje || 'Error'}`
          );
        }
      } catch (error) {
        resumen.errores.push(
          `${item.productoCodigo}: ${error instanceof Error ? error.message : 'Error'}`
        );
      }
    }

    setProcesando(false);
    setResumenLote(resumen);
    setItemsRafaga({});
  };

  const listaRafaga = Object.entries(itemsRafaga);
  const totalUnidades = listaRafaga.reduce((acc, [, i]) => acc + i.cantidad, 0);

  return (
    <SafeAreaView style={styles.container}>
      <QRScanner
        operationType={operationType}
        onScanSuccess={handleScanSuccess}
        onScanError={() => {}}
        onClose={handleClose}
        isLoading={isLoading || procesando}
        rearmarToken={modoRafaga ? rearmarToken : undefined}
      />

      {/* Panel de control de modo ráfaga */}
      {modoRafaga && (
        <View style={styles.rafagaPanel}>
          <View style={styles.rafagaHeader}>
            <MaterialCommunityIcons name="flash" size={18} color={COLORS.accent} />
            <Text style={styles.rafagaTitle}>
              Modo ráfaga · {listaRafaga.length} prod. · {totalUnidades} uds
            </Text>
            <TouchableOpacity onPress={() => setModoRafaga(false)}>
              <Text style={styles.rafagaSalir}>Salir</Text>
            </TouchableOpacity>
          </View>

          {avisoRafaga && <Text style={styles.rafagaAviso}>{avisoRafaga}</Text>}

          {resumenLote && (
            <View style={styles.rafagaResumen}>
              <Text style={styles.rafagaResumenTexto}>
                Lote: {resumenLote.ok} registrado(s) · {resumenLote.encolados} en cola ·{' '}
                {resumenLote.errores.length} error(es)
              </Text>
              {resumenLote.errores.slice(0, 3).map((e, i) => (
                <Text key={i} style={styles.rafagaErrorTexto} numberOfLines={1}>
                  · {e}
                </Text>
              ))}
              <TouchableOpacity onPress={() => setResumenLote(null)}>
                <Text style={styles.rafagaSalir}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          )}

          {listaRafaga.length > 0 && (
            <ScrollView style={styles.rafagaLista} nestedScrollEnabled>
              {listaRafaga.map(([clave, item]) => (
                <View key={clave} style={styles.rafagaItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rafagaItemNombre} numberOfLines={1}>
                      {item.productoNombre || item.productoCodigo}
                    </Text>
                    <Text style={styles.rafagaItemCodigo}>{item.productoCodigo}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.rafagaBtn}
                    onPress={() => ajustarItem(clave, -1)}
                  >
                    <MaterialCommunityIcons name="minus" size={16} color={COLORS.white} />
                  </TouchableOpacity>
                  <Text style={styles.rafagaCantidad}>{item.cantidad}</Text>
                  <TouchableOpacity
                    style={styles.rafagaBtn}
                    onPress={() => ajustarItem(clave, +1)}
                  >
                    <MaterialCommunityIcons name="plus" size={16} color={COLORS.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rafagaBtn, { backgroundColor: COLORS.error }]}
                    onPress={() => quitarItem(clave)}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.rafagaManualRow}>
            <TextInput
              style={styles.rafagaInput}
              placeholder="SKU manual PRD-XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={skuManual}
              autoCapitalize="characters"
              onChangeText={setSkuManual}
              onSubmitEditing={agregarSkuManual}
            />
            <TouchableOpacity style={styles.rafagaBtnPrimary} onPress={agregarSkuManual}>
              <MaterialCommunityIcons name="plus" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.rafagaConfirmar, (listaRafaga.length === 0 || procesando) && { opacity: 0.4 }]}
            onPress={confirmarLote}
            disabled={listaRafaga.length === 0 || procesando}
          >
            <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.white} />
            <Text style={styles.rafagaConfirmarTexto}>
              Registrar lote ({listaRafaga.length} prod. / {totalUnidades} uds)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botón para ENTRAR al modo ráfaga (oculto dentro de él) */}
      {!modoRafaga && (
        <TouchableOpacity
          style={styles.rafagaActivar}
          onPress={() => {
            setResumenLote(null);
            setModoRafaga(true);
          }}
        >
          <MaterialCommunityIcons name="flash" size={18} color={COLORS.white} />
          <Text style={styles.rafagaActivarTexto}>Modo ráfaga</Text>
        </TouchableOpacity>
      )}

      <CantidadModal
        visible={cantidadVisible}
        operation={operationType}
        codigo={escaneo?.codigo || ''}
        productoNombre={escaneo?.productoNombre || ''}
        productoCodigo={escaneo?.productoCodigo || ''}
        stockDisponible={escaneo?.stockDisponible ?? null}
        productoFotoUrl={escaneo?.productoFotoUrl ?? null}
        onCancel={handleCancelCantidad}
        onConfirm={handleConfirmarCantidad}
      />

      <ResultModal
        visible={modalVisible}
        result={result || errorPrevio}
        operationType={operationType}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  rafagaActivar: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 118, 110, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  rafagaActivarTexto: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  rafagaPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '62%',
    backgroundColor: 'rgba(10, 10, 26, 0.96)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
    padding: 12,
    zIndex: 30,
  },
  rafagaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rafagaTitle: {
    flex: 1,
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  rafagaSalir: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 12,
    paddingHorizontal: 6,
  },
  rafagaAviso: {
    marginTop: 6,
    color: COLORS.accent,
    fontSize: 12,
  },
  rafagaResumen: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  rafagaResumenTexto: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  rafagaErrorTexto: {
    color: COLORS.error,
    fontSize: 11,
  },
  rafagaLista: {
    marginTop: 8,
    maxHeight: 180,
  },
  rafagaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  rafagaItemNombre: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  rafagaItemCodigo: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  rafagaBtn: {
    backgroundColor: 'rgba(45, 212, 191, 0.25)',
    borderRadius: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rafagaCantidad: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 34,
    textAlign: 'center',
  },
  rafagaManualRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  rafagaInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  rafagaBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rafagaConfirmar: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  rafagaConfirmarTexto: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
