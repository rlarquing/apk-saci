/**
 * Escáner QR
 * Usa los tipos de Clean Architecture
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../src/shared/constants';
import { TipoOperacion } from '../src/domain/entities';

// Configuración del escáner
const SCANNER_CONFIG = {
  scanInterval: 2000, // 2 segundos entre escaneos
  vibrateOnScan: true,
};

interface QRScannerProps {
  operationType: TipoOperacion;
  onScanSuccess: (data: string, operation: TipoOperacion) => void;
  onScanError: (error: string) => void;
  onClose: () => void;
  isLoading?: boolean;
}

export function QRScanner({
  operationType,
  onScanSuccess,
  onScanError,
  onClose,
  isLoading = false,
}: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const lastScanTime = useRef<number>(0);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // Evitar escaneos múltiples muy seguidos
    const now = Date.now();
    if (scanned || now - lastScanTime.current < SCANNER_CONFIG.scanInterval) {
      return;
    }

    lastScanTime.current = now;
    setScanned(true);

    // Vibrar al escanear
    if (SCANNER_CONFIG.vibrateOnScan) {
      Vibration.vibrate(200);
    }

    // Procesar el QR escaneado
    onScanSuccess(data, operationType);
  };

  const handleRescan = () => {
    setScanned(false);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.text}>Solicitando permisos de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <MaterialCommunityIcons name="camera-off" size={48} color={COLORS.lightGray} />
        <Text style={styles.text}>No tienes acceso a la cámara</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <MaterialCommunityIcons name="camera-enhance" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>Otorgar Permiso</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Overlay positioned on top of camera using absolute positioning */}
      <View style={styles.overlay}>
        {/* Marco de escaneo */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {/* Indicador de operación */}
        <View style={styles.operationIndicator}>
          <MaterialCommunityIcons
            name={operationType === 'entrada' ? 'car-side' : 'car-back'}
            size={22}
            color={COLORS.white}
          />
          <Text style={styles.operationText}>
            {operationType === 'entrada' ? 'ENTRADA' : 'SALIDA'}
          </Text>
        </View>

        {/* Instrucciones */}
        <View style={styles.instructionsContainer}>
          <MaterialCommunityIcons
            name="qrcode-scan"
            size={20}
            color={COLORS.white}
          />
          <Text style={styles.instructions}>
            {isLoading ? 'Procesando...' : 'Escanea el código QR del vehículo'}
          </Text>
        </View>
      </View>

      {/* Botones de control */}
      <View style={styles.controls}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
          </View>
        )}

        {scanned && !isLoading && (
          <TouchableOpacity style={styles.rescanButton} onPress={handleRescan}>
            <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.white} />
            <Text style={styles.buttonText}>Escanear Otro</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={20} color={COLORS.white} />
          <Text style={styles.buttonText}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.accent,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  operationIndicator: {
    position: 'absolute',
    top: 50,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  operationText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  instructions: {
    color: COLORS.white,
    fontSize: 16,
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
  },
  rescanButton: {
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  closeButton: {
    backgroundColor: COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  button: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
});
