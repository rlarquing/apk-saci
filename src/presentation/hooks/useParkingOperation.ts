/**
 * useParkingOperation - Hook para operaciones de almacen
 * Usa Clean Architecture con soporte offline-first
 */
import { useState, useCallback } from 'react';
import { 
  Movimiento, 
  TipoOperacion, 
  ResultadoOperacion 
} from '@/src/domain';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { useAuth } from '@/src/presentation/contexts/AuthContext';

interface UseParkingOperationReturn {
  isLoading: boolean;
  result: ResultadoOperacion | null;
  executeOperation: (qrData: string, operation: TipoOperacion, categoriaId?: string) => Promise<void>;
  reset: () => void;
}

export function useParkingOperation(): UseParkingOperationReturn {
  const { sesion } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultadoOperacion | null>(null);

  const executeOperation = useCallback(
    async (qrData: string, operation: TipoOperacion, categoriaId?: string) => {
      if (!sesion?.almacenSeleccionado || !sesion.usuario) {
        setResult({
          exito: false,
          movimiento: null,
          mensaje: 'No hay almacen seleccionado',
          tipo: operation,
        });
        return;
      }

      setIsLoading(true);
      setResult(null);

      try {
        let resultado: ResultadoOperacion;

        if (operation === 'entrada') {
          resultado = await serviceContainer.registrarEntrada.execute(
            qrData,
            sesion.almacenSeleccionado.id,
            sesion.usuario.id,
            categoriaId
          );
        } else {
          resultado = await serviceContainer.registrarSalida.execute(
            qrData,
            sesion.almacenSeleccionado.id,
            sesion.usuario.id
          );
        }

        setResult(resultado);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        
        setResult({
          exito: false,
          movimiento: null,
          mensaje: errorMessage,
          tipo: operation,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sesion]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setResult(null);
  }, []);

  return {
    isLoading,
    result,
    executeOperation,
    reset,
  };
}
