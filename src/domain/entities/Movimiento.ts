/**
 * Domain Entity: Movimiento
 * Representa un movimiento de inventario (entrada o salida) en un almacen.
 * A diferencia de un ticket, cada movimiento es un registro independiente e
 * inmutable con su cantidad. Campos alineados con la API (api-saci).
 */
export type TipoOperacion = 'entrada' | 'salida';

export interface Movimiento {
  id: string;
  tipo: TipoOperacion;
  /** Código de la etiqueta QR escaneada (null en registro manual por SKU) */
  qrCodigo: string | null;
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  categoriaNombre: string;
  almacenId: string;
  almacenNombre: string;
  /** Cantidad de unidades movidas (0.01 - 999999.99) */
  cantidad: number;
  fecha: Date;
  observaciones: string | null;
  sincronizado: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos para registrar un movimiento (entrada o salida).
 * Shape alineado con CreateEntradaDto/CreateSalidaDto del API:
 * requiere qrCodigo o productoId, mas almacenId y cantidad.
 */
export interface RegistrarMovimientoData {
  qrCodigo?: string;
  productoId?: string;
  almacenId: string;
  cantidad: number;
  /**
   * Fecha real del movimiento en ISO. Solo la llevan los pendientes offline:
   * la operación en vivo no la manda y el servidor estampa la hora actual.
   * El API rechaza fechas futuras o de hace más de 7 días.
   */
  fecha?: string;
  observaciones?: string;
  /** Lote de la mercancía (≤50; opcional, capturado en la entrada — P3) */
  lote?: string;
  /** Caducidad del lote en ISO (opcional — P3) */
  fechaCaducidad?: string;
}

/**
 * Información opcional de lote/caducidad capturada en el modal de cantidad
 * (solo entradas — P3). Si el operario no la rellena no se envía nada.
 */
export interface LoteInfo {
  lote?: string;
  fechaCaducidad?: string;
}

/**
 * Resultado de una operación de inventario
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
  data: RegistrarMovimientoData;
  createdAt: Date;
  reintentos: number;
}
