/**
 * Remote DataSource: NivelStock
 * Endpoints alineados con api-saci (backlog P2):
 * - GET /api/nivel-stock?sinPaginacion=true
 */
import { networkService } from '@/src/infrastructure';
import { NivelStockApiDto } from '../../dtos';

export class NivelStockRemoteDataSource {
  /**
   * Niveles de stock por producto/almacén (todos los accesibles por el JWT).
   * GET /api/nivel-stock?sinPaginacion=true
   */
  async obtenerNiveles(): Promise<NivelStockApiDto[]> {
    const response = await networkService.get<NivelStockApiDto[] | any>(
      '/api/nivel-stock?sinPaginacion=true'
    );
    const data = response.data;
    // El API con sinPaginacion devuelve un array plano de ReadNivelStockDto.
    return Array.isArray(data) ? data : [];
  }
}
