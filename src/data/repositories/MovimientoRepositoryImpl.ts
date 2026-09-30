/**
 * Repository Implementation: MovimientoRepository
 * Campos alineados con la API (api-saci)
 *
 * Offline-first: el ledger en SQLite es la fuente de verdad de la pantalla.
 * El servidor es la fuente de verdad de los datos, pero toda operación queda
 * registrada localmente de inmediato (online u offline). Cada movimiento es
 * un registro independiente e inmutable (a diferencia del ticket de parqueo,
 * no hay "movimiento activo" que cerrar): la salida es un POST propio.
 */
import { MovimientoRepository, RegistrarOptions } from '@/src/domain';
import {
  Movimiento,
  RegistrarMovimientoData,
  ResultadoOperacion,
  MovimientoPendiente,
  ResumenAlmacen
} from '@/src/domain';
import { MovimientoLocalDataSource } from '@/src/data/datasources/local/MovimientoLocalDataSource';
import { QRLocalDataSource } from '@/src/data/datasources/local/QRLocalDataSource';
import { ProductoLocalDataSource } from '@/src/data/datasources/local/ProductoLocalDataSource';
import { MovimientoRemoteDataSource } from '@/src/data/datasources/remote/MovimientoRemoteDataSource';
import { MovimientoMapper, RegistroDiarioMapper } from '../mappers';
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
    private productoLocalDataSource?: ProductoLocalDataSource,
  ) {}

  async registrarEntrada(data: RegistrarMovimientoData, options?: RegistrarOptions): Promise<ResultadoOperacion> {
    const permitirFallback = options?.permitirFallbackOffline !== false;

    // Resolución de nombres desde las caches locales (para el ledger y el modal)
    const info = await this.resolverInfoProducto(data);

    try {
      const request = MovimientoMapper.toRegistrarRequest(data);
      const response = await this.remoteDataSource.registrarEntrada(request);

      if (!response.successStatus) {
        throw new Error(response.message || 'Error al registrar la entrada');
      }

      // La API solo retorna { id, successStatus, message }
      const movimiento = MovimientoMapper.buildFromOperacion({
        id: response.id || `local-${Date.now()}`,
        tipo: 'entrada',
        data,
        productoNombre: info.productoNombre,
        productoCodigo: info.productoCodigo,
        categoriaNombre: info.categoriaNombre,
        almacenNombre: info.almacenNombre,
        sincronizado: true,
      });

      // Guardar SIEMPRE en el ledger local (online u offline)
      await this.localDataSource.guardarMovimiento(movimiento);

      return {
        exito: true,
        movimiento,
        mensaje: `Entrada registrada: +${data.cantidad} ${info.productoNombre}`.trim(),
        tipo: 'entrada',
      };
    } catch (error) {
      // Degradar a offline: el health check puede pasar y el POST fallar
      // (timeout, 5xx). Sin esto la operación se perdía: ni server ni local.
      if (permitirFallback && esErrorDeRed(error)) {
        return this.guardarOffline('entrada', data, info);
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

  async registrarSalida(data: RegistrarMovimientoData, options?: RegistrarOptions): Promise<ResultadoOperacion> {
    const permitirFallback = options?.permitirFallbackOffline !== false;

    const info = await this.resolverInfoProducto(data);

    try {
      const request = MovimientoMapper.toRegistrarRequest(data);
      const response = await this.remoteDataSource.registrarSalida(request);

      if (!response.successStatus) {
        throw new Error(response.message || 'Error al registrar la salida');
      }

      const movimiento = MovimientoMapper.buildFromOperacion({
        id: response.id || `local-${Date.now()}`,
        tipo: 'salida',
        data,
        productoNombre: info.productoNombre,
        productoCodigo: info.productoCodigo,
        categoriaNombre: info.categoriaNombre,
        almacenNombre: info.almacenNombre,
        sincronizado: true,
      });

      await this.localDataSource.guardarMovimiento(movimiento);

      return {
        exito: true,
        movimiento,
        mensaje: `Salida registrada: -${data.cantidad} ${info.productoNombre}`.trim(),
        tipo: 'salida',
      };
    } catch (error) {
      if (permitirFallback && esErrorDeRed(error)) {
        return this.guardarOffline('salida', data, info);
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
   * Resuelve productoNombre/productoCodigo/categoriaNombre/almacenNombre
   * desde las caches locales. La etiqueta QR es la fuente preferida (tiene
   * el snapshot del producto al generar la etiqueta); si no, el catálogo de
   * productos (registro manual por SKU).
   */
  private async resolverInfoProducto(data: RegistrarMovimientoData): Promise<{
    productoNombre: string;
    productoCodigo: string;
    categoriaNombre: string;
    almacenNombre: string;
  }> {
    const vacio = { productoNombre: '', productoCodigo: '', categoriaNombre: '', almacenNombre: '' };

    try {
      if (data.qrCodigo && this.qrLocalDataSource) {
        const qr = await this.qrLocalDataSource.buscarQRPorCodigo(data.qrCodigo);
        if (qr) {
          let productoNombre = qr.productoNombre || '';
          let productoCodigo = qr.productoCodigo || '';
          let categoriaNombre = '';

          if ((!productoNombre || !categoriaNombre) && qr.productoId && this.productoLocalDataSource) {
            const producto = await this.productoLocalDataSource.buscarPorId(qr.productoId);
            if (producto) {
              productoNombre = productoNombre || producto.nombre;
              productoCodigo = productoCodigo || producto.codigo;
              categoriaNombre = producto.categoriaNombre || '';
            }
          }

          return {
            productoNombre,
            productoCodigo,
            categoriaNombre,
            almacenNombre: qr.almacenNombre || '',
          };
        }
      }

      if (data.productoId && this.productoLocalDataSource) {
        const producto =
          (await this.productoLocalDataSource.buscarPorId(data.productoId)) ||
          null;
        if (producto) {
          return {
            productoNombre: producto.nombre,
            productoCodigo: producto.codigo,
            categoriaNombre: producto.categoriaNombre || '',
            almacenNombre: '',
          };
        }
      }

      // Registro manual por SKU: el id real aún no se conoce (se resuelve en
      // el servidor), pero el código SKU viaja en data como productoId de
      // referencia local cuando el use case no pudo resolver el id.
      return vacio;
    } catch {
      return vacio;
    }
  }

  /**
   * Encola la operación y la persiste localmente con id temporal `local-...`.
   * La fecha real del movimiento viaja dentro de data para que el sync la
   * preserve (no la hora de sincronización).
   */
  private async guardarOffline(
    tipo: 'entrada' | 'salida',
    data: RegistrarMovimientoData,
    info: { productoNombre: string; productoCodigo: string; categoriaNombre: string; almacenNombre: string }
  ): Promise<ResultadoOperacion> {
    const idLocal = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const ahora = new Date();

    const pendiente: MovimientoPendiente = {
      idLocal,
      operacion: tipo,
      data: { ...data, fecha: data.fecha || ahora.toISOString() },
      createdAt: ahora,
      reintentos: 0,
    };
    await this.localDataSource.guardarMovimientoPendiente(pendiente);

    const movimientoLocal = MovimientoMapper.buildFromOperacion({
      id: idLocal,
      tipo,
      data: pendiente.data,
      productoNombre: info.productoNombre,
      productoCodigo: info.productoCodigo,
      categoriaNombre: info.categoriaNombre,
      almacenNombre: info.almacenNombre,
      sincronizado: false,
    });
    await this.localDataSource.guardarMovimiento(movimientoLocal);

    const verbo = tipo === 'entrada' ? 'Entrada' : 'Salida';
    const signo = tipo === 'entrada' ? '+' : '-';

    return {
      exito: true,
      movimiento: movimientoLocal,
      mensaje: `${verbo} registrada sin conexión: ${signo}${data.cantidad} ${info.productoNombre}`.trim() +
        '. Se sincronizará automáticamente.',
      tipo,
    };
  }

  /**
   * Registro diario desde el servidor. Lanza si falla — el use case decide
   * el fallback local.
   */
  async obtenerRegistroDiario(almacenId: string): Promise<ResumenAlmacen> {
    const response = await this.remoteDataSource.obtenerRegistroDiario(almacenId);
    return RegistroDiarioMapper.toEntity(response);
  }

  async obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen> {
    return await this.localDataSource.obtenerResumenLocal(almacenId);
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

  async marcarSincronizado(idLocal: string, movimientoId?: string): Promise<void> {
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
}
