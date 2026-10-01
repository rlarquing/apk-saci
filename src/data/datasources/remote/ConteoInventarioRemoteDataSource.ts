/**
 * Remote data source del conteo cíclico de inventario.
 * Endpoints del API (backlog P1): /api/conteo-inventario/...
 * Todas las llamadas son autenticadas y ONLINE-ONLY: si no hay red,
 * NetworkService lanza ApiError de red y el repositorio lo traduce.
 */
import { networkService } from '../../../infrastructure/network/NetworkService';
import {
  ApiResponseDto,
  ConteoDto,
  ConteoLineaRequestDto,
  CrearConteoRequestDto,
} from '../../dtos';

export class ConteoInventarioRemoteDataSource {
  /** Listado (sin paginar) filtrado por estado opcional. */
  async listar(estado?: string): Promise<ConteoDto[]> {
    const query = estado ? `?sinPaginacion=true&estado=${encodeURIComponent(estado)}` : '?sinPaginacion=true';
    const response = await networkService.get<ConteoDto[] | { items: ConteoDto[] }>(
      `/api/conteo-inventario${query}`
    );
    const data = response.data;
    // El API puede devolver array directo (sinPaginacion) o ListadoDto
    if (Array.isArray(data)) return data;
    return (data as { items: ConteoDto[] })?.items ?? [];
  }

  async obtener(conteoId: string): Promise<ConteoDto> {
    const response = await networkService.get<ConteoDto>(
      `/api/conteo-inventario/${conteoId}`
    );
    return response.data;
  }

  async crear(data: CrearConteoRequestDto): Promise<ApiResponseDto> {
    const response = await networkService.post<ApiResponseDto>(
      '/api/conteo-inventario',
      data
    );
    return response.data;
  }

  async contarLinea(
    conteoId: string,
    data: ConteoLineaRequestDto
  ): Promise<ApiResponseDto> {
    const response = await networkService.put<ApiResponseDto>(
      `/api/conteo-inventario/${conteoId}/linea`,
      data
    );
    return response.data;
  }

  async cerrar(conteoId: string): Promise<ApiResponseDto> {
    const response = await networkService.patch<ApiResponseDto>(
      `/api/conteo-inventario/${conteoId}/cerrar`,
      {}
    );
    return response.data;
  }

  async cancelar(conteoId: string): Promise<ApiResponseDto> {
    const response = await networkService.patch<ApiResponseDto>(
      `/api/conteo-inventario/${conteoId}/cancelar`,
      {}
    );
    return response.data;
  }
}
