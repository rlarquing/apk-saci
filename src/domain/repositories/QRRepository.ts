/**
 * Repository Interface: QRRepository
 * Define las operaciones de etiquetas QR reutilizables
 */
import { QR, ResultadoEscaneoQR, EstadoQR } from '../entities';

export interface QRRepository {
  /**
   * Valida un código QR contra el servidor (con fallback offline al cache)
   */
  validarQR(codigo: string, almacenId: string): Promise<ResultadoEscaneoQR>;

  /**
   * Guarda etiquetas localmente para uso offline
   */
  guardarQRsLocal(qrs: QR[]): Promise<void>;

  /**
   * Obtiene etiquetas guardadas localmente
   */
  obtenerQRsLocal(): Promise<QR[]>;

  /**
   * Busca una etiqueta en el cache local
   */
  buscarQRLocal(codigo: string): Promise<QR | null>;

  /**
   * Actualiza el estado de una etiqueta en el cache local.
   * Se usa tras una entrada exitosa (disponible → asignado) para que las
   * validaciones offline del escáner reflejen el nuevo estado sin esperar
   * a la próxima sincronización.
   */
  actualizarEstadoLocal(codigo: string, estado: EstadoQR): Promise<void>;

  /**
   * Sincroniza etiquetas desde el servidor (purge + replace)
   */
  sincronizarQRs(): Promise<number>;
}
