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
              name={isSuccess ? (isEntry ? 'car-side' : 'hand-wave') : 'close-circle'}
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
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="qrcode" size={18} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  QR: {movimiento.qrCodigo}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="car" size={18} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  Tipo: {movimiento.categoriaNombre}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  Almacen: {movimiento.almacenNombre}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="calendar-clock" size={18} color={COLORS.primary} />
                <Text style={styles.detailText}>
                  Entrada: {new Date(movimiento.fechaEntrada).toLocaleString()}
                </Text>
              </View>

              {/* Datos específicos de salida: no se muestra monto, ya se cobró al entrar */}
              {!isEntry && movimiento.fechaSalida && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.detailText}>
                    Salida: {new Date(movimiento.fechaSalida).toLocaleString()}
                  </Text>
                </View>
              )}

              {/* Monto a cobrar: el cobro ocurre en la entrada */}
              {isEntry && movimiento.precioUnitarioCobrado > 0 && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="cash-multiple" size={18} color={COLORS.primary} />
                  <Text style={styles.detailText}>
                    Cobrar: ${movimiento.precioUnitarioCobrado.toFixed(2)}
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
