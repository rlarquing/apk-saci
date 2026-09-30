/**
 * AuthContext - Estado de autenticación con Clean Architecture
 * Incluye: auto-refresh, sesión expirada, cambio de almacen sin logout
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  Sesion,
  Usuario,
  AlmacenAsignado,
  ROLES,
  MENSAJE_ACCESO_MOVIL_DENEGADO,
  puedeOperarEnMovil,
} from '@/src/domain';
import { networkService } from '@/src/infrastructure';
import { serviceContainer } from '@/src/infrastructure/di/ServiceContainer';

interface AuthState {
  sesion: Sesion | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isOffline: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  login: (userName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  seleccionarAlmacen: (almacenId: string) => Promise<void>;
  cambiarAlmacen: (almacenId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  isAdministrador: boolean;
  hasMultipleAlmacenes: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    sesion: null,
    isLoading: true,
    isAuthenticated: false,
    isOffline: false,
    error: null,
  });

  /**
   * Registra el callback de sesión expirada en NetworkService
   */
  useEffect(() => {
    networkService.setOnSessionExpired(() => {
      handleSessionExpired();
    });
  }, []);

  /**
   * Maneja la sesión expirada - limpia la sesión y redirige a login
   */
  const handleSessionExpired = async () => {
    try {
      await serviceContainer.auth.eliminarSesionLocal();
    } catch (e) {
      // ignore
    }
    setState({
      sesion: null,
      isLoading: false,
      isAuthenticated: false,
      isOffline: false,
      error: 'Sesión expirada. Por favor inicie sesión nuevamente.',
    });
  };

  /**
   * Carga la sesión guardada al iniciar
   */
  useEffect(() => {
    loadSavedSession();
  }, []);

  /**
   * Carga la sesión guardada localmente
   */
  const loadSavedSession = async () => {
    try {
      // Verificar si el container está inicializado
      if (!serviceContainer.isInitialized()) {
        await serviceContainer.initialize();
      }

      const sesion = await serviceContainer.auth.obtenerSesionLocal();

      if (sesion) {
        // Regla de acceso por rol: cubre sesiones guardadas antes de que
        // existiera esta validación. Sin esto, un usuario no habilitado
        // seguiría entrando al reabrir la app.
        if (!puedeOperarEnMovil(sesion.usuario)) {
          await serviceContainer.auth.eliminarSesionLocal().catch(() => {});
          setState({
            sesion: null,
            isLoading: false,
            isAuthenticated: false,
            isOffline: false,
            error: MENSAJE_ACCESO_MOVIL_DENEGADO,
          });
          return;
        }

        const isExpired = new Date(sesion.expiresAt) < new Date();

        if (sesion.token === 'offline-token') {
          // Sesión offline - mantenerla
          setState({
            sesion,
            isLoading: false,
            isAuthenticated: true,
            isOffline: true,
            error: null,
          });
        } else if (isExpired) {
          // Token expirado - intentar refresh si hay conexión
          try {
            const hayConexion = await networkService.checkConnection();
            if (hayConexion) {
              const nuevaSesion = await serviceContainer.auth.refreshToken(sesion.refreshToken);
              await serviceContainer.auth.guardarSesionLocal(nuevaSesion);
              setState({
                sesion: nuevaSesion,
                isLoading: false,
                isAuthenticated: true,
                isOffline: false,
                error: null,
              });
            } else {
              // Sin conexión pero token expirado - mantener sesión como offline
              setState({
                sesion: { ...sesion, token: 'offline-token' },
                isLoading: false,
                isAuthenticated: true,
                isOffline: true,
                error: null,
              });
            }
          } catch {
            // Refresh falló con conexión - credenciales inválidas, limpiar sesión
            const hayConexion = await networkService.checkConnection().catch(() => false);
            if (hayConexion) {
              await serviceContainer.auth.eliminarSesionLocal();
              setState(prev => ({ ...prev, isLoading: false }));
            } else {
              // Sin conexión - mantener sesión offline
              setState({
                sesion: { ...sesion, token: 'offline-token' },
                isLoading: false,
                isAuthenticated: true,
                isOffline: true,
                error: null,
              });
            }
          }
        } else {
          // Token válido
          setState({
            sesion,
            isLoading: false,
            isAuthenticated: true,
            isOffline: false,
            error: null,
          });
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  /**
   * Inicia sesión
   */
  const login = async (userName: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const sesion = await serviceContainer.login.execute({ userName, password });
      setState({
        sesion,
        isLoading: false,
        isAuthenticated: true,
        isOffline: sesion.token === 'offline-token',
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al iniciar sesión';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  };

  /**
   * Cierra sesión
   */
  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await serviceContainer.logout.execute();
    } catch (error) {
      // ignore
    } finally {
      // Resetear bandera de primera sincronización: el próximo login vuelve a poblar la base
      try {
        await serviceContainer.localConfig.guardarPrimeraSyncCompletada(false);
      } catch {
        // ignore
      }
      setState({
        sesion: null,
        isLoading: false,
        isAuthenticated: false,
        isOffline: false,
        error: null,
      });
    }
  };

  /**
   * Selecciona un almacen (usado en la pantalla de selección inicial)
   */
  const seleccionarAlmacen = async (almacenId: string) => {
    if (!state.sesion) return;

    try {
      await serviceContainer.auth.seleccionarAlmacen(almacenId);
      
      const almacen = state.sesion.usuario.almacenesAsignados.find(p => p.id === almacenId);
      
      setState(prev => ({
        ...prev,
        sesion: prev.sesion ? {
          ...prev.sesion,
          almacenSeleccionado: almacen || null,
        } : null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al seleccionar almacen';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  };

  /**
   * Cambia el almacen seleccionado sin cerrar sesión
   * Permite al usuario cambiar entre almacenes asignados desde el dashboard
   */
  const cambiarAlmacen = async (almacenId: string) => {
    if (!state.sesion) return;

    try {
      await serviceContainer.auth.seleccionarAlmacen(almacenId);
      
      const almacen = state.sesion.usuario.almacenesAsignados.find(p => p.id === almacenId);
      
      setState(prev => ({
        ...prev,
        sesion: prev.sesion ? {
          ...prev.sesion,
          almacenSeleccionado: almacen || null,
        } : null,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cambiar almacen';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  };

  /**
   * Refresca la sesión
   */
  const refreshSession = async () => {
    if (!state.sesion) return;

    try {
      const nuevaSesion = await serviceContainer.auth.refreshToken(state.sesion.refreshToken);
      await serviceContainer.auth.guardarSesionLocal(nuevaSesion);
      
      setState(prev => ({
        ...prev,
        sesion: nuevaSesion,
        isOffline: false,
      }));
    } catch (error) {
      // ignore
    }
  };

  /**
   * Limpia el error
   */
  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  const isAdministrador = state.sesion?.usuario?.roles?.some(r => r.nombre === ROLES.ADMINISTRADOR) ?? false;
  const hasMultipleAlmacenes = (state.sesion?.usuario?.almacenesAsignados?.length ?? 0) > 1;

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    seleccionarAlmacen,
    cambiarAlmacen,
    refreshSession,
    clearError,
    isAdministrador,
    hasMultipleAlmacenes,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para usar el contexto de autenticación
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}

// Re-export types
export type { AuthState, AuthContextValue };
