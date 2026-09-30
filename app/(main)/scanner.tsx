/**
 * Pantalla de Escáner QR
 * Usa Clean Architecture
 */
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { QRScanner } from '@/components/QRScanner';
import { ResultModal } from '@/components/ResultModal';
import { useParkingOperation } from '@/src/presentation';
import { TipoOperacion } from '@/src/domain';

export default function ScannerScreen() {
  const params = useLocalSearchParams<{ operation: TipoOperacion }>();
  const router = useRouter();
  const [operationType, setOperationType] = useState<TipoOperacion>('entrada');
  const [modalVisible, setModalVisible] = useState(false);

  const { isLoading, result, executeOperation, reset } = useParkingOperation();

  useEffect(() => {
    if (params.operation) {
      setOperationType(params.operation);
    }
  }, [params.operation]);

  const handleScanSuccess = async (data: string, operation: TipoOperacion) => {
    let qrCodigo = data;
    let categoriaId: string | undefined;

    try {
      const parsed = JSON.parse(data);
      qrCodigo = parsed.codigo || data;
      categoriaId = parsed.categoriaId;
    } catch {}

    await executeOperation(qrCodigo, operation, categoriaId);
  };

  const handleClose = () => {
    router.back();
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    reset();
    router.back();
  };

  // Mostrar modal cuando hay un resultado
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
        isLoading={isLoading}
      />

      <ResultModal
        visible={modalVisible}
        result={result}
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
