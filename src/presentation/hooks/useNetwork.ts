/**
 * useNetwork - Hook para monitorear el estado de la red con auto-sync
 * Detecta cuando se recupera la conexión y dispara la sincronización automáticamente
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { networkService } from '@/src/infrastructure';
import NetInfo from '@react-native-community/netinfo';

interface UseNetworkReturn {
  isConnected: boolean;
  isServerReachable: boolean;
  checkConnection: () => Promise<boolean>;
}

// Callback global para auto-sync (evitar dependencia circular)
let autoSyncCallback: (() => Promise<void>) | null = null;

export function setAutoSyncCallback(callback: (() => Promise<void>) | null) {
  autoSyncCallback = callback;
}

// Intervalos de sondeo al servidor. Estando en línea no hace falta preguntar
// cada 10s: eso es batería y datos móviles en un dispositivo de campo. Se
// sondea rápido solo cuando el servidor no responde, para detectar el regreso
// de la conexión cuanto antes.
const POLL_ONLINE_MS = 60000;
const POLL_OFFLINE_MS = 10000;

export function useNetwork(): UseNetworkReturn {
  const [isConnected, setIsConnected] = useState(true);
  const [isServerReachable, setIsServerReachable] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasOfflineRef = useRef(false);
  const isSyncingRef = useRef(false);
  // Aún no se ha hecho la primera comprobación de esta instancia del hook
  const primeraComprobacionRef = useRef(true);

  const checkServerConnection = useCallback(async () => {
    try {
      const reachable = await networkService.checkConnection();
      setIsServerReachable(reachable);

      // Disparar auto-sync al recuperar la conexión Y también en la primera
      // comprobación con servidor disponible: abrir la app ya conectado no
      // es una transición offline→online, y antes se quedaba sin sincronizar
      // hasta que la red se cayera y volviera.
      const esRecuperacion = wasOfflineRef.current && reachable;
      const esArranqueConectado = primeraComprobacionRef.current && reachable;

      if ((esRecuperacion || esArranqueConectado) && autoSyncCallback && !isSyncingRef.current) {
        isSyncingRef.current = true;
        try {
          await autoSyncCallback();
        } catch (error) {
          // ignore
        } finally {
          isSyncingRef.current = false;
        }
      }

      primeraComprobacionRef.current = false;
      wasOfflineRef.current = !reachable;

      return reachable;
    } catch {
      setIsServerReachable(false);
      primeraComprobacionRef.current = false;
      wasOfflineRef.current = true;
      return false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkServerConnection();
    }, [checkServerConnection])
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? true);
    });

    checkServerConnection();

    return () => {
      unsubscribe();
    };
  }, [checkServerConnection]);

  // Sondeo periódico con cadencia adaptativa: se reprograma solo cuando
  // cambia el estado del servidor (60s en línea, 10s sin conexión).
  useEffect(() => {
    const intervalo = isServerReachable ? POLL_ONLINE_MS : POLL_OFFLINE_MS;

    intervalRef.current = setInterval(() => {
      checkServerConnection();
    }, intervalo);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isServerReachable, checkServerConnection]);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      setIsConnected(false);
      setIsServerReachable(false);
      return false;
    }

    setIsConnected(true);
    return await checkServerConnection();
  }, [checkServerConnection]);

  return {
    isConnected,
    isServerReachable,
    checkConnection,
  };
}
