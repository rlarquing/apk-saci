/**
 * Repository Interface: AlmacenRepository
 * Define las operaciones de almacenes
 */
import { Almacen, ResumenAlmacen } from '../entities';

export interface AlmacenRepository {
  /**
   * Obtiene los almacenes asignados al usuario
   */
  obtenerAlmacenesAsignados(): Promise<Almacen[]>;

  /**
   * Obtiene un almacen por ID
   */
  obtenerAlmacen(id: string): Promise<Almacen | null>;

  /**
   * Obtiene el resumen de un almacen
   */
  obtenerResumenAlmacen(almacenId: string): Promise<ResumenAlmacen>;

  /**
   * Guarda almacenes localmente para uso offline
   */
  guardarAlmacenesLocal(almacenes: Almacen[]): Promise<void>;

  /**
   * Obtiene almacenes guardados localmente
   */
  obtenerAlmacenesLocal(): Promise<Almacen[]>;

  /**
   * Sincroniza almacenes desde el servidor
   */
  sincronizarAlmacenes(): Promise<number>;
}
