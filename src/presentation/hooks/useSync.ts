/**
 * useSync - Hook para sincronización
 */
import { useState, useCallback } from 'react';
import { SyncResult } from '@/src/domain';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { SincronizarCallbacks } from '@/src/domain';

interface UseSyncReturn {
  isSyncing: boolean;
  progress: number;
  progressMessage: string;
  lastSyncResult: SyncResult | null;
  sync: (callbacks?: SincronizarCallbacks) => Promise<SyncResult>;
  getPendingCount: () => Promise<number>;
  getLastSyncDate: () => Promise<Date | null>;
}

export function useSync(): UseSyncReturn {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const sync = useCallback(async (callbacks?: SincronizarCallbacks): Promise<SyncResult> => {
    setIsSyncing(true);
    setProgress(0);
    setProgressMessage('Iniciando sincronización...');

    const result = await serviceContainer.sincronizar.execute({
      onProgress: (prog, msg) => {
        setProgress(prog);
        setProgressMessage(msg);
        callbacks?.onProgress?.(prog, msg);
      },
      onComplete: (res) => {
        setLastSyncResult(res);
        callbacks?.onComplete?.(res);
      },
      onError: (error) => {
        callbacks?.onError?.(error);
      },
    });

    setIsSyncing(false);
    return result;
  }, []);

  const getPendingCount = useCallback(async (): Promise<number> => {
    return await serviceContainer.localMovimiento.obtenerCantidadPendientes();
  }, []);

  const getLastSyncDate = useCallback(async (): Promise<Date | null> => {
    return await serviceContainer.localConfig.obtenerUltimaSincronizacion();
  }, []);

  return {
    isSyncing,
    progress,
    progressMessage,
    lastSyncResult,
    sync,
    getPendingCount,
    getLastSyncDate,
  };
}
