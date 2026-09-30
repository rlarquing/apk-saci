/**
 * Local DataSource: Movimiento
 * Maneja los movimientos en SQLite
 * Campos alineados con la API (api-saci)
 */
import { executeQuery, executeQueryFirst, executeUpdate } from '@/src/infrastructure';
import { Movimiento, MovimientoPendiente, RegistrarEntradaData, RegistrarSalidaData, ResumenAlmacen } from '@/src/domain';

export interface MovimientoCacheRow {
  id: string;
  qr_codigo: string;
  almacen_id: string;
  almacen_nombre: string;
  categoria_id: string;
  categoria_nombre: string;
  precio_id: string;
  precio_unitario_cobrado: number;
  fecha_entrada: string;
  fecha_salida: string | null;
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
  // ==================== MOVIMIENTOS CACHE ====================

  async guardarMovimiento(movimiento: Movimiento): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO movimientos_cache (
        id, qr_codigo, almacen_id, almacen_nombre, categoria_id, categoria_nombre,
        precio_id, precio_unitario_cobrado, fecha_entrada, fecha_salida,
        sincronizado, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executeUpdate(sql, [
      movimiento.id,
      movimiento.qrCodigo,
      movimiento.almacenId,
      movimiento.almacenNombre,
      movimiento.categoriaId,
      movimiento.categoriaNombre,
      movimiento.precioId,
      movimiento.precioUnitarioCobrado,
      movimiento.fechaEntrada.toISOString(),
      movimiento.fechaSalida?.toISOString() || null,
      movimiento.sincronizado ? 1 : 0,
      movimiento.createdAt.toISOString(),
      movimiento.updatedAt.toISOString(),
    ]);
  }

  /**
   * Reemplaza el id de un movimiento en el cache local.
   * Se usa tras sincronizar una entrada offline: el id `local-...` se cambia
   * por el ObjectId real que devolvió el servidor, para que la salida pueda
   * enviarse con el id que la API espera.
   */
  async reemplazarIdMovimiento(idAnterior: string, idNuevo: string): Promise<void> {
    if (!idNuevo || idAnterior === idNuevo) return;
    await executeUpdate(
      `UPDATE movimientos_cache SET id = ?, updated_at = ? WHERE id = ?`,
      [idNuevo, new Date().toISOString(), idAnterior]
    );
  }

  async obtenerMovimientosActivos(almacenId: string): Promise<Movimiento[]> {
    const rows = await executeQuery<MovimientoCacheRow>(
      `SELECT * FROM movimientos_cache 
       WHERE almacen_id = ? AND fecha_salida IS NULL 
       ORDER BY fecha_entrada DESC`,
      [almacenId]
    );

    return rows.map(this.mapRowToMovimiento);
  }

  async obtenerMovimientoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null> {
    const row = await executeQueryFirst<MovimientoCacheRow>(
      `SELECT * FROM movimientos_cache 
       WHERE qr_codigo = ? AND almacen_id = ? AND fecha_salida IS NULL 
       LIMIT 1`,
      [qrCodigo, almacenId]
    );

    return row ? this.mapRowToMovimiento(row) : null;
  }

  /**
   * Último movimiento de un QR en el almacen, activo o cerrado. Lo necesita el
   * SincronizarUseCase para resolver el id real de una salida offline: al
   * momento de sincronizarla, la fila local YA está cerrada (la salida offline
   * la cerró) y la búsqueda de activos no la encontraría.
   */
  async obtenerUltimoMovimientoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null> {
    const row = await executeQueryFirst<MovimientoCacheRow>(
      `SELECT * FROM movimientos_cache 
       WHERE qr_codigo = ? AND almacen_id = ? 
       ORDER BY fecha_entrada DESC 
       LIMIT 1`,
      [qrCodigo, almacenId]
    );

    return row ? this.mapRowToMovimiento(row) : null;
  }

  /**
   * Elimina un movimiento del cache local por id. Se usa al sincronizar una
   * entrada offline: el repository inserta la fila con el id real del server
   * y esta fila temporal con id `local-...` debe desaparecer para no
   * duplicar el conteo de vehículos dentro.
   */
  async eliminarMovimiento(id: string): Promise<void> {
    await executeUpdate(`DELETE FROM movimientos_cache WHERE id = ?`, [id]);
  }

