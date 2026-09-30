/**
 * Domain Entity: QR
 * Representa una ETIQUETA QR reutilizable asignada a un producto.
 * A diferencia del ticket de un solo uso, la etiqueta pasa por el ciclo:
 * disponible → asignado (tiene producto) → puede recibir entradas y salidas
 * mientras no esté anulada. Campos alineados con ReadQrDto del API (api-saci).
 */
export type EstadoQR = 'disponible' | 'asignado' | 'anulado';

export interface QR {
  id: string;
  codigo: string;
  numeroConsecutivo: number;
  productoId: string | null;
  productoNombre: string | null;
  productoCodigo: string | null;
  almacenId: string | null;
  almacenNombre: string | null;
  loteId: string | null;
  estado: EstadoQR;
  activo: boolean;
  fechaGeneracion: Date | null;
  createdAt: Date;
}

/**
 * Resultado de escanear un QR
 * `puedeEntrar` es true siempre que la etiqueta no esté anulada;
 * `puedeSalir` solo cuando tiene producto asignado (estado 'asignado').
 */
export interface ResultadoEscaneoQR {
  valido: boolean;
  qr: QR | null;
  mensaje: string;
  puedeEntrar: boolean;
  puedeSalir: boolean;
}
