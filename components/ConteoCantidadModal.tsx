/**
 * Modal de captura de cantidad CONTADA para el conteo cíclico (backlog P1).
 * Diferencias respecto de CantidadModal (entradas/salidas):
 * - El 0 es una cantidad válida (el producto puede estar a cero).
 * - No valida stock: aquí la cantidad física es la verdad.
 * - Muestra el stock esperado solo si el conteo NO es a ciegas.
 * - Muestra la foto del producto si está disponible (endpoint público).
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

/** Límite de cantidad del API: ConteoLineaDto (0 - 999999.99) */
const MAX_CANTIDAD = 999999.99;
const REGEX_CANTIDAD = /^\d{1,6}([.,]\d{1,2})?$/;

interface ConteoCantidadModalProps {
  visible: boolean;
  codigo: string;
  productoNombre: string;
  productoCodigo: string;
  /** Stock esperado (null: conteo a ciegas) */
  cantidadEsperada: number | null;
  productoFotoUrl?: string | null;
  onCancel: () => void;
  onConfirm: (cantidad: number) => void;
  guardando?: boolean;
}

export function ConteoCantidadModal({
  visible,
  codigo,
  productoNombre,
  productoCodigo,
  cantidadEsperada,
  productoFotoUrl,
  onCancel,
  onConfirm,
  guardando = false,
}: ConteoCantidadModalProps) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTexto('');
      setError(null);
    }
  }, [visible]);

  const confirmar = () => {
    const normalizado = texto.replace(',', '.').trim();

    if (!REGEX_CANTIDAD.test(normalizado)) {
      setError('Ingrese una cantidad válida (hasta 6 enteros y 2 decimales)');
      return;
    }

    const cantidad = parseFloat(normalizado);
    if (cantidad < 0) {
      setError('La cantidad no puede ser negativa');
      return;
    }
    if (cantidad > MAX_CANTIDAD) {
      setError('La cantidad excede el máximo permitido');
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
          <View style={styles.header}>
            <MaterialCommunityIcons name="clipboard-check" size={24} color={COLORS.white} />
            <Text style={styles.headerText}>Cantidad Contada</Text>
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
            {cantidadEsperada !== null && (
              <View style={styles.productoRow}>
                <MaterialCommunityIcons name="clipboard-list" size={16} color={COLORS.gray} />
                <Text style={[styles.productoText, { color: COLORS.gray }]}>
                  Esperado según sistema: {cantidadEsperada}
                </Text>
              </View>
            )}
          </View>

          {/* Captura de cantidad */}
          <Text style={styles.label}>Unidades contadas físicamente</Text>
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
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={guardando}>
              <Text style={[styles.buttonText, { color: COLORS.gray }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.okConteo]} onPress={confirmar} disabled={guardando}>
              <Text style={styles.buttonText}>{guardando ? 'Guardando…' : 'Confirmar'}</Text>
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
    backgroundColor: COLORS.primary,
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  botones: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  okConteo: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
