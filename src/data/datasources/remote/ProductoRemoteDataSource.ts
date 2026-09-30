/**
 * Remote DataSource: Producto
 * GET /api/producto?sinPaginacion=true → array plano de ReadProductoDto
 */
import { networkService } from '@/src/infrastructure';
import { ProductoDto } from '../../dtos';

export class ProductoRemoteDataSource {
  /**
   * Descarga el catálogo completo de productos activos del usuario.
   * `sinPaginacion=true` hace que el API devuelva un array plano en vez de
   * Pagination. El catálogo alimenta la cache local usada por el registro
   * manual por SKU y por las alertas de stock bajo mínimo.
   */
  async obtenerProductos(): Promise<ProductoDto[]> {
    try {
      const response = await networkService.get<ProductoDto[] | { items: ProductoDto[] }>(
        '/api/producto?sinPaginacion=true'
      );
      const data = response.data;
      // Defensivo: si el API ignorara sinPaginacion y devolviera Pagination
      if (Array.isArray(data)) {
        return data;
      }
      return data?.items || [];
    } catch (error) {
      return [];
    }
  }
}
