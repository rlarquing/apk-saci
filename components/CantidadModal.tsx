/**
 * Modal de captura de cantidad
 * Paso intermedio del escáner: tras validar la etiqueta (o resolver el SKU),
 * el operador indica cuántas unidades entran o salen. La cantidad es LA
 * diferencia central respecto de un ticket de un solo uso.
 *
 * Backlog P3: la ficha muestra el bin del producto y, solo en la ENTRADA,
 * dos campos opcionales de lote y caducidad. Si el operario no los rellena,
 * el payload queda igual que hoy (captura de lote es opcional).
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../src/shared/constants';
import { TipoOperacion, LoteInfo } from '../src/domain/entities';

/** Límite de cantidad del API: CreateEntradaDto (0.01 - 999999.99) */
const MAX_CANTIDAD = 999999.99;
const REGEX_CANTIDAD = /^\d{1,6}([.,]\d{1,2})?$/;
/** Límite del lote del API: CreateEntradaDto (lote ≤50) */
const MAX_LOTE = 50;
/** Formato de caducidad esperado del operador */
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

interface CantidadModalProps {
  visible: boolean;
  operation: TipoOperacion;
  codigo: string;
  productoNombre: string;
  productoCodigo: string;
  /** Stock conocido del producto en el almacén (null: sin dato local) */
  stockDisponible: number | null;
  /** Foto del producto (endpoint público del API; null: sin foto) */
  productoFotoUrl?: string | null;
  /** Bin (ubicación) del producto en el almacén activo (null: sin bin) */
  binNombre?: string | null;
  onCancel: () => void;
  onConfirm: (cantidad: number, loteInfo?: LoteInfo) => void;
}

