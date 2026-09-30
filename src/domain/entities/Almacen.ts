/**
 * Domain Entity: Almacen
 * Representa un almacen físico del sistema de inventarios
 */
export interface Almacen {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Detalle de movimientos del día agrupado por categoría
 * Alineado con DetalleTiposDto del API (registro-diario)
 */
export interface DetalleCategoria {
  categoria: string;
  entradas: number;
  salidas: number;
}

/**
 * Resumen de movimientos del día en un almacen.
 * Base: GET /api/registro-diario/actual/:almacenId (totalEntradas/totalSalidas/
 * detalleCategorias). En offline se calcula desde el ledger local y se hace
 * merge conservador (máximo de cada contador).
 */
export interface ResumenAlmacen {
  totalEntradas: number;
  totalSalidas: number;
  detalleCategorias: DetalleCategoria[];
  /**
   * Productos con stock por debajo del mínimo (alertas). Solo existe en el
   * cliente: se calcula desde las caches locales de productos y stock, pues
   * el registro diario del API no lo trae.
   */
  alertasBajoMinimo?: number;
}
