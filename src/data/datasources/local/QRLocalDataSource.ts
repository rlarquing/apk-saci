/**
 * Local DataSource: QR
 * Maneja los códigos QR en SQLite
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { QR } from '@/src/domain';

export class QRLocalDataSource {
  async guardarQRs(qrs: QR[]): Promise<void> {
    const operations = qrs.map(qr => ({
      sql: `
        INSERT OR REPLACE INTO qrs_cache (
          id, codigo, lote_id, lote_nombre, activo, categoria_id, categoria_nombre, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        qr.id,
        qr.codigo,
        qr.loteId,
        qr.loteNombre,
        qr.activo ? 1 : 0,
        qr.categoriaId,
        qr.categoriaNombre,
        qr.createdAt.toISOString(),
      ],
    }));

    await executeTransaction(operations);
  }

  async obtenerQRs(): Promise<QR[]> {
    const rows = await executeQuery<any>(
      `SELECT * FROM qrs_cache WHERE activo = 1 ORDER BY created_at DESC`
    );

    return rows.map(this.mapRowToQR);
  }

  async buscarQRPorCodigo(codigo: string): Promise<QR | null> {
    const row = await executeQueryFirst<any>(
      `SELECT * FROM qrs_cache WHERE codigo = ? LIMIT 1`,
      [codigo]
    );

    return row ? this.mapRowToQR(row) : null;
  }

  async buscarQRPorId(id: string): Promise<QR | null> {
    const row = await executeQueryFirst<any>(
      `SELECT * FROM qrs_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToQR(row) : null;
  }

  async limpiarQRs(): Promise<void> {
    await executeUpdate('DELETE FROM qrs_cache');
  }

  /**
   * PURGA: Elimina QRs inactivos (usados/anulados en el server)
   */
  async limpiarQRsInactivos(): Promise<number> {
    const result = await executeUpdate(
      `DELETE FROM qrs_cache WHERE activo = 0`
    );
    return result?.changes || 0;
  }

  /**
   * Actualiza el estado de un QR por código
   */
  async actualizarEstadoQR(codigo: string, activo: boolean): Promise<void> {
    await executeUpdate(
      `UPDATE qrs_cache SET activo = ? WHERE codigo = ?`,
      [activo ? 1 : 0, codigo]
    );
  }

  private mapRowToQR(row: any): QR {
    return {
      id: row.id,
      codigo: row.codigo,
      loteId: row.lote_id,
      loteNombre: row.lote_nombre,
      activo: row.activo === 1,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      createdAt: new Date(row.created_at),
    };
  }
}
