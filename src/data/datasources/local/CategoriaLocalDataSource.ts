/**
 * Local DataSource: Categoria
 * Maneja los tipos de medio en SQLite
 * Alineado con api-saci CategoriaSyncDto
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { Categoria } from '@/src/domain';

export class CategoriaLocalDataSource {
  async guardarTiposMedio(tipos: Categoria[]): Promise<void> {
    const operations = tipos.map(tipo => ({
      sql: `
        INSERT OR REPLACE INTO categorias_cache (
          id, nombre, descripcion, activo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      params: [
        tipo.id,
        tipo.nombre,
        tipo.descripcion,
        tipo.activo ? 1 : 0,
        tipo.createdAt.toISOString(),
        tipo.updatedAt.toISOString(),
      ],
    }));

    await executeTransaction(operations);
  }

  async obtenerTiposMedio(): Promise<Categoria[]> {
    const rows = await executeQuery<any>(
      `SELECT * FROM categorias_cache WHERE activo = 1 ORDER BY nombre`
    );

    return rows.map(this.mapRowToCategoria);
  }

  async obtenerCategoria(id: string): Promise<Categoria | null> {
    const row = await executeQueryFirst<any>(
      `SELECT * FROM categorias_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToCategoria(row) : null;
  }

  /**
   * PURGA: Elimina todos los tipos de medio cacheados
   * Se llama antes de re-descargar del servidor
   */
  async limpiarTiposMedio(): Promise<void> {
    await executeUpdate('DELETE FROM categorias_cache');
  }

  private mapRowToCategoria(row: any): Categoria {
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
