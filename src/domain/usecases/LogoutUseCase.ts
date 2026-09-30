/**
 * Use Case: LogoutUseCase
 * Maneja el cierre de sesión
 */
import { AuthRepository } from '@/src/domain';

export class LogoutUseCase {
  constructor(private authRepository: AuthRepository) {}

  async execute(): Promise<void> {
    try {
      // Intentar logout en servidor
      const sesion = await this.authRepository.obtenerSesionLocal();
      if (sesion && sesion.token !== 'offline-token') {
        await this.authRepository.logout(sesion.token);
      }
    } catch (error) {
      // Ignorar errores de red al hacer logout
    } finally {
      // Siempre eliminar sesión local
      await this.authRepository.eliminarSesionLocal();
    }
  }
}
