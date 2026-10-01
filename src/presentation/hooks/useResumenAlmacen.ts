/**
 * useResumenAlmacen - Hook para obtener el resumen del almacen
 *
 * El resumen se refresca en tres momentos:
 * 1. Al montar/cambiar el almacen seleccionado.
 * 2. Cada 30s (polling) mientras la app está en primer plano: la operación se
 *    registra en el ledger local del teléfono al instante, pero el merge con
 *    el servidor (salidas hechas por la web, cierre automático del día, etc.)
 *    necesita refrescos periódicos.
 * 3. Manualmente vía refresh() (pull-to-refresh, post-scan, post-sync).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { ResumenAlmacen } from '@/src/domain';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';
import { alertasLocalesService } from '@/src/infrastructure/alerts/AlertasLocales';
import { useAuth } from '@/src/presentation/contexts/AuthContext';

// Polling del resumen en primer plano. No es la misma cadencia que el
// health-check de useNetwork: esta llamada además reconcilia y mergea datos.
const REFRESH_INTERVAL_MS = 30000;

interface UseResumenAlmacenReturn {
  resumen: ResumenAlmacen | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResumenAlmacen(): UseResumenAlmacenReturn {
  const { sesion } = useAuth();
  const [resumen, setResumen] = useState<ResumenAlmacen | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refrescoEnCursoRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchResumen = useCallback(async () => {
    if (!sesion?.almacenSeleccionado) {
      setResumen(null);
      setIsLoading(false);
      return;
    }

    // Evitar solapamientos: el polling, el focus effect y el pull-to-refresh
    // pueden dispararse casi a la vez y pisarse entre sí.
    if (refrescoEnCursoRef.current) return;
    refrescoEnCursoRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const result = await serviceContainer.obtenerResumen.execute(
        sesion.almacenSeleccionado.id
      );
      setResumen(result);
      // Push local: notificar SOLO productos recién caídos bajo el punto de
      // reorden (backlog P2). Best-effort; ignora permisos denegados.
      alertasLocalesService
        .procesarAlertas(result.itemsReponer ?? [], sesion.almacenSeleccionado.id)
        .catch(() => {});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener resumen';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      refrescoEnCursoRef.current = false;
    }
  }, [sesion?.almacenSeleccionado]);

  useEffect(() => {
    fetchResumen();
  }, [fetchResumen]);

  // Polling cada 30s solo con la app en primer plano: en segundo plano no
  // hay nada que mostrar y gastaría batería/datos.
  useEffect(() => {
    if (!sesion?.almacenSeleccionado) return;

    const interval = setInterval(() => {
      if (appStateRef.current === 'active') {
        fetchResumen();
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [sesion?.almacenSeleccionado, fetchResumen]);

  // Track del estado de la app para el guard del polling
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  return {
    resumen,
    isLoading,
    error,
    refresh: fetchResumen,
  };
}
