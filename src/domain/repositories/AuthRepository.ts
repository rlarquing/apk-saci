/**
 * Repository Interface: AuthRepository
 * Define las operaciones de autenticación
 */
import { Usuario, Credenciales, Sesion, CredencialesOffline } from '../entities';

export interface AuthRepository {
  /**
   * Autentica un usuario contra el servidor
   */
  login(credenciales: Credenciales): Promise<Sesion>;

  /**
   * Refresca el token de acceso
   */
  refreshToken(refreshToken: string): Promise<Sesion>;

  /**
   * Cierra la sesión en el servidor
   */
  logout(token: string): Promise<void>;

  /**
   * Guarda la sesión localmente
   */
  guardarSesionLocal(sesion: Sesion): Promise<void>;

  /**
   * Obtiene la sesión guardada localmente
   */
  obtenerSesionLocal(): Promise<Sesion | null>;

  /**
   * Elimina la sesión local
   */
  eliminarSesionLocal(): Promise<void>;

  /**
   * Guarda credenciales para login offline
   */
  guardarCredencialesOffline(credenciales: CredencialesOffline): Promise<void>;

  /**
   * Obtiene credenciales offline
   */
  obtenerCredencialesOffline(userName: string): Promise<CredencialesOffline | null>;

  /**
   * Verifica credenciales localmente (offline)
   */
  verificarCredencialesOffline(userName: string, password: string): Promise<Usuario | null>;

  /**
   * Selecciona un almacen para la sesión actual
   */
  seleccionarAlmacen(almacenId: string): Promise<void>;

  /**
   * Solicitar código de recuperación de contraseña
   */
  requestResetPassword(email: string): Promise<{ successStatus: boolean; message: string }>;

  /**
   * Restablecer contraseña con código
   */
  resetPassword(resetPasswordCode: number, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }>;

  /**
   * Cambiar contraseña (usuario autenticado)
   */
  changePassword(oldPassword: string, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }>;

  /**
   * PURGA: Limpia credenciales offline antiguas
   */
  limpiarCredencialesAntiguas(diasAntiguedad: number): Promise<void>;
}
