/**
 * Repository Interface: ProductoRepository
 * Define las operaciones de catálogo de productos
 */
import { Producto } from '../entities';

export interface ProductoRepository {
  /**
   * Obtiene todos los productos activos (cache local)
   */
  obtenerProductosLocal(): Promise<Producto[]>;

  /**
   * Busca un producto por SKU (PRD-XXXXXX) en el cache local.
   * Habilita el registro manual de movimientos tecleando/escaneando el SKU
   * incluso sin conexión (el catálogo llega con cada sincronización).
   */
  buscarPorCodigo(codigo: string): Promise<Producto | null>;

  /**
   * Busca un producto por ID en el cache local
   */
  buscarPorId(id: string): Promise<Producto | null>;

  /**
   * Guarda productos localmente (purge + replace)
   */
  guardarProductosLocal(productos: Producto[]): Promise<void>;
}
