/**
 * Domain Entity: Movimiento
 * Representa un movimiento de entrada/salida en un almacen
 * Campos alineados con la API (api-saci)
 */
export type TipoOperacion = 'entrada' | 'salida';

export interface Movimiento {
  id: string;
  qrCodigo: string;
  almacenId: string;
  almacenNombre: string;
  categoriaId: string;
  categoriaNombre: string;
  precioId: string;
  precioUnitarioCobrado: number;
  fechaEntrada: Date;
  fechaSalida: Date | null;
  sincronizado: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos para registrar una entrada
 */
export interface RegistrarEntradaData {
  qrCodigo: string;
  almacenId: string;
  categoriaId: string;
  precioId: string;
  /** Monto que se cobra al entrar (el precio es fijo, no por tiempo) */
  precioMonto: number;
  /**
   * Fecha real del cobro en ISO. Solo la llevan los pendientes offline: la
   * entrada en vivo no la manda y el servidor estampa la hora actual.
   */
  fechaEntrada?: string;
}

/**
 * Datos para registrar una salida
 */
export interface RegistrarSalidaData {
  movimientoId: string;
  qrCodigo: string;
  almacenId: string;
  /** Fecha real de la salida en ISO (solo pendiente offline; opcional) */
  fechaSalida?: string;
}

/**
 * Resultado de una operación de almacen
 */
export interface ResultadoOperacion {
  exito: boolean;
  movimiento: Movimiento | null;
  mensaje: string;
  tipo: TipoOperacion;
}

/**
 * Movimiento pendiente de sincronización
 */
export interface MovimientoPendiente {
  idLocal: string;
  operacion: TipoOperacion;
  data: RegistrarEntradaData | RegistrarSalidaData;
  createdAt: Date;
  reintentos: number;
}
