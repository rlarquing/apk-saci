/**
 * Repository Interface: AlmacenRepository
 * Define las operaciones de almacenes
 */
import { Almacen } from '../entities';

export interface AlmacenRepository {
  /**
   * Obtiene los almacenes asignados al usuario (cache local)
   */
  obtenerAlmacenesAsignados(): Promise<Almacen[]>;

  /**
   * Obtiene un almacen por ID (cache local)
   */
  obtenerAlmacen(id: string): Promise<Almacen | null>;

  /**
   * Guarda almacenes localmente para uso offline
   */
  guardarAlmacenesLocal(almacenes: Almacen[]): Promise<void>;

  /**
   * Obtiene almacenes guardados localmente
   */
  obtenerAlmacenesLocal(): Promise<Almacen[]>;

  /**
   * Sincroniza almacenes desde el servidor (purge + replace)
   */
  sincronizarAlmacenes(): Promise<number>;
}