export function CantidadModal({
  visible,
  operation,
  codigo,
  productoNombre,
  productoCodigo,
  stockDisponible,
  productoFotoUrl,
  binNombre,
  onCancel,
  onConfirm,
}: CantidadModalProps) {
  const [texto, setTexto] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [loteTexto, setLoteTexto] = useState('');
  const [fechaTexto, setFechaTexto] = useState('');

  useEffect(() => {
    if (visible) {
      setTexto('1');
      setError(null);
      setLoteTexto('');
      setFechaTexto('');
    }
  }, [visible]);

  const esEntrada = operation === 'entrada';
  const titulo = esEntrada ? 'Registrar Entrada' : 'Registrar Salida';

  const confirmar = () => {
    const normalizado = texto.replace(',', '.').trim();

    if (!REGEX_CANTIDAD.test(normalizado)) {
      setError('Ingrese una cantidad válida (hasta 6 enteros y 2 decimales)');
      return;
    }

    const cantidad = parseFloat(normalizado);
    if (!(cantidad > 0)) {
      setError('La cantidad debe ser mayor que cero');
      return;
    }
    if (cantidad > MAX_CANTIDAD) {
      setError('La cantidad excede el máximo permitido');
      return;
    }

    // Validación previa de stock con el dato local (la salida definitiva la
    // valida el API contra el kardex real)
    if (!esEntrada && stockDisponible !== null && cantidad > stockDisponible) {
      setError(`Stock insuficiente: disponible ${stockDisponible}`);
      return;
    }

    // Lote/caducidad (P3): solo ENTRADA. Si el operario no los rellena no se
    // envía nada (el payload queda igual que hoy).
    let loteInfo: LoteInfo | undefined;
    if (esEntrada) {
      const lote = loteTexto.trim();
      const fecha = fechaTexto.trim();

      if (fecha) {
        if (!REGEX_FECHA.test(fecha)) {
          setError('Caducidad inválida: usa el formato AAAA-MM-DD');
          return;
        }
        const fechaDate = new Date(fecha);
        if (isNaN(fechaDate.getTime())) {
          setError('Caducidad inválida: usa el formato AAAA-MM-DD');
          return;
        }
        loteInfo = {
          ...(lote ? { lote } : {}),
          fechaCaducidad: fechaDate.toISOString(),
        };
      } else if (lote) {
        loteInfo = { lote };
      }
    }

    setError(null);
    onConfirm(cantidad, loteInfo);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modal}>
          {/* Título */}
          <View style={[styles.header, esEntrada ? styles.headerEntrada : styles.headerSalida]}>
            <MaterialCommunityIcons
              name={esEntrada ? 'package-variant' : 'package-variant-closed'}
              size={24}
              color={COLORS.white}
            />
            <Text style={styles.headerText}>{titulo}</Text>
          </View>

          {/* Producto identificado */}
          <View style={styles.productoCard}>
            {productoFotoUrl ? (
              <Image
                source={{ uri: productoFotoUrl }}
                style={styles.foto}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.productoRow}>
              <MaterialCommunityIcons name="qrcode" size={16} color={COLORS.primary} />
              <Text style={styles.productoText} numberOfLines={1}>
                {codigo}
              </Text>
            </View>
            {productoNombre ? (
              <View style={styles.productoRow}>
                <MaterialCommunityIcons name="package-variant" size={16} color={COLORS.primary} />
                <Text style={styles.productoText} numberOfLines={2}>
                  {productoNombre}
                  {productoCodigo ? `  (${productoCodigo})` : ''}
                </Text>
              </View>
            ) : null}
            {binNombre !== undefined && binNombre !== null && (
              <View style={styles.productoRow}>
                <MaterialCommunityIcons name="map-marker" size={16} color={COLORS.primary} />
                <Text style={styles.productoText}>
                  {binNombre ? `Bin: ${binNombre}` : 'Sin bin'}
                </Text>
              </View>
            )}
            {!esEntrada && stockDisponible !== null && (
              <View style={styles.productoRow}>
                <MaterialCommunityIcons name="clipboard-list" size={16} color={COLORS.warning} />
                <Text style={[styles.productoText, { color: COLORS.warning }]}>
                  Stock disponible: {stockDisponible}
                </Text>
              </View>
            )}
          </View>

          {/* Captura de cantidad */}
          <Text style={styles.label}>Cantidad de unidades</Text>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={t => {
              setTexto(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            selectTextOnFocus
            autoFocus
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Lote y caducidad (opcional, solo ENTRADA — backlog P3) */}
          {esEntrada && (
            <View style={styles.loteContainer}>
              <Text style={styles.loteLabel}>Lote (opcional)</Text>
              <TextInput
                style={styles.inputLote}
                value={loteTexto}
                onChangeText={t => {
                  setLoteTexto(t);
                  setError(null);
                }}
                placeholder="N.º de lote"
                placeholderTextColor={COLORS.lightGray}
                maxLength={MAX_LOTE}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={styles.loteLabel}>Caducidad (opcional)</Text>
              <TextInput
                style={styles.inputLote}
                value={fechaTexto}
                onChangeText={t => {
                  setFechaTexto(t);
                  setError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={COLORS.lightGray}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                autoCorrect={false}
              />
            </View>
          )}

          {/* Botones */}
          <View style={styles.botones}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={[styles.buttonText, { color: COLORS.gray }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, esEntrada ? styles.okEntrada : styles.okSalida]}
              onPress={confirmar}
            >
              <Text style={styles.buttonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 15,
  },
  headerEntrada: {
    backgroundColor: COLORS.success,
  },
  headerSalida: {
    backgroundColor: COLORS.error,
  },
  headerText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  foto: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
  productoCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    gap: 6,
  },
  productoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productoText: {
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gray,
    marginBottom: 8,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: COLORS.lightGray,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    textAlign: 'center',
    marginBottom: 10,
  },
  loteContainer: {
    marginBottom: 10,
    gap: 4,
  },
  loteLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gray,
  },
  inputLote: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: COLORS.primary,
    backgroundColor: '#fafafa',
  },
  botones: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  okEntrada: {
    backgroundColor: COLORS.success,
  },
  okSalida: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
