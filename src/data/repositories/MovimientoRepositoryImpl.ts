/**
 * Repository Implementation: MovimientoRepository
 * Campos alineados con la API (api-saci)
 *
 * Offline-first: el ledger en SQLite es la fuente de verdad de la pantalla.
 * El servidor es la fuente de verdad de los datos, pero toda operación queda
 * registrada localmente de inmediato (online u offline) y se reconcilia con
 * el servidor en cada sync/refresco.
 */
import { MovimientoRepository, RegistrarOptions } from '@/src/domain';
import { 
  Movimiento, 
  MovimientoActivo,
  RegistrarEntradaData, 
  RegistrarSalidaData, 
  ResultadoOperacion,
  MovimientoPendiente,
  ResumenAlmacen
} from '@/src/domain';
import { MovimientoLocalDataSource } from '@/src/data/datasources/local/MovimientoLocalDataSource';
import { QRLocalDataSource } from '@/src/data/datasources/local/QRLocalDataSource';
import { MovimientoRemoteDataSource } from '@/src/data/datasources/remote/MovimientoRemoteDataSource';
import { MovimientoMapper, MovimientoActivoMapper, ResumenAlmacenMapper } from '../mappers';
import { ApiError } from '@/src/infrastructure';

/** Errores que justifican degradar a modo offline y encolar la operación. */
function esErrorDeRed(error: unknown): boolean {
  if (error instanceof ApiError) {
    // 0 = red caída; 408 = timeout; 5xx = servidor caído/sobrecargado
    return error.isNetworkError() || error.isTimeout() || error.isServerError();
  }
  if (error instanceof TypeError) {
    // fetch lanza TypeError en fallo de red sin respuesta
    return true;
  }
  return false;
}

export class MovimientoRepositoryImpl implements MovimientoRepository {
  constructor(
    private localDataSource: MovimientoLocalDataSource,
    private remoteDataSource: MovimientoRemoteDataSource,
    private qrLocalDataSource?: QRLocalDataSource,
  ) {}

  async registrarEntrada(data: RegistrarEntradaData, options?: RegistrarOptions): Promise<ResultadoOperacion> {
    const permitirFallback = options?.permitirFallbackOffline !== false;
    try {
      const request = MovimientoMapper.toRegistrarEntradaRequest(data);
      const response = await this.remoteDataSource.registrarEntrada(request);

      if (!response.successStatus) {
        throw new Error(response.message || 'Error al registrar entrada');
      }

      // La API solo retorna { id, successStatus, message }
      // Construimos el Movimiento con los datos que ya tenemos
      const movimiento = MovimientoMapper.buildFromEntradaResponse(response.id || '', data);

      // Guardar SIEMPRE en el ledger local (online u offline): es la fuente
      // de verdad de la pantalla hasta el cierre del día.
      await this.localDataSource.guardarMovimiento(movimiento);

      return {
        exito: true,
        movimiento,
        mensaje: `Entrada registrada. Cobrar: ${data.precioMonto.toFixed(2)}`,
        tipo: 'entrada',
      };
    } catch (error) {
      // Degradar a offline: el health check puede pasar y el POST fallar
      // (timeout, 5xx). Sin esto la operación se perdía: ni server ni local.
      if (permitirFallback && esErrorDeRed(error)) {
        return this.guardarEntradaOffline(data);
      }

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      return {
        exito: false,
        movimiento: null,
        mensaje: errorMessage,
        tipo: 'entrada',
      };
    }
  }

  async registrarSalida(data: RegistrarSalidaData, options?: RegistrarOptions): Promise<ResultadoOperacion> {
    // Snapshot del movimiento activo ANTES de tocar el servidor: con la fecha
    // y el monto reales del cache, para no perderlos si el registro online
    // falla y hay que encolar la salida offline.
    const local = await this.localDataSource.obtenerMovimientoPorId(data.movimientoId);
    const snapshotFechaEntrada = local?.fechaEntrada || null;
    const snapshotPrecio = local?.precioUnitarioCobrado ?? 0;
    const permitirFallback = options?.permitirFallbackOffline !== false;

    try {
      const request = MovimientoMapper.toRegistrarSalidaRequest(data);
      const response = await this.remoteDataSource.registrarSalida(data.movimientoId, request);

      if (!response.successStatus) {
        throw new Error(response.message || 'Error al registrar salida');
      }

      // Actualizar el cache local SIN corromperlo: antes se hacía
      // INSERT OR REPLACE con fechaEntrada=now y precio=0, borrando los
      // datos reales de la entrada.
      await this.localDataSource.actualizarSalida(
        data.movimientoId,
        options?.fechaSalida || new Date(),
        snapshotPrecio,
        true
      );

      const movimiento = await this.localDataSource.obtenerMovimientoPorId(data.movimientoId);

      return {
        exito: true,
        movimiento,
        mensaje: 'Salida registrada. Ya estaba pagada al entrar.',
        tipo: 'salida',
      };
    } catch (error) {
      if (permitirFallback && esErrorDeRed(error)) {
        return this.guardarSalidaOffline(data, snapshotFechaEntrada, snapshotPrecio);
      }

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      return {
        exito: false,
        movimiento: null,
        mensaje: errorMessage,
        tipo: 'salida',
      };
    }
  }

