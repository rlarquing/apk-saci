/**
 * Repository Implementation: StockRepository
 * Implementa la interfaz del dominio sobre el cache local de stock
 */
import { StockRepository } from '@/src/domain';
import { StockItem, NivelStock } from '@/src/domain';
import { StockLocalDataSource } from '@/src/data/datasources/local/StockLocalDataSource';

export class StockRepositoryImpl implements StockRepository {
  constructor(
    private localDataSource: StockLocalDataSource,
  ) {}

  async obtenerStock(productoId: string, almacenId: string): Promise<number | null> {
    return await this.localDataSource.obtenerStock(productoId, almacenId);
  }

  async obtenerStockPorAlmacen(almacenId: string): Promise<StockItem[]> {
    return await this.localDataSource.obtenerStockPorAlmacen(almacenId);
  }

  async guardarStockLocal(items: StockItem[]): Promise<void> {
    await this.localDataSource.guardarStock(items);
  }

  async reemplazarNiveles(niveles: NivelStock[]): Promise<void> {
    await this.localDataSource.reemplazarNiveles(niveles);
  }

  async obtenerNivelesPorAlmacen(almacenId: string): Promise<NivelStock[]> {
    return await this.localDataSource.obtenerNivelesPorAlmacen(almacenId);
  }
}
