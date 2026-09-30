/**
 * Local DataSource: Movimiento
 * Maneja el ledger de movimientos de inventario en SQLite
 * Campos alineados con la API (api-saci)
 */
import { executeQuery, executeQueryFirst, executeUpdate } from '@/src/infrastructure';
import { Movimiento, MovimientoPendiente, RegistrarMovimientoData, ResumenAlmacen } from '@/src/domain';

export interface MovimientoCacheRow {
  id: string;
  tipo: string;
  qr_codigo: string | null;
  producto_id: string;
  producto_nombre: string;
  producto_codigo: string;
  categoria_nombre: string;
  almacen_id: string;
  almacen_nombre: string;
  cantidad: number;
  fecha: string;
  observaciones: string | null;
  sincronizado: number;
  created_at: string;
  updated_at: string;
}

export interface MovimientoPendienteRow {
  id_local: string;
  operacion: string;
  data_json: string;
  created_at: string;
  reintentos: number;
  sincronizado: number;
  movimiento_id: string | null;
}

export class MovimientoLocalDataSource {
  // ==================== LEDGER (MOVIMIENTOS CACHE) ====================

  async guardarMovimiento(movimiento: Movimiento): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO movimientos_cache (
        id, tipo, qr_codigo, producto_id, producto_nombre, producto_codigo,
        categoria_nombre, almacen_id, almacen_nombre, cantidad, fecha,
        observaciones, sincronizado, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executeUpdate(sql, [
      movimiento.id,
      movimiento.tipo,
      movimiento.qrCodigo,
      movimiento.productoId,
      movimiento.productoNombre,
      movimiento.productoCodigo,
      movimiento.categoriaNombre,
      movimiento.almacenId,
      movimiento.almacenNombre,
      movimiento.cantidad,
      movimiento.fecha.toISOString(),
      movimiento.observaciones,
      movimiento.sincronizado ? 1 : 0,
      movimiento.createdAt.toISOString(),
      movimiento.updatedAt.toISOString(),
    ]);
  }

  async obtenerMovimientosLocal(almacenId: string, limite: number = 100): Promise<Movimiento[]> {
    const rows = await executeQuery<MovimientoCacheRow>(
      `SELECT * FROM movimientos_cache
       WHERE almacen_id = ?
       ORDER BY fecha DESC
       LIMIT ?`,
      [almacenId, limite]
    );

    return rows.map(this.mapRowToMovimiento);
  }

  /**
   * Resumen del día calculado desde el ledger local (SQLite), sin depender
   * del servidor. Este es el contenido que debe verse en pantalla aunque la
   * API tarde o falte: suma de cantidades de entradas y salidas de hoy, con
   * detalle por categoría.
   */
  async obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen> {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const entradas = await executeQueryFirst<{ total: number | null }>(
      `SELECT COALESCE(SUM(cantidad), 0) as total FROM movimientos_cache
       WHERE almacen_id = ? AND tipo = 'entrada' AND fecha >= ?`,
      [almacenId, inicioDia.toISOString()]
    );

    const salidas = await executeQueryFirst<{ total: number | null }>(
      `SELECT COALESCE(SUM(cantidad), 0) as total FROM movimientos_cache
       WHERE almacen_id = ? AND tipo = 'salida' AND fecha >= ?`,
      [almacenId, inicioDia.toISOString()]
    );

    const detalleRows = await executeQuery<{
      categoria_nombre: string;
      entradas: number;
      salidas: number;
    }>(
      `SELECT categoria_nombre,
              COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END), 0) as entradas,
              COALESCE(SUM(CASE WHEN tipo = 'salida' THEN cantidad ELSE 0 END), 0) as salidas
       FROM movimientos_cache
       WHERE almacen_id = ? AND fecha >= ?
       GROUP BY categoria_nombre`,
      [almacenId, inicioDia.toISOString()]
    );

    return {
      totalEntradas: entradas?.total || 0,
      totalSalidas: salidas?.total || 0,
      detalleCategorias: detalleRows.map(d => ({
        categoria: d.categoria_nombre || 'Sin categoría',
        entradas: d.entradas,
        salidas: d.salidas,
      })),
    };
  }

