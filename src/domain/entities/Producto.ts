/**
 * Domain Entity: Producto
 * Representa un producto con SKU del catálogo de inventario.
 * Campos alineados con ReadProductoDto del API (api-saci).
 */
export interface Producto {
  id: string;
  /** SKU autogenerado por el API: PRD-XXXXXX */
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadNombre: string | null;
  /** Stock mínimo global (fallback del nivel por almacén) */
  stockMinimo: number;
  /** Stock de seguridad global (fallback del nivel por almacén) */
  stockSeguridad: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Nivel de stock por producto y almacén (safety stock — backlog P2).
 * Punto de reorden = stockMinimo + stockSeguridad. Tiene prioridad sobre
 * los umbrales globales del producto.
 */
export interface NivelStock {
  productoId: string;
  almacenId: string;
  stockMinimo: number;
  stockSeguridad: number;
}

/**
 * Stock de un producto en un almacen (valor DERIVADO del kardex).
 * Shape alineado con GET /api/movimiento-inventario/stock del API.
 */
export interface StockItem {
  productoId: string;
  almacenId: string;
  stock: number;
}
