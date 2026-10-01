/**
 * Repository Interface: StockRepository
 * Define las operaciones sobre el stock derivado (cache local)
 */
import { StockItem, NivelStock } from '../entities';

export interface StockRepository {
  /**
   * Stock actual de un producto en un almacen, según el cache local.
   * Retorna null si no hay dato (no equivale a stock 0: no se conocen
   * movimientos del producto en ese almacen).
   */
  obtenerStock(productoId: string, almacenId: string): Promise<number | null>;

  /**
   * Obtiene todo el stock cacheado de un almacen
   */
  obtenerStockPorAlmacen(almacenId: string): Promise<StockItem[]>;

  /**
   * Guarda el stock localmente (purge + replace)
   */
  guardarStockLocal(items: StockItem[]): Promise<void>;

  /**
   * Reemplaza los niveles de stock por producto/almacén (safety stock — P2)
   */
  reemplazarNiveles(niveles: NivelStock[]): Promise<void>;

  /**
   * Niveles de stock cacheados de un almacén
   */
  obtenerNivelesPorAlmacen(almacenId: string): Promise<NivelStock[]>;
}
