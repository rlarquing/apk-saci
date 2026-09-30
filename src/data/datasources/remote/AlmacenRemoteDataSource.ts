/**
 * Remote DataSource: Almacen (Nomenclador)
 * Usa el endpoint genérico de nomencladores del api-saci
 * GET /api/nomenclador/almacen/listado/elementos
 */
import { networkService } from '@/src/infrastructure';

/**
 * DTO de respuesta del nomenclador almacen (camelCase del API)
 */
interface AlmacenNomencladorDto {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AlmacenListadoDto {
  items: AlmacenNomencladorDto[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

// El API devuelve ListadoDto {header, key, data: Pagination}
interface AlmacenListadoResponseDto {
  header: any;
  key: string;
  data: AlmacenListadoDto;
}

export class AlmacenRemoteDataSource {
  /**
   * Obtiene almacenes paginados del servidor
   * GET /api/nomenclador/almacen/listado/elementos?page=X&limit=X
   * Devuelve el Pagination ({items, meta}) contenido en el ListadoDto del API
   */
  async obtenerAlmacenes(page: number = 1, limit: number = 100): Promise<AlmacenListadoDto> {
    try {
      const response = await networkService.get<AlmacenListadoResponseDto>(
        `/api/nomenclador/almacen/listado/elementos?page=${page}&limit=${limit}`
      );
      return response.data.data;
    } catch (error) {
      return {
        items: [],
        meta: { totalItems: 0, itemCount: 0, itemsPerPage: limit, totalPages: 0, currentPage: page },
      };
    }
  }

  /**
   * Obtiene el select de almacenes (id + nombre) - más liviano
   * GET /api/nomenclador/almacen/create/select
   */
  async obtenerAlmacenesSelect(): Promise<Array<{ id: string; nombre: string }>> {
    try {
      const response = await networkService.get<Array<{ id: string; nombre: string }>>(
        '/api/nomenclador/almacen/create/select'
      );
      return response.data;
    } catch (error) {
      return [];
    }
  }
}
