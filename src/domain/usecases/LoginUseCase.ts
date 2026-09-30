/**
 * Use Case: LoginUseCase
 * Maneja la autenticación de usuarios con estrategia online-first
 * 
 * Estrategia:
 * 1. Intenta login directo al API (sin health-check previo para evitar round-trips extra)
 * 2. Si el API responde 401 → credenciales incorrectas (NO fallback offline)
 * 3. Si el API no responde (error de red) → fallback a credenciales offline
 * 4. Si no hay credenciales offline → error
 */
import { AuthRepository } from '@/src/domain';
import {
  Credenciales,
  Sesion,
  AccesoMovilDenegadoError,
  puedeOperarEnMovil,
} from '../entities';

export class LoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(credenciales: Credenciales): Promise<Sesion> {
    // 1. Intentar login directo al API (online-first)
    try {
      const sesion = await this.authRepository.login(credenciales);

      // Regla de acceso por rol. Se valida ANTES de persistir para no dejar
      // sesión ni credenciales offline cacheadas de un usuario no habilitado.
      if (!puedeOperarEnMovil(sesion.usuario)) {
        throw new AccesoMovilDenegadoError();
      }

      // Guardar sesión localmente
      await this.authRepository.guardarSesionLocal(sesion);

      // Guardar credenciales para login offline futuro
      await this.authRepository.guardarCredencialesOffline({
        userName: credenciales.userName,
        passwordHash: this.hashPassword(credenciales.password),
        usuarioJson: JSON.stringify(sesion.usuario),
        syncedAt: new Date(),
      });

      return sesion;
    } catch (error: any) {
      // Acceso denegado por rol: decisión firme, nunca degradar a login offline.
      // Va primero porque no lleva statusCode y la heurística de red de abajo
      // lo confundiría con una caída del servidor.
      if (error instanceof AccesoMovilDenegadoError) {
        throw error;
      }

      // Si es error de credenciales (401), NO intentar offline - el usuario se equivocó
      if (error?.statusCode === 401 || error?.isUnauthorized?.()) {
        throw new Error('Credenciales inválidas');
      }

      // Si es error de red (statusCode 0, 408, timeout, etc.), intentar fallback offline
      const isNetworkError = !error?.statusCode || error?.statusCode === 0 || 
                             error?.statusCode === 408 || error?.isNetworkError?.() ||
                             error?.isTimeout?.();
      
      if (!isNetworkError) {
        // Otro tipo de error del servidor (500, 403, etc.) - no intentar offline
        throw error;
      }
    }

    // 2. Fallback: verificar sesión local para el mismo usuario
    const sesionLocal = await this.authRepository.obtenerSesionLocal();

    if (sesionLocal) {
      const isSameUser = sesionLocal.usuario.nombre === credenciales.userName ||
                         sesionLocal.usuario.email === credenciales.userName;
      const isExpired = new Date(sesionLocal.expiresAt) < new Date();

      if (isSameUser && (!isExpired || sesionLocal.token === 'offline-token')) {
        // La sesión guardada puede ser anterior a esta regla o el rol puede
        // haber cambiado en el servidor desde el último login online.
        if (!puedeOperarEnMovil(sesionLocal.usuario)) {
          await this.authRepository.eliminarSesionLocal();
          throw new AccesoMovilDenegadoError();
        }
        return sesionLocal;
      }
    }

    // 3. Fallback: intentar login offline con credenciales guardadas
    const usuarioOffline = await this.authRepository.verificarCredencialesOffline(
      credenciales.userName,
      credenciales.password
    );

    if (usuarioOffline) {
      // Credenciales cacheadas de un usuario que hoy no puede operar en móvil
      if (!puedeOperarEnMovil(usuarioOffline)) {
        throw new AccesoMovilDenegadoError();
      }

      const almacenes = usuarioOffline.almacenesAsignados || [];
      const sesionOffline: Sesion = {
        usuario: usuarioOffline,
        token: 'offline-token',
        refreshToken: 'offline-refresh-token',
        almacenSeleccionado: almacenes.length === 1 ? almacenes[0] : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await this.authRepository.guardarSesionLocal(sesionOffline);
      return sesionOffline;
    }

    // 4. No hay forma de autenticar
    throw new Error('Sin conexión al servidor. No hay credenciales offline guardadas para este usuario.');
  }

  private hashPassword(password: string): string {
    // Hash simple para validación offline
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}
