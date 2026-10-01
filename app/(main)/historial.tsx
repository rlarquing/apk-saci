/**
 * Pantalla de Historial por producto (backlog P2 — timeline).
 *
 * El operario busca un producto por SKU (o elige uno reciente escaneado) y
 * consulta el kardex del servidor filtrado por producto
 * (GET /api/movimiento-inventario?productoId=…). ONLINE-ONLY: sin conexión
 * muestra un aviso; el catálogo y el stock disponibles son los del cache
 * local para que la búsqueda funcione también offline (la consulta del
 * historial requiere red).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { COLORS } from '@/src/shared/constants';
import { MovimientoHistorial, Producto } from '@/src/domain';

const PREFIJO_SKU = /^PRD-[0-9A-Za-z]+$/i;

const urlFotoProducto = (productoId: string): string | null => {
  if (!productoId) return null;
  const base = serviceContainer.network.getBaseUrl().replace(/\/$/, '');
  return `${base}/api/producto-foto/${productoId}`;
};

const TIPO_META: Record<
  string,
  { icon: any; color: string; label: string; fondo: string }
> = {
  ENTRADA: { icon: 'arrow-down-bold', color: '#047857', label: 'Entrada', fondo: '#d1fae5' },
  SALIDA: { icon: 'arrow-up-bold', color: '#b91c1c', label: 'Salida', fondo: '#fee2e2' },
  AJUSTE: { icon: 'tune', color: '#b45309', label: 'Ajuste', fondo: '#fef3c7' },
  TRASLADO: { icon: 'swap-horizontal', color: '#0f766e', label: 'Traslado', fondo: '#ccfbf1' },
};

const formatearFecha = (fecha: string): string => {
  try {
    const d = new Date(fecha);
    return d.toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fecha;
  }
};

export default function HistorialScreen() {
  const [sku, setSku] = useState('');
  const [producto, setProducto] = useState<Producto | null>(null);
  const [stockActual, setStockActual] = useState<number | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const buscar = async () => {
    const codigo = sku.trim().toUpperCase();
    if (!PREFIJO_SKU.test(codigo)) {
      setMensaje('Ingresa un SKU válido (PRD-XXXXXX)');
      return;
    }

    setCargando(true);
    setMensaje(null);
    setProducto(null);
    setMovimientos([]);

    try {
      // El catálogo vive en el cache local (funciona offline)
      const prod = await serviceContainer.localProducto.buscarPorCodigo(codigo);
      if (!prod) {
        setMensaje('Producto no encontrado en la caché local. Sincroniza la app.');
        return;
      }
      setProducto(prod);

      // Stock actual del cache (por almacén seleccionado)
      const sesion = await serviceContainer.auth.obtenerSesionLocal();
      const almacenId = sesion?.almacenSeleccionado?.id;
      if (almacenId) {
        setStockActual(
          await serviceContainer.localStock.obtenerStock(prod.id, almacenId)
        );
      }

      // Timeline desde el servidor (online-only)
      const resultado = await serviceContainer.historialProducto.execute(prod.id);
      if (!resultado.exito) {
        setMensaje(resultado.mensaje || 'No se pudo consultar el historial');
      }
      setMovimientos(resultado.movimientos);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  };

  const renderItem = ({ item }: { item: MovimientoHistorial }) => {
    const meta = TIPO_META[item.tipo] ?? TIPO_META.ENTRADA;
    const esNegativo =
      item.tipo === 'SALIDA' || (item.tipo === 'AJUSTE' && item.signoAjuste === -1);
    return (
      <View style={styles.timelineItem}>
        <View style={[styles.timelineDot, { backgroundColor: meta.fondo }]}>
          <MaterialCommunityIcons name={meta.icon} size={14} color={meta.color} />
        </View>
        <View style={styles.timelineBody}>
          <View style={styles.timelineFila}>
            <Text style={[styles.timelineTipo, { color: meta.color }]}>{meta.label}</Text>
            <Text style={[styles.timelineCantidad, { color: esNegativo ? COLORS.error : COLORS.success }]}>
              {esNegativo ? '-' : '+'}
              {item.cantidad}
            </Text>
            {item.saldoResultante !== undefined && item.saldoResultante !== null && (
              <Text style={styles.timelineSaldo}>saldo: {item.saldoResultante}</Text>
            )}
          </View>
          <Text style={styles.timelineMeta}>
            {formatearFecha(item.fecha)} · {item.almacenNombre}
            {item.userName ? ` · ${item.userName}` : ''}
          </Text>
          {item.almacenDestinoNombre && (
            <Text style={styles.timelineMeta}>Destino: {item.almacenDestinoNombre}</Text>
          )}
          {item.observaciones ? (
            <Text style={styles.timelineObs} numberOfLines={2}>
              “{item.observaciones}”
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.busquedaRow}>
        <TextInput
          style={styles.busquedaInput}
          placeholder="SKU del producto (PRD-XXXXXX)"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={sku}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setSku}
          onSubmitEditing={buscar}
        />
        <TouchableOpacity style={styles.busquedaBtn} onPress={buscar} disabled={cargando}>
          <MaterialCommunityIcons
            name={cargando ? 'loading' : 'magnify'}
            size={20}
            color={COLORS.white}
          />
        </TouchableOpacity>
      </View>

      {mensaje && <Text style={styles.mensaje}>{mensaje}</Text>}

      {producto && (
        <View style={styles.productoCard}>
          {producto.id && urlFotoProducto(producto.id) ? (
            <Image
              source={{ uri: urlFotoProducto(producto.id) as string }}
              style={styles.productoFoto}
            />
          ) : (
            <View style={[styles.productoFoto, styles.productoFotoVacia]}>
              <MaterialCommunityIcons name="package-variant" size={22} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.productoNombre} numberOfLines={2}>
              {producto.codigo} · {producto.nombre}
            </Text>
            <Text style={styles.productoMeta}>
              {producto.categoriaNombre || '—'} · {producto.unidadNombre || ''}
              {producto.stockSeguridad ? ` · seguridad ${producto.stockSeguridad}` : ''}
            </Text>
            {stockActual !== null && (
              <Text style={styles.productoStock}>Stock en el almacén: {stockActual}</Text>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={movimientos}
        keyExtractor={m => m.id}
        renderItem={renderItem}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={
          producto && !cargando ? (
            <Text style={styles.vacio}>Sin movimientos registrados en el servidor.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
  },
  busquedaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  busquedaInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.25)',
    color: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  busquedaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mensaje: {
    marginTop: 8,
    color: COLORS.accent,
    fontSize: 13,
  },
  productoCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  productoFoto: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  productoFotoVacia: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productoNombre: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  productoMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    marginTop: 2,
  },
  productoStock: {
    color: COLORS.accent,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  lista: {
    paddingVertical: 14,
    paddingBottom: 30,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
  },
  timelineFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineTipo: {
    fontWeight: '700',
    fontSize: 13,
  },
  timelineCantidad: {
    fontWeight: '700',
    fontSize: 13,
  },
  timelineSaldo: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
  timelineMeta: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  timelineObs: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
  },
  vacio: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
});
