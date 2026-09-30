/**
 * Repository Implementation: CategoriaRepository
 * Sincroniza categorías con el servidor y purga cache local
 */
import { CategoriaRepository } from '@/src/domain';
import { Categoria } from '@/src/domain';
import { CategoriaLocalDataSource } from '@/src/data/datasources/local/CategoriaLocalDataSource';

export class CategoriaRepositoryImpl implements CategoriaRepository {
  constructor(
    private localDataSource: CategoriaLocalDataSource,
  ) {}

  async obtenerCategorias(): Promise<Categoria[]> {
    return await this.localDataSource.obtenerTiposMedio();
  }

  async obtenerCategoria(id: string): Promise<Categoria | null> {
    return await this.localDataSource.obtenerCategoria(id);
  }

  async guardarCategoriasLocal(categorias: Categoria[]): Promise<void> {
    await this.localDataSource.guardarTiposMedio(categorias);
  }

  async obtenerCategoriasLocal(): Promise<Categoria[]> {
    return await this.localDataSource.obtenerTiposMedio();
  }

  /**
   * Guarda la lista liviana del select del nomenclador ([{value,label}]).
   * El endpoint no aporta descripcion ni fechas: se rellenan con null/now.
   */
  async guardarDesdeSelect(items: Array<{ value: string; label: string }>): Promise<number> {
    if (!items || items.length === 0) {
      return 0;
    }

    await this.localDataSource.limpiarTiposMedio();
    const now = new Date();
    const categorias: Categoria[] = items.map(item => ({
      id: item.value,
      nombre: item.label,
      descripcion: null,
      activo: true,
      createdAt: now,
      updatedAt: now,
    }));

    await this.localDataSource.guardarTiposMedio(categorias);
    return categorias.length;
  }
}
