/**
 * Remote DataSource: Movimiento
 * Endpoints alineados con api-saci (NestJS)
 */
import { networkService } from '@/src/infrastructure';
import {
  RegistrarEntradaRequestDto,
  RegistrarSalidaRequestDto,
  ApiResponseDto,
  MovimientoActivoDto,
  ResumenAlmacenDto,
  EstadoMovimientoDto,
} from '../../dtos';

export class MovimientoRemoteDataSource {
  /**
   * Registra una entrada → POST /api/movimiento/
   */
  async registrarEntrada(data: RegistrarEntradaRequestDto): Promise<ApiResponseDto> {
    const response = await networkService.post<ApiResponseDto>(
      '/api/movimiento/',
      data
    );
    return response.data;
  }

  /**
   * Registra una salida → PATCH /api/movimiento/:id
   */
  async registrarSalida(movimientoId: string, data: RegistrarSalidaRequestDto): Promise<ApiResponseDto> {
    const response = await networkService.patch<ApiResponseDto>(
      `/api/movimiento/${movimientoId}`,
      data
    );
    return response.data;
  }

  /**
   * Obtiene movimientos activos de un almacen
   * API endpoint: GET /api/movimiento/activos?almacenId=X
   */
  async obtenerMovimientosActivos(almacenId: string): Promise<MovimientoActivoDto[]> {
    const response = await networkService.get<MovimientoActivoDto[]>(
      `/api/movimiento/activos?almacenId=${almacenId}`
    );
    return response.data;
  }

  /**
   * Obtiene el resumen del almacen
   * API endpoint: GET /api/movimiento/resumen/:almacenId
   */
  async obtenerResumenAlmacen(almacenId: string): Promise<ResumenAlmacenDto> {
    const response = await networkService.get<ResumenAlmacenDto>(
      `/api/movimiento/resumen/${almacenId}`
    );
    return response.data;
  }

  /**
   * Verifica el estado de varios QRs a la vez (batch).
   * API endpoint: POST /api/movimiento/estado
   */
  async verificarEstadoMovimientos(codigos: string[]): Promise<EstadoMovimientoDto[]> {
    const response = await networkService.post<EstadoMovimientoDto[]>(
      '/api/movimiento/estado',
      { codigos }
    );
    return response.data;
  }
}
