/**
 * Local DataSource: Stock
 * Maneja el cache de stock derivado por producto y almacén en SQLite.
 * El stock NUNCA se calcula localmente: se descarga del API en cada
 * sincronización (GET /api/movimiento-inventario/stock o la respuesta del
 * POST /api/sync), pues es un valor derivado del kardex completo.
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { StockItem } from '@/src/domain';

interface StockRow {
  producto_id: string;
  almacen_id: string;
  stock: number;
  updated_at: string;
}

export class StockLocalDataSource {
  async guardarStock(items: StockItem[]): Promise<void> {
    const now = new Date().toISOString();
    const operations = items.map(item => ({
      sql: `
        INSERT OR REPLACE INTO stock_cache (producto_id, almacen_id, stock, updated_at)
        VALUES (?, ?, ?, ?)
      `,
      params: [item.productoId, item.almacenId, item.stock, now],
    }));

    await executeTransaction(operations);
  }

  /**
   * Stock actual de un producto en un almacen según el cache.
   * Retorna null si no hay dato: NO equivale a stock 0 (no se conocen
   * movimientos del producto en ese almacen).
   */
  async obtenerStock(productoId: string, almacenId: string): Promise<number | null> {
    const row = await executeQueryFirst<StockRow>(
      `SELECT * FROM stock_cache WHERE producto_id = ? AND almacen_id = ? LIMIT 1`,
      [productoId, almacenId]
    );

    return row ? row.stock : null;
  }

  async obtenerStockPorAlmacen(almacenId: string): Promise<StockItem[]> {
    const rows = await executeQuery<StockRow>(
      `SELECT * FROM stock_cache WHERE almacen_id = ?`,
      [almacenId]
    );

    return rows.map(r => ({
      productoId: r.producto_id,
      almacenId: r.almacen_id,
      stock: r.stock,
    }));
  }

  async limpiarStock(): Promise<void> {
    await executeUpdate('DELETE FROM stock_cache');
  }
}
