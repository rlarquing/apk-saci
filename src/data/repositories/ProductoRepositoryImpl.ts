/**
 * Repository Implementation: ProductoRepository
 * Implementa la interfaz del dominio sobre el cache local de productos
 */
import { ProductoRepository } from '@/src/domain';
import { Producto } from '@/src/domain';
import { ProductoLocalDataSource } from '@/src/data/datasources/local/ProductoLocalDataSource';

export class ProductoRepositoryImpl implements ProductoRepository {
  constructor(
    private localDataSource: ProductoLocalDataSource,
  ) {}

  async obtenerProductosLocal(): Promise<Producto[]> {
    return await this.localDataSource.obtenerProductos();
  }

  async buscarPorCodigo(codigo: string): Promise<Producto | null> {
    return await this.localDataSource.buscarPorCodigo(codigo);
  }

  async buscarPorId(id: string): Promise<Producto | null> {
    return await this.localDataSource.buscarPorId(id);
  }

  async guardarProductosLocal(productos: Producto[]): Promise<void> {
    await this.localDataSource.guardarProductos(productos);
  }
}
