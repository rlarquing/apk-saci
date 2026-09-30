/**
 * Repository Interface: MovimientoRepository
 * Define las operaciones de movimiento de inventario
 */
import {
  Movimiento,
  RegistrarMovimientoData,
  ResultadoOperacion,
  MovimientoPendiente,
  ResumenAlmacen
} from '../entities';

/**
 * Opciones de registro. `permitirFallbackOffline` (default true) degrada a
 * modo offline (encolar pendiente + guardar en el ledger local) cuando la
 * llamada al servidor falla por red. El SincronizarUseCase lo desactiva:
 * dentro del sync el movimiento YA está encolado, y un fallback crearía
 * pendientes duplicados.
 */
export interface RegistrarOptions {
  permitirFallbackOffline?: boolean;
}

export interface MovimientoRepository {
  /**
   * Registra una entrada (intenta online, si falla por red guarda offline)
   */
  registrarEntrada(data: RegistrarMovimientoData, options?: RegistrarOptions): Promise<ResultadoOperacion>;

  /**
   * Registra una salida (intenta online, si falla por red guarda offline).
   * El API valida el stock suficiente: 409 "Stock insuficiente" es un error
   * de negocio que NO degrada a offline.
   */
  registrarSalida(data: RegistrarMovimientoData, options?: RegistrarOptions): Promise<ResultadoOperacion>;

  /**
   * Obtiene el registro diario del almacen desde el servidor.
   * Lanza si el servidor no responde (el caller decide el fallback local).
   */
  obtenerRegistroDiario(almacenId: string): Promise<ResumenAlmacen>;

  /**
   * Resumen calculado desde el ledger local (SQLite), sin depender del servidor.
   * Base offline-first de la pantalla de inicio.
   */
  obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen>;

  /**
   * Obtiene movimientos pendientes de sincronización
   */
  obtenerMovimientosPendientes(): Promise<MovimientoPendiente[]>;

  /**
   * Guarda un movimiento pendiente localmente
   */
  guardarMovimientoPendiente(movimiento: MovimientoPendiente): Promise<void>;

  /**
   * Guarda/actualiza un movimiento en el ledger local (INSERT OR REPLACE)
   */
  guardarMovimiento(movimiento: Movimiento): Promise<void>;

  /**
   * Marca un pendiente como sincronizado. `movimientoId` es opcional: el sync
   * por lotes (/api/sync) no retorna el id real por ítem, solo los errores.
   */
  marcarSincronizado(idLocal: string, movimientoId?: string): Promise<void>;

  /**
   * Contabiliza un intento fallido de envío de un movimiento pendiente.
   * Alimenta el contador que usa limpiarMovimientosPendientesExcedidos.
   */
  incrementarReintentos(idLocal: string): Promise<void>;

  /**
   * Elimina movimientos pendientes antiguos sincronizados
   */
  limpiarMovimientosPendientesAntiguos(diasAntiguedad: number): Promise<void>;

  /**
   * PURGA: Elimina movimientos del ledger antiguos y ya sincronizados
   */
  limpiarMovimientosCacheAntiguos(diasAntiguedad: number): Promise<number>;

  /**
   * PURGA: Elimina movimientos pendientes que excedieron el límite de reintentos
   */
  limpiarMovimientosPendientesExcedidos(maxReintentos: number): Promise<number>;

  /**
   * PURGA: Elimina etiquetas QR obsoletas del cache local
   */
  limpiarQRsInactivos(): Promise<number>;
}
