/**
 * Repository Interface: SyncRepository
 * Define las operaciones de sincronización
 */
import { SyncData, SyncResult, MovimientoPendiente } from '../entities';

export interface SyncRepository {
  /**
   * Inicia la sincronización con el servidor
   */
  sincronizar(data: SyncData): Promise<SyncResult>;

  /**
   * Verifica si hay conexión con el servidor
   */
  hayConexion(): Promise<boolean>;

  /**
   * Obtiene la fecha de última sincronización
   */
  obtenerUltimaSincronizacion(): Promise<Date | null>;

  /**
   * Guarda la fecha de última sincronización
   */
  guardarUltimaSincronizacion(fecha: Date): Promise<void>;

  /**
   * Envía movimientos pendientes al servidor
   */
  enviarMovimientosPendientes(movimientos: MovimientoPendiente[]): Promise<SyncResult>;

  /**
   * Descarga datos actualizados del servidor
   */
  descargarDatosActualizados(): Promise<{
    precios: number;
    tiposMedio: number;
    usuarios: number;
  }>;
}
