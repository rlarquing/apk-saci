/**
 * Remote DataSource: Producto
 * GET /api/producto?sinPaginacion=true → array plano de ReadProductoDto
 * GET /api/producto-ubicacion?sinPaginacion=true → array plano de bins (P3)
 */
import { networkService } from '@/src/infrastructure';
import { ProductoDto, UbicacionProductoApiDto } from '../../dtos';

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

  /**
   * Bins (producto-ubicación) de TODOS los almacenes del usuario (backlog P3).
   * GET /api/producto-ubicacion?sinPaginacion=true → el body ES el array
   * directo. El cliente filtra por el almacén activo si hace falta.
   */
  async obtenerBins(): Promise<UbicacionProductoApiDto[]> {
    const response = await networkService.get<UbicacionProductoApiDto[] | any>(
      '/api/producto-ubicacion?sinPaginacion=true'
    );
    const data = response.data;
    // Defensivo: si el API ignorara sinPaginacion y devolviera Pagination
    if (Array.isArray(data)) {
      return data;
    }
    return data?.items || [];
  }
}