  /**
   * Encola la entrada y la persiste localmente con id temporal `local-...`.
   */
  private async guardarEntradaOffline(data: RegistrarEntradaData): Promise<ResultadoOperacion> {
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const pendiente: MovimientoPendiente = {
      idLocal,
      operacion: 'entrada',
      // fechaEntrada viaja dentro de data para que el sync preserve la hora
      // real del cobro offline (no la de sincronización), igual que hace
      // guardarSalidaOffline con fechaSalida.
      data: { ...data, fechaEntrada: now.toISOString() } as RegistrarEntradaData,
      createdAt: now,
      reintentos: 0,
    };
    await this.movimientoPendienteGuardar(pendiente);

    // Enriquecer con el nombre del tipo de medio si está en el cache de QRs
    let categoriaNombre = '';
    if (this.qrLocalDataSource && data.qrCodigo) {
      try {
        const qr = await this.qrLocalDataSource.buscarQRPorCodigo(data.qrCodigo);
        categoriaNombre = qr?.categoriaNombre || '';
      } catch {
        // ignore
      }
    }

    const movimientoLocal: Movimiento = {
      id: idLocal,
      qrCodigo: data.qrCodigo,
      almacenId: data.almacenId,
      almacenNombre: '',
      categoriaId: data.categoriaId,
      categoriaNombre,
      precioId: data.precioId,
      precioUnitarioCobrado: data.precioMonto,
      fechaEntrada: now,
      fechaSalida: null,
      sincronizado: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.localDataSource.guardarMovimiento(movimientoLocal);

    return {
      exito: true,
      movimiento: movimientoLocal,
      mensaje: `Entrada registrada sin conexión. Cobrar: ${data.precioMonto.toFixed(2)}. Se sincronizará automáticamente.`,
      tipo: 'entrada',
    };
  }

  /**
   * Encola la salida y la persiste localmente preservando los datos reales
   * de la entrada (fecha y monto del snapshot tomado antes de llamar a la API).
   */
  private async guardarSalidaOffline(
    data: RegistrarSalidaData,
    fechaEntrada: Date | null,
    precioUnitarioCobrado: number
  ): Promise<ResultadoOperacion> {
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ahora = new Date();

    const pendiente: MovimientoPendiente = {
      idLocal,
      operacion: 'salida',
      // fechaSalida viaja dentro de data para que el sync preserve la hora
      // real de la salida offline (no la hora de sincronización).
      data: { ...data, fechaSalida: ahora.toISOString() },
      createdAt: ahora,
      reintentos: 0,
    };
    await this.movimientoPendienteGuardar(pendiente);

    // Cerrar el movimiento en el ledger local sin corromperlo
    await this.localDataSource.actualizarSalida(data.movimientoId, ahora, precioUnitarioCobrado, false);

    const movimientoLocal = await this.localDataSource.obtenerMovimientoPorId(data.movimientoId);

    return {
      exito: true,
      movimiento: movimientoLocal,
      mensaje: 'Salida registrada sin conexión. Se sincronizará automáticamente.',
      tipo: 'salida',
    };
  }

  private async movimientoPendienteGuardar(pendiente: MovimientoPendiente): Promise<void> {
    await this.localDataSource.guardarMovimientoPendiente(pendiente);
  }

  async obtenerMovimientosActivos(almacenId: string): Promise<MovimientoActivo[]> {
    try {
      const response = await this.remoteDataSource.obtenerMovimientosActivos(almacenId);
      return response.map(MovimientoActivoMapper.toEntity);
    } catch (error) {
      // Fallback a datos locales — Movimiento → MovimientoActivo (subset)
      const locales = await this.localDataSource.obtenerMovimientosActivos(almacenId);
      return locales.map(m => ({
        id: m.id,
        fechaEntrada: m.fechaEntrada,
        almacenId: m.almacenId,
        almacenNombre: m.almacenNombre,
        categoriaNombre: m.categoriaNombre,
        precioMonto: m.precioUnitarioCobrado,
      }));
    }
  }

  /**
   * Resumen desde el servidor. Lanza si falla — el use case decide el fallback.
   */
  async obtenerResumenAlmacen(almacenId: string): Promise<ResumenAlmacen> {
    const response = await this.remoteDataSource.obtenerResumenAlmacen(almacenId);
    return ResumenAlmacenMapper.toEntity(response);
  }

  async obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen> {
    return await this.localDataSource.obtenerResumenLocal(almacenId);
  }

  /**
   * Reconcilia el ledger local contra los movimientos activos del servidor.
   * Cierra localmente lo que el server ya cerró (salidas hechas por web u otro
   * teléfono) y marca sincronizados los activos presentes en el server.
   * Solo toca movimientos cuyo estado local ya estaba sincronizado.
   * Retorna la cantidad de activos según el server, o null si no respondió.
   */
  async reconciliarMovimientosActivos(almacenId: string): Promise<number | null> {
    try {
      const activos = await this.remoteDataSource.obtenerMovimientosActivos(almacenId);
      await this.localDataSource.reconciliarActivos(
        almacenId,
        activos.map(a => ({ id: a.id, fechaSalida: null })),
        // Consulta batch de la fecha de salida real de los QR discrepantes
        // (cerrados por web/otro teléfono). Si falla, cerrar con ahora.
        async (codigos) => {
          try {
            const estados = await this.remoteDataSource.verificarEstadoMovimientos(codigos);
            const fechas: Record<string, string | null> = {};
            for (const estado of estados) fechas[estado.codigo] = estado.fechaSalida;
            return fechas;
          } catch {
            return {};
          }
        }
      );
      return activos.length;
    } catch {
      // Sin respuesta del server no se puede reconciliar: el ledger queda como está
      return null;
    }
  }

  async obtenerMovimientosPendientes(): Promise<MovimientoPendiente[]> {
    return await this.localDataSource.obtenerMovimientosPendientes();
  }

  async guardarMovimientoPendiente(movimiento: MovimientoPendiente): Promise<void> {
    await this.localDataSource.guardarMovimientoPendiente(movimiento);
  }

  async guardarMovimiento(movimiento: Movimiento): Promise<void> {
    await this.localDataSource.guardarMovimiento(movimiento);
  }

  async marcarSincronizado(idLocal: string, movimientoId: string): Promise<void> {
    await this.localDataSource.marcarSincronizado(idLocal, movimientoId);
  }

  async incrementarReintentos(idLocal: string): Promise<void> {
    await this.localDataSource.incrementarReintentos(idLocal);
  }

  async limpiarMovimientosPendientesAntiguos(diasAntiguedad: number): Promise<void> {
    await this.localDataSource.limpiarMovimientosAntiguos(diasAntiguedad);
  }

  async limpiarMovimientosCacheAntiguos(diasAntiguedad: number): Promise<number> {
    return await this.localDataSource.limpiarMovimientosCacheAntiguos(diasAntiguedad);
  }

  async limpiarMovimientosPendientesExcedidos(maxReintentos: number): Promise<number> {
    return await this.localDataSource.limpiarMovimientosPendientesExcedidos(maxReintentos);
  }

  async limpiarQRsInactivos(): Promise<number> {
    if (this.qrLocalDataSource) {
      return await this.qrLocalDataSource.limpiarQRsInactivos();
    }
    return 0;
  }

  async obtenerMovimientoActivoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null> {
    return await this.localDataSource.obtenerMovimientoPorQR(qrCodigo, almacenId);
  }

  async actualizarSalidaLocal(
    movimientoId: string,
    fechaSalida: Date,
    precioUnitarioCobrado: number,
    sincronizado: boolean
  ): Promise<void> {
    await this.localDataSource.actualizarSalida(movimientoId, fechaSalida, precioUnitarioCobrado, sincronizado);
  }

  async reemplazarIdMovimiento(idAnterior: string, idNuevo: string): Promise<void> {
    await this.localDataSource.reemplazarIdMovimiento(idAnterior, idNuevo);
  }

  async obtenerMovimientoPorId(id: string): Promise<Movimiento | null> {
    return await this.localDataSource.obtenerMovimientoPorId(id);
  }

  async obtenerUltimoMovimientoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null> {
    return await this.localDataSource.obtenerUltimoMovimientoPorQR(qrCodigo, almacenId);
  }

  async eliminarMovimientoLocal(id: string): Promise<void> {
    await this.localDataSource.eliminarMovimiento(id);
  }
}
