/**
 * Repository Interface: QRRepository
 * Define las operaciones de códigos QR
 */
import { QR, ResultadoEscaneoQR } from '../entities';

export interface QRRepository {
  /**
   * Valida un código QR contra el servidor
   */
  validarQR(codigo: string, almacenId: string): Promise<ResultadoEscaneoQR>;

  /**
   * Guarda QRs localmente para uso offline
   */
  guardarQRsLocal(qrs: QR[]): Promise<void>;

  /**
   * Obtiene QRs guardados localmente
   */
  obtenerQRsLocal(): Promise<QR[]>;

  /**
   * Busca un QR en el cache local
   */
  buscarQRLocal(codigo: string): Promise<QR | null>;

  /**
   * Sincroniza QRs desde el servidor
   */
  sincronizarQRs(almacenId: string): Promise<number>;
}
