/**
 * Local DataSource: Almacen
 * Maneja los almacenes en SQLite (tabla almacenes_cache)
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { Almacen } from '@/src/domain';

export class AlmacenLocalDataSource {
  async guardarAlmacenes(almacenes: Almacen[]): Promise<void> {
    const operations = almacenes.map(almacen => ({
      sql: `
        INSERT OR REPLACE INTO almacenes_cache (
          id, nombre, descripcion, activo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        almacen.id,
        almacen.nombre,
        almacen.descripcion,
        almacen.activo ? 1 : 0,
        almacen.createdAt.toISOString(),
        almacen.updatedAt.toISOString(),
      ],
    }));

    await executeTransaction(operations);
  }

  async obtenerAlmacenes(): Promise<Almacen[]> {
    const rows = await executeQuery<any>(
      `SELECT * FROM almacenes_cache WHERE activo = 1 ORDER BY nombre`
    );

    return rows.map(this.mapRowToAlmacen);
  }

  async obtenerAlmacen(id: string): Promise<Almacen | null> {
    const row = await executeQueryFirst<any>(
      `SELECT * FROM almacenes_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToAlmacen(row) : null;
  }

  /**
   * PURGA: Elimina todos los almacenes cacheados
   * Se llama antes de re-descargar del servidor
   */
  async limpiarAlmacenes(): Promise<void> {
    await executeUpdate('DELETE FROM almacenes_cache');
  }

  private mapRowToAlmacen(row: any): Almacen {
    return {
      id: row.id,
      nombre: row.nombre,
      descripcion: row.descripcion,
      activo: row.activo === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
