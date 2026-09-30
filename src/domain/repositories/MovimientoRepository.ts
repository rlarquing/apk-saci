/**
 * Repository Interface: MovimientoRepository
 * Define las operaciones de movimiento de almacen
 */
import { 
  Movimiento, 
  MovimientoActivo,
  RegistrarEntradaData, 
  RegistrarSalidaData, 
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
 *
 * `fechaSalida` (solo salida): hora real de la salida offline, para que el
 * sync la preserve en el ledger local en lugar de sobreescribirla con la hora
 * de sincronización.
 */
export interface RegistrarOptions {
  permitirFallbackOffline?: boolean;
  fechaSalida?: Date;
}

export interface MovimientoRepository {
  /**
   * Registra una entrada (intenta online, si falla guarda offline)
   */
  registrarEntrada(data: RegistrarEntradaData, options?: RegistrarOptions): Promise<ResultadoOperacion>;

  /**
   * Registra una salida (intenta online, si falla guarda offline)
   */
  registrarSalida(data: RegistrarSalidaData, options?: RegistrarOptions): Promise<ResultadoOperacion>;

  /**
   * Obtiene movimientos activos del almacen
   */
  obtenerMovimientosActivos(almacenId: string): Promise<MovimientoActivo[]>;

  /**
   * Obtiene el resumen del almacen desde el servidor.
   * Lanza si el servidor no responde (el caller decide el fallback local).
   */
  obtenerResumenAlmacen(almacenId: string): Promise<ResumenAlmacen>;

  /**
   * Resumen calculado desde el ledger local (SQLite), sin depender del servidor.
   * Base offline-first de la pantalla de inicio.
   */
  obtenerResumenLocal(almacenId: string): Promise<ResumenAlmacen>;

  /**
   * Reconcilia los movimientos activos locales contra los del servidor:
   * marca sincronizados los presentes en el server y cierra los que el server
   * ya reporta cerrados (salida hecha por web u otro dispositivo).
   * Retorna la cantidad de activos según el server, o null si no respondió.
   */
  reconciliarMovimientosActivos(almacenId: string): Promise<number | null>;

  /**
   * Registra la salida de un movimiento directamente en el cache local,
   * sin corromper fecha_entrada/precio originales.
   */
  actualizarSalidaLocal(movimientoId: string, fechaSalida: Date, precioUnitarioCobrado: number, sincronizado: boolean): Promise<void>;

  /**
   * Reemplaza el id de un movimiento local por el real del servidor
   * (tras sincronizar una entrada offline).
   */
  reemplazarIdMovimiento(idAnterior: string, idNuevo: string): Promise<void>;

  /**
   * Busca un movimiento en el cache local por id (activo o cerrado).
   */
  obtenerMovimientoPorId(id: string): Promise<Movimiento | null>;

  /**
   * Último movimiento de un QR en el almacen, activo o cerrado. Usado por el
   * sync para resolver el id real de una salida offline cuyo movimiento local
   * ya está cerrado.
   */
  obtenerUltimoMovimientoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null>;

  /**
   * Elimina un movimiento del cache local por id.
   */
  eliminarMovimientoLocal(id: string): Promise<void>;

  /**
   * Obtiene movimientos pendientes de sincronización
   */
  obtenerMovimientosPendientes(): Promise<MovimientoPendiente[]>;

  /**
   * Guarda un movimiento pendiente localmente
   */
  guardarMovimientoPendiente(movimiento: MovimientoPendiente): Promise<void>;

  /**
   * Marca un movimiento como sincronizado
   */
  marcarSincronizado(idLocal: string, movimientoId: string): Promise<void>;

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
   * PURGA: Elimina movimientos cache con salida antigua y sincronizados
   */
  limpiarMovimientosCacheAntiguos(diasAntiguedad: number): Promise<number>;

  /**
   * PURGA: Elimina movimientos pendientes que excedieron el límite de reintentos
   */
  limpiarMovimientosPendientesExcedidos(maxReintentos: number): Promise<number>;

  /**
   * PURGA: Elimina QRs inactivos del cache local
   */
  limpiarQRsInactivos(): Promise<number>;

  /**
   * Obtiene el último movimiento activo para un QR
   */
  obtenerMovimientoActivoPorQR(qrCodigo: string, almacenId: string): Promise<Movimiento | null>;

  /**
   * Guarda/actualiza un movimiento en el cache local (INSERT OR REPLACE)
   * Usado para persistir movimientos offline y actualizar el cache tras operaciones
   */
  guardarMovimiento(movimiento: Movimiento): Promise<void>;
}
