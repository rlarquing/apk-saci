/**
 * Local DataSource: Configuración
 * Maneja la configuración y estado de sincronización
 */
import { executeQueryFirst, executeUpdate } from '@/src/infrastructure';
import { CONFIG_KEYS } from '@/src/infrastructure';

export class ConfigLocalDataSource {
  async guardarConfiguracion(clave: string, valor: string): Promise<void> {
    await executeUpdate(
      `INSERT OR REPLACE INTO configuracion (clave, valor, updated_at) VALUES (?, ?, ?)`,
      [clave, valor, new Date().toISOString()]
    );
  }

  async obtenerConfiguracion(clave: string): Promise<string | null> {
    const row = await executeQueryFirst<{ valor: string }>(
      `SELECT valor FROM configuracion WHERE clave = ?`,
      [clave]
    );
    return row?.valor || null;
  }

  async guardarUltimaSincronizacion(fecha: Date): Promise<void> {
    await this.guardarConfiguracion(CONFIG_KEYS.LAST_SYNC, fecha.toISOString());
  }

  async obtenerUltimaSincronizacion(): Promise<Date | null> {
    const valor = await this.obtenerConfiguracion(CONFIG_KEYS.LAST_SYNC);
    return valor ? new Date(valor) : null;
  }

  async guardarApiUrl(url: string): Promise<void> {
    await this.guardarConfiguracion(CONFIG_KEYS.API_URL, url);
  }

  async obtenerApiUrl(): Promise<string | null> {
    return await this.obtenerConfiguracion(CONFIG_KEYS.API_URL);
  }

  async guardarUserId(userId: string): Promise<void> {
    await this.guardarConfiguracion(CONFIG_KEYS.USER_ID, userId);
  }

  async obtenerUserId(): Promise<string | null> {
    return await this.obtenerConfiguracion(CONFIG_KEYS.USER_ID);
  }

  /**
   * Bandera de primera sincronización: marca si la base local ya fue poblada
   * desde el servidor tras un login online. Se resetea al cerrar sesión para
   * que el próximo login vuelva a descargar los datos.
   */
  async guardarPrimeraSyncCompletada(completada: boolean): Promise<void> {
    await this.guardarConfiguracion(CONFIG_KEYS.FIRST_SYNC_DONE, completada ? '1' : '0');
  }

  async obtenerPrimeraSyncCompletada(): Promise<boolean> {
    return await this.obtenerConfiguracion(CONFIG_KEYS.FIRST_SYNC_DONE) === '1';
  }
}
