/**
 * Remote DataSource: Sync
 * Maneja la sincronización con el API
 * Alineado con api-saci SyncController
 */
import { networkService } from '@/src/infrastructure';
import { SyncRequestDto, SyncResponseDto } from '../../dtos';

const SYNC_ENDPOINTS = {
  SYNC: '/api/sync',
  STATUS: '/api/sync/status',
};

export class SyncRemoteDataSource {
  /**
   * Envía datos para sincronización
   * POST /api/sync
   */
  async sincronizar(data: SyncRequestDto): Promise<SyncResponseDto> {
    const response = await networkService.post<SyncResponseDto>(SYNC_ENDPOINTS.SYNC, data);
    return response.data;
  }

  /**
   * Obtiene el estado de sincronización
   * GET /api/sync/status
   */
  async obtenerEstado(): Promise<{ ultimaSincronizacion: string | null }> {
    const response = await networkService.get<{ ultimaSincronizacion: string | null }>(
      SYNC_ENDPOINTS.STATUS
    );
    return response.data;
  }
}