  // ==================== MOVIMIENTOS PENDIENTES ====================

  async guardarMovimientoPendiente(pendiente: MovimientoPendiente): Promise<void> {
    const sql = `
      INSERT INTO movimientos_pendientes (id_local, operacion, data_json, created_at, reintentos, sincronizado)
      VALUES (?, ?, ?, ?, ?, 0)
    `;

    await executeUpdate(sql, [
      pendiente.idLocal,
      pendiente.operacion,
      JSON.stringify(pendiente.data),
      pendiente.createdAt.toISOString(),
      pendiente.reintentos,
    ]);
  }

  async obtenerMovimientosPendientes(): Promise<MovimientoPendiente[]> {
    const rows = await executeQuery<MovimientoPendienteRow>(
      `SELECT * FROM movimientos_pendientes WHERE sincronizado = 0 ORDER BY created_at ASC`
    );

    return rows.map(row => ({
      idLocal: row.id_local,
      operacion: row.operacion as 'entrada' | 'salida',
      data: JSON.parse(row.data_json) as RegistrarMovimientoData,
      createdAt: new Date(row.created_at),
      reintentos: row.reintentos,
    }));
  }

  /**
   * Marca un pendiente como sincronizado. `movimientoId` es opcional: el
   * sync por lotes (/api/sync) no retorna el id real por ítem.
   */
  async marcarSincronizado(idLocal: string, movimientoId?: string): Promise<void> {
    await executeUpdate(
      `UPDATE movimientos_pendientes SET sincronizado = 1, movimiento_id = COALESCE(?, movimiento_id) WHERE id_local = ?`,
      [movimientoId ?? null, idLocal]
    );
  }

  async incrementarReintentos(idLocal: string): Promise<void> {
    await executeUpdate(
      `UPDATE movimientos_pendientes SET reintentos = reintentos + 1 WHERE id_local = ?`,
      [idLocal]
    );
  }

  async limpiarMovimientosAntiguos(diasAntiguedad: number): Promise<void> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    await executeUpdate(
      `DELETE FROM movimientos_pendientes WHERE sincronizado = 1 AND created_at < ?`,
      [fechaLimite.toISOString()]
    );
  }

  /**
   * PURGA: Elimina movimientos del ledger antiguos y ya sincronizados
   */
  async limpiarMovimientosCacheAntiguos(diasAntiguedad: number): Promise<number> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    const result = await executeUpdate(
      `DELETE FROM movimientos_cache
       WHERE fecha < ?
       AND sincronizado = 1`,
      [fechaLimite.toISOString()]
    );
    return result?.changes || 0;
  }

  /**
   * PURGA: Elimina movimientos pendientes que excedieron el límite de reintentos
   */
  async limpiarMovimientosPendientesExcedidos(maxReintentos: number): Promise<number> {
    const result = await executeUpdate(
      `DELETE FROM movimientos_pendientes WHERE reintentos >= ? AND sincronizado = 0`,
      [maxReintentos]
    );
    return result?.changes || 0;
  }

  async obtenerCantidadPendientes(): Promise<number> {
    const row = await executeQueryFirst<{ count: number }>(
      'SELECT COUNT(*) as count FROM movimientos_pendientes WHERE sincronizado = 0'
    );
    return row?.count || 0;
  }

  // ==================== HELPERS ====================

  private mapRowToMovimiento(row: MovimientoCacheRow): Movimiento {
    return {
      id: row.id,
      tipo: row.tipo as 'entrada' | 'salida',
      qrCodigo: row.qr_codigo,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      productoCodigo: row.producto_codigo,
      categoriaNombre: row.categoria_nombre,
      almacenId: row.almacen_id,
      almacenNombre: row.almacen_nombre,
      cantidad: row.cantidad,
      fecha: new Date(row.fecha),
      observaciones: row.observaciones,
      sincronizado: row.sincronizado === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
