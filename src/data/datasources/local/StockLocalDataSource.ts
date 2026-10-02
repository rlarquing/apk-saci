/**
 * Local DataSource: Stock
 * Maneja el cache de stock derivado por producto y almacén en SQLite.
 * El stock NUNCA se calcula localmente: se descarga del API en cada
 * sincronización (GET /api/movimiento-inventario/stock o la respuesta del
 * POST /api/sync), pues es un valor derivado del kardex completo.
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { StockItem, NivelStock } from '@/src/domain';

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

  // ==================== NIVELES DE STOCK (safety stock — P2) ====================

  /** Reemplaza todos los niveles cacheados (purge + replace en transacción). */
  async reemplazarNiveles(niveles: NivelStock[]): Promise<void> {
    await this.limpiarNiveles();
    if (niveles.length === 0) return;
    const now = new Date().toISOString();
    const operations = niveles.map(n => ({
      sql: `
        INSERT OR REPLACE INTO niveles_stock_cache (
          producto_id, almacen_id, stock_minimo, stock_seguridad, updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      params: [n.productoId, n.almacenId, n.stockMinimo, n.stockSeguridad, now],
    }));
    await executeTransaction(operations);
  }

  async limpiarNiveles(): Promise<void> {
    await executeUpdate('DELETE FROM niveles_stock_cache');
  }

  /** Niveles cacheados de un almacén. */
  async obtenerNivelesPorAlmacen(almacenId: string): Promise<NivelStock[]> {
    const rows = await executeQuery<{
      producto_id: string;
      almacen_id: string;
      stock_minimo: number;
      stock_seguridad: number;
    }>(`SELECT * FROM niveles_stock_cache WHERE almacen_id = ?`, [almacenId]);

    return rows.map(r => ({
      productoId: r.producto_id,
      almacenId: r.almacen_id,
      stockMinimo: r.stock_minimo ?? 0,
      stockSeguridad: r.stock_seguridad ?? 0,
    }));
  }

  // ==================== BINS (producto-ubicación — P3) ====================

  /**
   * Reemplaza todos los bins cacheados (purge + replace en transacción).
   * Un bin es la ubicación física de un producto dentro de un almacén:
   * llega de GET /api/producto-ubicacion y de la respuesta del sync.
   */
  async reemplazarBins(
    bins: Array<{ productoId: string; almacenId: string; ubicacionNombre: string }>
  ): Promise<void> {
    await this.limpiarBins();
    if (bins.length === 0) return;
    const now = new Date().toISOString();
    const operations = bins.map(b => ({
      sql: `
        INSERT OR REPLACE INTO producto_ubicacion_cache (
          producto_id, almacen_id, ubicacion_nombre, updated_at
        ) VALUES (?, ?, ?, ?)
      `,
      params: [b.productoId, b.almacenId, b.ubicacionNombre, now],
    }));
    await executeTransaction(operations);
  }

  async limpiarBins(): Promise<void> {
    await executeUpdate('DELETE FROM producto_ubicacion_cache');
  }

  /**
   * Ubicación (bin) cacheada de un producto en un almacén.
   * Retorna null si el producto no tiene bin asignado.
   */
  async obtenerBin(productoId: string, almacenId: string): Promise<string | null> {
    const row = await executeQueryFirst<{ ubicacion_nombre: string }>(
      `SELECT ubicacion_nombre FROM producto_ubicacion_cache
       WHERE producto_id = ? AND almacen_id = ? LIMIT 1`,
      [productoId, almacenId]
    );

    return row?.ubicacion_nombre || null;
  }
}