  async obtenerMovimientoPorId(id: string): Promise<Movimiento | null> {
    const row = await executeQueryFirst<MovimientoCacheRow>(
      `SELECT * FROM movimientos_cache WHERE id = ? LIMIT 1`,
      [id]
    );

    return row ? this.mapRowToMovimiento(row) : null;
  }

  /**
   * Registra la salida de un movimiento en el cache local sin corromperlo:
   * solo toca fecha_salida, monto cobrado, flag de sync y updated_at.
   * (guardarMovimiento usa INSERT OR REPLACE y con los datos incompletos de
   * una salida sobrescribía fecha_entrada/precio originales con valores ya).
   */
  async actualizarSalida(
    movimientoId: string,
    fechaSalida: Date,
    precioUnitarioCobrado: number,
    sincronizado: boolean = false
  ): Promise<void> {
    const sql = `
      UPDATE movimientos_cache SET
        fecha_salida = ?,
        precio_unitario_cobrado = ?,
        sincronizado = ?,
        updated_at = ?
      WHERE id = ?
    `;

    await executeUpdate(sql, [
      fechaSalida.toISOString(),
      precioUnitarioCobrado,
      sincronizado ? 1 : 0,
      new Date().toISOString(),
      movimientoId,
    ]);
  }

  /**
   * Resumen calculado desde el ledger local (SQLite), sin depender del servidor.
   * Este es el contenido que debe verse en pantalla aunque la API tarde o falte:
   * dentro = movimientos abiertos; salieronHoy = cerrados desde el inicio del día;
   * ingresosHoy = suma cobrada de entradas del día (cobro-en-entrada).
   */
  async obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen> {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const dentro = await executeQueryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM movimientos_cache
       WHERE almacen_id = ? AND fecha_salida IS NULL`,
      [almacenId]
    );

    const salieron = await executeQueryFirst<{ count: number }>(
      `SELECT COUNT(*) as count FROM movimientos_cache
       WHERE almacen_id = ? AND fecha_salida IS NOT NULL AND fecha_salida >= ?`,
      [almacenId, inicioDia.toISOString()]
    );

    const ingresos = await executeQueryFirst<{ total: number | null }>(
      `SELECT COALESCE(SUM(precio_unitario_cobrado), 0) as total FROM movimientos_cache
       WHERE almacen_id = ? AND fecha_entrada >= ?`,
      [almacenId, inicioDia.toISOString()]
    );

    const detalleRows = await executeQuery<{ categoria_nombre: string; cantidad: number; ingreso: number }>(
      `SELECT categoria_nombre,
              COUNT(*) as cantidad,
              COALESCE(SUM(precio_unitario_cobrado), 0) as ingreso
       FROM movimientos_cache
       WHERE almacen_id = ? AND fecha_entrada >= ?
       GROUP BY categoria_nombre`,
      [almacenId, inicioDia.toISOString()]
    );

    return {
      vehiculosDentro: dentro?.count || 0,
      vehiculosSalieronHoy: salieron?.count || 0,
      ingresosHoy: ingresos?.total || 0,
      detallePorTipo: detalleRows.map(d => ({
        categoria: d.categoria_nombre || 'Desconocido',
        cantidad: d.cantidad,
        ingreso: d.ingreso,
      })),
    };
  }

  /**
   * Reconciliación del ledger local contra movimientos activos del servidor.
   * - Devuelve true si cambió algo local (para refrescar la UI).
   * - Marca `sincronizado=1` los activos locales presentes en el server.
   * - Cierra localmente los que el server reporta ya cerrados (salida hecha
   *   desde la web u otro teléfono) tomando la fecha de salida real del server.
   * - Solo altera movimientos cuyo estado local ya estaba sincronizado, para
   *   nunca deshacer operaciones offline aún no enviadas.
   *
   * `consultarFechasRemotas` (opcional): callback batch para pedir la fecha de
   * salida real de los QR discrepantes al servidor (POST /api/movimiento/estado).
   * Si no se provee o falla, se cierra con la hora actual (comportamiento previo).
   */
  /**
   * Ventana de gracia para la reconciliación: a una entrada recién creada no
   * se le cierra el cache aunque el server aún no la liste como activa (el
   * lag del server es el bug documentado en diagnostico-vehiculos-dentro.md).
   * Sin esta ventana, el primer ciclo de reconciliación posterior a una
   * entrada online la cerraría localmente y la pantalla retrocedería.
   */
  private static readonly GRACE_RECONCILIACION_MS = 2 * 60 * 1000;

  async reconciliarActivos(
    almacenId: string,
    activosServidor: Array<{ id: string; fechaSalida: string | null }>,
    consultarFechasRemotas?: (codigos: string[]) => Promise<Record<string, string | null>>
  ): Promise<boolean> {
    const locales = await this.obtenerMovimientosActivos(almacenId);
    const servidores = new Map(activosServidor.map(a => [a.id, a]));
    let cambio = false;

    // Pasada 1: marcar sincronizados los presentes en el server y recolectar
    // los que el server ya no tiene activos (salida hecha por web/otro teléfono).
    const porCerrar: Array<{ local: Movimiento; fechaLocal: string | null }> = [];

    for (const local of locales) {
      const remoto = servidores.get(local.id);

      if (remoto) {
        if (!local.sincronizado) {
          await executeUpdate(
            `UPDATE movimientos_cache SET sincronizado = 1 WHERE id = ?`,
            [local.id]
          );
          cambio = true;
        }
        continue;
      }

      // El server ya no lo tiene activo: si local estaba sincronizado, cerrar.
      // Respetando la ventana de gracia para entradas recientes.
      if (local.sincronizado) {
        const antiguedadMs = Date.now() - local.fechaEntrada.getTime();
        if (antiguedadMs < MovimientoLocalDataSource.GRACE_RECONCILIACION_MS) {
          continue;
        }

        // Buscar fecha de salida real en el cache (pudo llegar en otra descarga)
        const row = await executeQueryFirst<{ fecha_salida: string | null }>(
          `SELECT fecha_salida FROM movimientos_cache WHERE id = ? AND fecha_salida IS NOT NULL LIMIT 1`,
          [local.id]
        );
        porCerrar.push({ local, fechaLocal: row?.fecha_salida ?? null });
      }
    }

    // Pasada 2: pedir al servidor la fecha de salida real de los QR discrepantes
    // (una sola llamada batch). Sin dato, cerrar con el momento actual.
    if (porCerrar.length > 0) {
      const codigosSinFecha = [...new Set(
        porCerrar.filter(p => !p.fechaLocal).map(p => p.local.qrCodigo)
      )];
      const fechasRemotas = codigosSinFecha.length && consultarFechasRemotas
        ? await consultarFechasRemotas(codigosSinFecha)
        : {};

      for (const { local, fechaLocal } of porCerrar) {
        const fechaSalida = fechaLocal
          ? new Date(fechaLocal)
          : fechasRemotas[local.qrCodigo]
            ? new Date(fechasRemotas[local.qrCodigo]!)
            : new Date();
        await this.actualizarSalida(local.id, fechaSalida, local.precioUnitarioCobrado, true);
        cambio = true;
      }
    }

    return cambio;
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
      data: JSON.parse(row.data_json) as RegistrarEntradaData | RegistrarSalidaData,
      createdAt: new Date(row.created_at),
      reintentos: row.reintentos,
    }));
  }

  async marcarSincronizado(idLocal: string, movimientoId: string): Promise<void> {
    await executeUpdate(
      `UPDATE movimientos_pendientes SET sincronizado = 1, movimiento_id = ? WHERE id_local = ?`,
      [movimientoId, idLocal]
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
   * PURGA: Elimina movimientos cache antiguos (no pendientes) 
   * que ya tienen fecha de salida y fueron sincronizados
   */
  async limpiarMovimientosCacheAntiguos(diasAntiguedad: number): Promise<number> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    const result = await executeUpdate(
      `DELETE FROM movimientos_cache 
       WHERE fecha_salida IS NOT NULL 
       AND fecha_salida < ? 
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
      qrCodigo: row.qr_codigo,
      almacenId: row.almacen_id,
      almacenNombre: row.almacen_nombre,
      categoriaId: row.categoria_id,
      categoriaNombre: row.categoria_nombre,
      precioId: row.precio_id,
      precioUnitarioCobrado: row.precio_unitario_cobrado,
      fechaEntrada: new Date(row.fecha_entrada),
      fechaSalida: row.fecha_salida ? new Date(row.fecha_salida) : null,
      sincronizado: row.sincronizado === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
