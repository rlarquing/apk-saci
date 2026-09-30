/**
 * Remote DataSource: Movimiento
 * Endpoints alineados con api-saci (NestJS):
 * - POST /api/movimiento-inventario/entrada
 * - POST /api/movimiento-inventario/salida
 * - GET  /api/registro-diario/actual/:almacenId
 * - GET  /api/movimiento-inventario/stock
 */
import { networkService } from '@/src/infrastructure';
import {
  RegistrarMovimientoRequestDto,
  ApiResponseDto,
  RegistroDiarioDto,
  StockApiDto,
} from '../../dtos';

export class MovimientoRemoteDataSource {
  /**
   * Registra una ENTRADA → POST /api/movimiento-inventario/entrada
   */
  async registrarEntrada(data: RegistrarMovimientoRequestDto): Promise<ApiResponseDto> {
    const response = await networkService.post<ApiResponseDto>(
      '/api/movimiento-inventario/entrada',
      data
    );
    return response.data;
  }

  /**
   * Registra una SALIDA → POST /api/movimiento-inventario/salida
   * El API valida stock suficiente (409 "Stock insuficiente").
   */
  async registrarSalida(data: RegistrarMovimientoRequestDto): Promise<ApiResponseDto> {
    const response = await networkService.post<ApiResponseDto>(
      '/api/movimiento-inventario/salida',
      data
    );
    return response.data;
  }

  /**
   * Registro diario del almacen (resumen del día)
   * GET /api/registro-diario/actual/:almacenId
   */
  async obtenerRegistroDiario(almacenId: string): Promise<RegistroDiarioDto> {
    const response = await networkService.get<RegistroDiarioDto>(
      `/api/registro-diario/actual/${almacenId}`
    );
    return response.data;
  }

  /**
   * Stock derivado SIN filtros: retorna el stock de todos los productos en
   * todos los almacenes del usuario (el API deriva el alcance del JWT).
   * GET /api/movimiento-inventario/stock
   */
  async obtenerStock(): Promise<StockApiDto[]> {
    const response = await networkService.get<StockApiDto[]>(
      '/api/movimiento-inventario/stock'
    );
    return response.data;
  }
}
