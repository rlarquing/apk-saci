/**
 * Repository Interface: CategoriaRepository
 * Define las operaciones de categorías de productos
 */
import { Categoria } from '../entities';

export interface CategoriaRepository {
  /**
   * Obtiene todas las categorías activas (cache local)
   */
  obtenerCategorias(): Promise<Categoria[]>;

  /**
   * Obtiene una categoría por ID (cache local)
   */
  obtenerCategoria(id: string): Promise<Categoria | null>;

  /**
   * Guarda categorías localmente para uso offline
   */
  guardarCategoriasLocal(categorias: Categoria[]): Promise<void>;

  /**
   * Obtiene categorías guardadas localmente
   */
  obtenerCategoriasLocal(): Promise<Categoria[]>;

  /**
   * Guarda en el cache local la lista liviana del select del nomenclador
   * ([{value,label}]): descripcion=null, activo=true.
   */
  guardarDesdeSelect(items: Array<{ value: string; label: string }>): Promise<number>;
}
