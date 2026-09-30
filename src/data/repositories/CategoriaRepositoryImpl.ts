/**
 * Repository Implementation: CategoriaRepository
 * Sincroniza tipos de medio con el servidor y purga cache local
 * Alineado con api-saci CategoriaSyncDto
 */
import { CategoriaRepository } from '@/src/domain';
import { Categoria, CategoriaConPrecio } from '@/src/domain';
import { CategoriaLocalDataSource } from '@/src/data/datasources/local/CategoriaLocalDataSource';
import { CategoriaSyncDto } from '../dtos';

export class CategoriaRepositoryImpl implements CategoriaRepository {
  constructor(
    private localDataSource: CategoriaLocalDataSource,
  ) {}

  async obtenerTiposMedio(): Promise<Categoria[]> {
    return await this.localDataSource.obtenerTiposMedio();
  }

  async obtenerTiposMedioConPrecio(almacenId: string): Promise<CategoriaConPrecio[]> {
    // Los tipos de medio con precio se obtienen a través del PrecioRepository
    const tipos = await this.localDataSource.obtenerTiposMedio();
    return tipos.map(tipo => ({
      categoria: tipo,
      precio: null, // Se llena desde PrecioRepository
    }));
  }

  async obtenerCategoria(id: string): Promise<Categoria | null> {
    return await this.localDataSource.obtenerCategoria(id);
  }

  async guardarTiposMedioLocal(tipos: Categoria[]): Promise<void> {
    await this.localDataSource.guardarTiposMedio(tipos);
  }

  async obtenerTiposMedioLocal(): Promise<Categoria[]> {
    return await this.localDataSource.obtenerTiposMedio();
  }

  /**
   * Sincroniza tipos de medio: PURGA cache y guarda datos frescos del API
   */
  async sincronizarTiposMedio(tiposMedioSync?: CategoriaSyncDto[]): Promise<number> {
    if (!tiposMedioSync || tiposMedioSync.length === 0) {
      return 0;
    }

    // PURGAR cache completo antes de insertar
    await this.localDataSource.limpiarTiposMedio();

    // Filtrar solo activos y mapear a entidad local
    const tipos: Categoria[] = tiposMedioSync
      .filter(t => t.activo)
      .map(t => ({
        id: t.id,
        nombre: t.nombre,
        descripcion: t.descripcion,
        activo: t.activo,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
      }));

    await this.localDataSource.guardarTiposMedio(tipos);
    return tipos.length;
  }
}
