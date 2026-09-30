/**
 * Repository Implementation: AlmacenRepository
 * Sincroniza almacenes con el servidor y purga cache local
 */
import { AlmacenRepository } from '@/src/domain';
import { Almacen, ResumenAlmacen } from '@/src/domain';
import { AlmacenLocalDataSource } from '@/src/data/datasources/local/AlmacenLocalDataSource';
import { AlmacenRemoteDataSource } from '@/src/data/datasources/remote/AlmacenRemoteDataSource';
import { networkService } from '@/src/infrastructure';

export class AlmacenRepositoryImpl implements AlmacenRepository {
  constructor(
    private localDataSource: AlmacenLocalDataSource,
    private remoteDataSource: AlmacenRemoteDataSource
  ) {}

  async obtenerAlmacenesAsignados(): Promise<Almacen[]> {
    return await this.localDataSource.obtenerAlmacenes();
  }

  async obtenerAlmacen(id: string): Promise<Almacen | null> {
    // Intentar local primero
    const local = await this.localDataSource.obtenerAlmacen(id);
    if (local) return local;

    // Si no está en cache, no hay fallback remoto directo por ID
    return null;
  }

  async obtenerResumenAlmacen(almacenId: string): Promise<ResumenAlmacen> {
    // El resumen se obtiene a través del MovimientoRepository
    throw new Error('Use MovimientoRepository.obtenerResumenAlmacen() en su lugar');
  }

  async guardarAlmacenesLocal(almacenes: Almacen[]): Promise<void> {
    await this.localDataSource.guardarAlmacenes(almacenes);
  }

  async obtenerAlmacenesLocal(): Promise<Almacen[]> {
    return await this.localDataSource.obtenerAlmacenes();
  }

  /**
   * Sincroniza almacenes desde el servidor: PURGA cache y guarda datos frescos
   * Usa paginación para obtener todos los almacenes
   */
  async sincronizarAlmacenes(): Promise<number> {
    try {
      const hayConexion = await networkService.checkConnection();
      if (!hayConexion) {
        return 0;
      }

      // Obtener todos los almacenes paginados
      let todosAlmacenes: Almacen[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const result = await this.remoteDataSource.obtenerAlmacenes(page, limit);
        
        if (result.items.length === 0) {
          hasMore = false;
          break;
        }

        const almacenes: Almacen[] = result.items.map(dto => ({
          id: dto.id,
          nombre: dto.nombre,
          descripcion: dto.descripcion || '',
          activo: dto.activo,
          createdAt: new Date(dto.createdAt),
          updatedAt: new Date(dto.updatedAt),
        }));

        todosAlmacenes = todosAlmacenes.concat(almacenes);

        if (result.items.length < limit || page >= result.meta.totalPages) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // PURGAR cache completo antes de insertar nuevos datos
      await this.localDataSource.limpiarAlmacenes();

      if (todosAlmacenes.length > 0) {
        await this.localDataSource.guardarAlmacenes(todosAlmacenes);
      }

      return todosAlmacenes.length;
    } catch (error) {
      return 0;
    }
  }
}
