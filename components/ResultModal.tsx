/**
 * Modal de Resultado de Operación
 * Usa los tipos de Clean Architecture
 * Campos alineados con la API (api-saci)
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../src/shared/constants';
import { ResultadoOperacion, TipoOperacion } from '../src/domain/entities';

interface ResultModalProps {
  visible: boolean;
  result: ResultadoOperacion | null;
  operationType: TipoOperacion;
  onClose: () => void;
}

export function ResultModal({
  visible,
  result,
  operationType,
  onClose,
}: ResultModalProps) {
  if (!result) return null;

  const isSuccess = result.exito;
  const isEntry = operationType === 'entrada';
  const movimiento = result.movimiento;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modal,
            isSuccess ? styles.successModal : styles.errorModal,
          ]}
        >
          {/* Icono */}
          <View style={[styles.iconContainer, isSuccess ? styles.successIconBg : styles.errorIconBg]}>
            <MaterialCommunityIcons
              name={isSuccess ? (isEntry ? 'package-variant' : 'package-variant-closed') : 'close-circle'}
              size={48}
              color={COLORS.white}
            />
          </View>

          {/* Título */}
          <Text style={styles.title}>
            {isSuccess
              ? isEntry
                ? 'Entrada Registrada'
                : 'Salida Registrada'
              : 'Error'}
          </Text>

          {/* Mensaje */}
          <Text style={styles.message}>{result.mensaje}</Text>

          {/* Detalles */}
          {isSuccess && movimiento && (
            <View style={styles.details}>
              {movimiento.qrCodigo && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="qrcode" size={18} color={COLORS.primary} />
                  <Text style={styles.detailText}>
                    Etiqueta: {movimiento.qrCodigo}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="package-variant" size={18} color={COLORS.primary} />
                <Text style={styles.detailText} numberOfLines={2}>
                  Producto: {movimiento.productoNombre}
                  {movimiento.productoCodigo ? ` (${movimiento.productoCodigo})` : ''}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name={isEntry ? 'arrow-down-bold' : 'arrow-up-bold'}
                  size={18}
                  color={isEntry ? COLORS.success : COLORS.error}
                />
                <Text style={[styles.detailText, { fontWeight: 'bold' }]}>
                  Cantidad: {movimiento.cantidad}
                  {movimiento.categoriaNombre ? ` (${movimiento.categoriaNombre})` : ''}
                </Text>
              </View>

              {!!movimiento.almacenNombre && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="warehouse" size={18} color={COLORS.primary} />
                  <Text style={styles.detailText}>
                    Almacén: {movimiento.almacenNombre}
                  </Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  Fecha: {new Date(movimiento.fecha).toLocaleString()}
                </Text>
              </View>

              {!!movimiento.observaciones && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="text" size={18} color={COLORS.primary} />
                  <Text style={styles.detailText}>
                    Obs.: {movimiento.observaciones}
                  </Text>
                </View>
              )}

              {/* Indicador de sincronización */}
              {!movimiento.sincronizado && (
                <View style={styles.pendingSyncContainer}>
                  <MaterialCommunityIcons name="alert" size={16} color={COLORS.warning} />
                  <Text style={styles.pendingSync}>
                    Pendiente de sincronizar
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Botón cerrar */}
          <TouchableOpacity
            style={[styles.button, isSuccess ? styles.successButton : styles.errorButton]}
            onPress={onClose}
          >
            <MaterialCommunityIcons name="check" size={20} color={COLORS.white} />
            <Text style={styles.buttonText}>Aceptar</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    padding: 30,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  successModal: {
    borderTopWidth: 5,
    borderTopColor: COLORS.success,
  },
  errorModal: {
    borderTopWidth: 5,
    borderTopColor: COLORS.error,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  successIconBg: {
    backgroundColor: COLORS.success,
  },
  errorIconBg: {
    backgroundColor: COLORS.error,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 20,
  },
  details: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.primary,
    flex: 1,
  },
  pendingSyncContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  pendingSync: {
    fontSize: 12,
    color: COLORS.warning,
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    gap: 6,
  },
  successButton: {
    backgroundColor: COLORS.success,
  },
  errorButton: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
