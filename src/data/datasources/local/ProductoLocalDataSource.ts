/**
 * Local DataSource: Producto
 * Maneja el catálogo de productos en SQLite (llega con cada sincronización)
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { Producto } from '@/src/domain';

interface ProductoRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  unidad_nombre: string | null;
  stock_minimo: number;
  activo: number;
  created_at: string;
  updated_at: string;
}

export class ProductoLocalDataSource {
  async guardarProductos(productos: Producto[]): Promise<void> {
    const operations = productos.map(p => ({
      sql: `
        INSERT OR REPLACE INTO productos_cache (
          id, codigo, nombre, descripcion, categoria_id, categoria_nombre,
          unidad_nombre, stock_minimo, activo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        p.id,
        p.codigo,
        p.nombre,
        p.descripcion,
        p.categoriaId,
        p.categoriaNombre,
        p.unidadNombre,
        p.stockMinimo,
        p.activo ? 1 : 0,
        p.createdAt.toISOString(),
        p.updatedAt.toISOString(),
      ],
    }));

    await executeTransaction(operations);
  }

  async obtenerProductos(): Promise<Producto[]> {
    const rows = await executeQuery<ProductoRow>(
      `SELECT * FROM productos_cache WHERE activo = 1 ORDER BY nombre ASC`
    );

    return rows.map(this.mapRowToProducto);
  }

  async buscarPorCodigo(codigo: string): Promise<Producto | null> {
    const row = await executeQueryFirst<ProductoRow>(
      `SELECT * FROM productos_cache WHERE UPPER(codigo) = UPPER(?) AND activo = 1 LIMIT 1`,
      [codigo]
    );

    return row ? this.mapRowToProducto(row) : null;
  }

  async buscarPorId(id: string): Promise<Producto | null> {
    const row = await executeQueryFirst<ProductoRow>(
      `SELECT * FROM productos_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToProducto(row) : null;
  }

  async limpiarProductos(): Promise<void> {
    await executeUpdate('DELETE FROM productos_cache');
  }

  private mapRowToProducto(row: ProductoRow): Producto {
    return {
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      unidadNombre: row.unidad_nombre,
      stockMinimo: row.stock_minimo ?? 0,
      activo: row.activo === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
