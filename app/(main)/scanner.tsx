/**
 * Pantalla de Escáner QR
 * Flujo: escanear → identificar (etiqueta QR o SKU) → capturar cantidad →
 * registrar → mostrar resultado.
 *
 * 1. Etiqueta QR (QR-XXXXXX): se valida contra el API (o el cache offline)
 *    ANTES de pedir la cantidad, para mostrar el producto y el stock local.
 * 2. SKU manual (PRD-XXXXXX): se resuelve contra el catálogo local.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QRScanner } from '@/components/QRScanner';
import { ResultModal } from '@/components/ResultModal';
import { CantidadModal } from '@/components/CantidadModal';
import { useOperacionInventario } from '@/src/presentation';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { TipoOperacion, ResultadoOperacion } from '@/src/domain';

interface InfoEscaneo {
  codigo: string;
  productoNombre: string;
  productoCodigo: string;
  stockDisponible: number | null;
  /** Foto del producto (endpoint público del API; null si no tiene) */
  productoFotoUrl: string | null;
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

  const { isLoading, result, executeOperacion, reset } = useOperacionInventario();

  useEffect(() => {
    if (params.operation) {
      setOperationType(params.operation);
    }
  }, [params.operation]);

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

  const handleScanSuccess = useCallback(
    async (data: string, _operation: TipoOperacion) => {
      if (procesando || isLoading) return;
      setProcesando(true);

      const codigo = extraerCodigo(data);
      const almacenId = serviceContainer.auth && (await serviceContainer.auth.obtenerSesionLocal())?.almacenSeleccionado?.id;

      try {
        if (PREFIJO_SKU.test(codigo)) {
          // Modo manual por SKU: resolver contra el catálogo local
          const producto = await serviceContainer.localProducto.buscarPorCodigo(codigo);
          if (!producto) {
            setErrorPrevio({
              exito: false,
              movimiento: null,
              mensaje:
                'Producto no encontrado en la caché local. Sincronice la aplicación e intente de nuevo.',
              tipo: operationType,
            });
            setModalVisible(true);
            return;
          }
          const stock = almacenId
            ? await serviceContainer.localStock.obtenerStock(producto.id, almacenId)
            : null;
          setEscaneo({
            codigo,
            productoNombre: producto.nombre,
            productoCodigo: producto.codigo,
            stockDisponible: stock,
            productoFotoUrl: urlFotoProducto(producto.id),
          });
        } else {
          // Modo etiqueta QR: validar antes de pedir la cantidad
          if (!almacenId) {
            setErrorPrevio({
              exito: false,
              movimiento: null,
              mensaje: 'No hay almacén seleccionado',
              tipo: operationType,
            });
            setModalVisible(true);
            return;
          }

          const resultadoQR = await serviceContainer.qr.validarQR(codigo, almacenId);
          if (!resultadoQR.valido) {
            setErrorPrevio({
              exito: false,
              movimiento: null,
              mensaje: resultadoQR.mensaje || 'Etiqueta no válida',
              tipo: operationType,
            });
            setModalVisible(true);
            return;
          }

          const qr = resultadoQR.qr;
          const stock = qr?.productoId
            ? await serviceContainer.localStock.obtenerStock(qr.productoId, almacenId)
            : null;
          setEscaneo({
            codigo: qr?.codigo || codigo,
            productoNombre: qr?.productoNombre || '',
            productoCodigo: qr?.productoCodigo || '',
            stockDisponible: stock,
            productoFotoUrl: urlFotoProducto(qr?.productoId || ''),
          });
        }

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
    [operationType, procesando, isLoading]
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <QRScanner
        operationType={operationType}
        onScanSuccess={handleScanSuccess}
        onScanError={() => {}}
        onClose={handleClose}
        isLoading={isLoading || procesando}
      />

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
});
