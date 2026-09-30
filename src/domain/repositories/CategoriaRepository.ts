/**
 * Repository Interface: CategoriaRepository
 * Define las operaciones de tipos de medio
 */
import { Categoria, CategoriaConPrecio } from '../entities';

export interface CategoriaRepository {
  /**
   * Obtiene todos los tipos de medio activos
   */
  obtenerTiposMedio(): Promise<Categoria[]>;

  /**
   * Obtiene tipos de medio con precios para un almacen
   */
  obtenerTiposMedioConPrecio(almacenId: string): Promise<CategoriaConPrecio[]>;

  /**
   * Obtiene un tipo de medio por ID
   */
  obtenerCategoria(id: string): Promise<Categoria | null>;

  /**
   * Guarda tipos de medio localmente para uso offline
   */
  guardarTiposMedioLocal(tipos: Categoria[]): Promise<void>;

  /**
   * Obtiene tipos de medio guardados localmente
   */
  obtenerTiposMedioLocal(): Promise<Categoria[]>;

  /**
   * Sincroniza tipos de medio desde el servidor
   * Opcionalmente recibe datos del sync response para purgar y reemplazar
   */
  sincronizarTiposMedio(tiposMedioSync?: any[]): Promise<number>;
}
