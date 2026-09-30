/**
 * Repository Interface: SyncRepository
 * Define las operaciones de sincronización con el API
 */
import { SyncResult, MovimientoPendiente } from '../entities';

export interface SyncRepository {
  /**
   * Envía los movimientos pendientes en un solo lote al servidor
   * (POST /api/sync). El API procesa cada ítem de forma independiente y
   * retorna los errores por ítem, junto con los catálogos actualizados
   * (productos, stock y categorías) que se guardan en las caches locales.
   *
   * El API exige @ArrayNotEmpty: solo llamar con al menos un pendiente.
   */
  sincronizar(
    pendientes: MovimientoPendiente[],
    ultimaSincronizacion: Date | null
  ): Promise<SyncResult>;

  /**
   * Refresca los catálogos sin movimientos pendientes, vía GETs individuales:
   * productos (GET /api/producto?sinPaginacion), stock (GET
   * /api/movimiento-inventario/stock) y categorías (create/select del
   * nomenclador). El POST /api/sync rechaza listas vacías.
   */
  descargarDatosActualizados(): Promise<{
    productos: number;
    categorias: number;
    stock: number;
  }>;

  /**
   * Verifica si hay conexión con el servidor
   */
  hayConexion(): Promise<boolean>;

  /**
   * Obtiene la fecha de última sincronización
   */
  obtenerUltimaSincronizacion(): Promise<Date | null>;

  /**
   * Guarda la fecha de última sincronización
   */
  guardarUltimaSincronizacion(fecha: Date): Promise<void>;
}
