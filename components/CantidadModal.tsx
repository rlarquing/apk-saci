/**
 * Modal de captura de cantidad
 * Paso intermedio del escáner: tras validar la etiqueta (o resolver el SKU),
 * el operador indica cuántas unidades entran o salen. La cantidad es LA
 * diferencia central respecto de un ticket de un solo uso.
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../src/shared/constants';
import { TipoOperacion } from '../src/domain/entities';

/** Límite de cantidad del API: CreateEntradaDto (0.01 - 999999.99) */
const MAX_CANTIDAD = 999999.99;
const REGEX_CANTIDAD = /^\d{1,6}([.,]\d{1,2})?$/;

interface CantidadModalProps {
  visible: boolean;
  operation: TipoOperacion;
  codigo: string;
  productoNombre: string;
  productoCodigo: string;
  /** Stock conocido del producto en el almacén (null: sin dato local) */
  stockDisponible: number | null;
  onCancel: () => void;
  onConfirm: (cantidad: number) => void;
}

export function CantidadModal({
  visible,
  operation,
  codigo,
  productoNombre,
  productoCodigo,
  stockDisponible,
  onCancel,
  onConfirm,
}: CantidadModalProps) {
  const [texto, setTexto] = useState('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTexto('1');
      setError(null);
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

    setError(null);
    onConfirm(cantidad);
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
