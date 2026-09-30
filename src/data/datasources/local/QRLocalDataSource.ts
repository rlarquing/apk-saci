/**
 * Local DataSource: QR
 * Maneja las etiquetas QR reutilizables en SQLite
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { QR, EstadoQR } from '@/src/domain';

interface QRRow {
  id: string;
  codigo: string;
  numero_consecutivo: number;
  producto_id: string | null;
  producto_nombre: string | null;
  producto_codigo: string | null;
  almacen_id: string | null;
  almacen_nombre: string | null;
  lote_id: string | null;
  estado: string;
  activo: number;
  fecha_generacion: string | null;
  created_at: string;
}

export class QRLocalDataSource {
  async guardarQRs(qrs: QR[]): Promise<void> {
    const operations = qrs.map(qr => ({
      sql: `
        INSERT OR REPLACE INTO qrs_cache (
          id, codigo, numero_consecutivo, producto_id, producto_nombre,
          producto_codigo, almacen_id, almacen_nombre, lote_id, estado,
          activo, fecha_generacion, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        qr.id,
        qr.codigo,
        qr.numeroConsecutivo,
        qr.productoId,
        qr.productoNombre,
        qr.productoCodigo,
        qr.almacenId,
        qr.almacenNombre,
        qr.loteId,
        qr.estado,
        qr.activo ? 1 : 0,
        qr.fechaGeneracion?.toISOString() || null,
        qr.createdAt.toISOString(),
      ],
    }));

    await executeTransaction(operations);
  }

  async obtenerQRs(): Promise<QR[]> {
    const rows = await executeQuery<QRRow>(
      `SELECT * FROM qrs_cache WHERE activo = 1 AND estado != 'anulado' ORDER BY codigo ASC`
    );

    return rows.map(this.mapRowToQR);
  }

  async buscarQRPorCodigo(codigo: string): Promise<QR | null> {
    const row = await executeQueryFirst<QRRow>(
      `SELECT * FROM qrs_cache WHERE codigo = ? LIMIT 1`,
      [codigo]
    );

    return row ? this.mapRowToQR(row) : null;
  }

  async buscarQRPorId(id: string): Promise<QR | null> {
    const row = await executeQueryFirst<QRRow>(
      `SELECT * FROM qrs_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToQR(row) : null;
  }

  async limpiarQRs(): Promise<void> {
    await executeUpdate('DELETE FROM qrs_cache');
  }

  /**
   * PURGA: Elimina etiquetas obsoletas (inactivas o anuladas en el server)
   */
  async limpiarQRsInactivos(): Promise<number> {
    const result = await executeUpdate(
      `DELETE FROM qrs_cache WHERE activo = 0 OR estado = 'anulado'`
    );
    return result?.changes || 0;
  }

  /**
   * Actualiza el estado de una etiqueta por código.
   * Se usa como actualización optimista tras una entrada exitosa
   * (disponible → asignado) para que las validaciones offline reflejen
   * el nuevo estado sin esperar a la próxima sincronización.
   */
  async actualizarEstado(codigo: string, estado: EstadoQR): Promise<void> {
    await executeUpdate(
      `UPDATE qrs_cache SET estado = ? WHERE codigo = ?`,
      [estado, codigo]
    );
  }

  private mapRowToQR(row: QRRow): QR {
    return {
      id: row.id,
      codigo: row.codigo,
      numeroConsecutivo: row.numero_consecutivo ?? 0,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      productoCodigo: row.producto_codigo,
      almacenId: row.almacen_id,
      almacenNombre: row.almacen_nombre,
      loteId: row.lote_id,
      estado: (row.estado as EstadoQR) || 'disponible',
      activo: row.activo === 1,
      fechaGeneracion: row.fecha_generacion ? new Date(row.fecha_generacion) : null,
      createdAt: new Date(row.created_at),
    };
  }
}
