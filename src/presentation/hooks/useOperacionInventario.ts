/**
 * useOperacionInventario - Hook para operaciones de entrada/salida
 * Usa Clean Architecture con soporte offline-first
 */
import { useState, useCallback } from 'react';
import {
  TipoOperacion,
  ResultadoOperacion,
  LoteInfo
} from '@/src/domain';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { useAuth } from '@/src/presentation/contexts/AuthContext';

interface UseOperacionInventarioReturn {
  isLoading: boolean;
  result: ResultadoOperacion | null;
  /**
   * Ejecuta la operación sobre un código escaneado (etiqueta QR-XXXXXX) o
   * tecleado (SKU PRD-XXXXXX), con la cantidad capturada en el modal.
   * `loteInfo` (opcional, P3) solo lo envía la ENTRADA cuando el operario
   * capturó lote/caducidad; si no viene, el payload queda igual que hoy.
   */
  executeOperacion: (
    codigo: string,
    operation: TipoOperacion,
    cantidad: number,
    loteInfo?: LoteInfo
  ) => Promise<void>;
  reset: () => void;
}

export function useOperacionInventario(): UseOperacionInventarioReturn {
  const { sesion } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultadoOperacion | null>(null);

  const executeOperacion = useCallback(
    async (codigo: string, operation: TipoOperacion, cantidad: number, loteInfo?: LoteInfo) => {
      if (!sesion?.almacenSeleccionado || !sesion.usuario) {
        setResult({
          exito: false,
          movimiento: null,
          mensaje: 'No hay almacén seleccionado',
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
            codigo,
            sesion.almacenSeleccionado.id,
            cantidad,
            undefined,
            loteInfo
          );
        } else {
          resultado = await serviceContainer.registrarSalida.execute(
            codigo,
            sesion.almacenSeleccionado.id,
            cantidad,
            undefined,
            loteInfo
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
    executeOperacion,
    reset,
  };
}
