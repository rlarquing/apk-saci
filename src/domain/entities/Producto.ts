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
  stockMinimo: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
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
