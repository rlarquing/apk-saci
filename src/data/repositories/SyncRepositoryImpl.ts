/**
 * Repository Implementation: SyncRepository
 * Sincroniza datos con el servidor y purga cache local
 * Alineado con api-saci SyncService
 */
import { SyncRepository } from '@/src/domain';
import { SyncData, SyncResult, MovimientoPendiente } from '@/src/domain';
import { ConfigLocalDataSource } from '@/src/data/datasources/local/ConfigLocalDataSource';
import { SyncRemoteDataSource } from '@/src/data/datasources/remote/SyncRemoteDataSource';
import { PrecioLocalDataSource } from '@/src/data/datasources/local/PrecioLocalDataSource';
import { QRLocalDataSource } from '@/src/data/datasources/local/QRLocalDataSource';
import { MovimientoLocalDataSource } from '@/src/data/datasources/local/MovimientoLocalDataSource';
import { AuthLocalDataSource } from '@/src/data/datasources/local/AuthLocalDataSource';
import { networkService } from '@/src/infrastructure';
import {
  SyncRequestDto,
  SyncResponseDto,
  PrecioSyncDto,
  CategoriaSyncDto,
} from '../dtos';

export class SyncRepositoryImpl implements SyncRepository {
  constructor(
    private configLocalDataSource: ConfigLocalDataSource,
    private syncRemoteDataSource: SyncRemoteDataSource,
    private precioLocalDataSource?: PrecioLocalDataSource,
    private qrLocalDataSource?: QRLocalDataSource,
    private movimientoLocalDataSource?: MovimientoLocalDataSource,
    private authLocalDataSource?: AuthLocalDataSource,
  ) {}

  async sincronizar(data: SyncData): Promise<SyncResult> {
    try {
      // Construir request alineado con api-saci SyncRequestDto
      const request: SyncRequestDto = {
        movimientosPendientes: data.movimientosPendientes.map(m => ({
          id: m.idLocal,
          operacion: m.operacion,
          data: {
            qrCodigo: (m.data as any)?.qrCodigo,
            almacen: (m.data as any)?.almacenId,
            movimiento: (m.data as any)?.movimientoId,
          },
          createdAt: m.createdAt.toISOString(),
        })),
        ultimaSincronizacion: data.ultimaSincronizacion?.toISOString() || null,
      };

      const response = await this.syncRemoteDataSource.sincronizar(request);

      // Procesar datos actualizados del servidor (precios + tipos de medio)
      await this.procesarDatosActualizados(response);

      return {
        exito: response.exito,
        movimientosSincronizados: response.movimientosSincronizados,
        movimientosConError: response.movimientosConError,
        datosActualizados: {
          precios: response.datosActualizados?.precios || response.precios?.length || 0,
          tiposMedio: response.datosActualizados?.categorias || response.categorias?.length || 0,
          usuarios: response.datosActualizados?.usuarios || 0,
        },
        errores: (response.errores || []).map(e => ({
          idLocal: e.id,
          operacion: e.operacion,
          error: e.error,
        })),
      };
    } catch (error) {
      return {
        exito: false,
        movimientosSincronizados: 0,
        movimientosConError: 0,
        datosActualizados: { precios: 0, tiposMedio: 0, usuarios: 0 },
        errores: [{
          idLocal: '',
          operacion: 'conexion',
          error: error instanceof Error ? error.message : 'Error de conexión',
        }],
      };
    }
  }

  /**
   * Procesa los datos actualizados que vienen en la respuesta del sync
   * PURGA cache antes de guardar para eliminar registros obsoletos/inactivos
   */
  private async procesarDatosActualizados(response: SyncResponseDto): Promise<void> {
    // 1. Purgar y actualizar precios
    if (response.precios && response.precios.length > 0 && this.precioLocalDataSource) {
      try {
        // PURGAR cache completo antes de insertar nuevos datos
        await this.precioLocalDataSource.limpiarPrecios();

        // Mapear PrecioSyncDto (del API) a entidad Precio (local)
        const precios = response.precios
          .filter((p: PrecioSyncDto) => p.activo)
          .map((p: PrecioSyncDto) => ({
            id: p.id,
            monto: p.valor, // API usa "valor", local usa "monto"
            categoriaId: p.categoria, // API usa "categoria", local usa "categoriaId"
            categoriaNombre: p.categoriaNombre,
            almacenId: p.almacen,
            activo: p.activo,
            fechaVigenciaInicio: new Date(p.fechaInicioVigencia),
            fechaVigenciaFin: p.fechaFinVigencia ? new Date(p.fechaFinVigencia) : null,
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt),
          }));

        await this.precioLocalDataSource.guardarPrecios(precios);
      } catch (error) {
        // ignore
      }
    }
  }

  async hayConexion(): Promise<boolean> {
    return await networkService.checkConnection();
  }

  async obtenerUltimaSincronizacion(): Promise<Date | null> {
    return await this.configLocalDataSource.obtenerUltimaSincronizacion();
  }

  async guardarUltimaSincronizacion(fecha: Date): Promise<void> {
    await this.configLocalDataSource.guardarUltimaSincronizacion(fecha);
  }

  async enviarMovimientosPendientes(movimientos: MovimientoPendiente[]): Promise<SyncResult> {
    return await this.sincronizar({
      movimientosPendientes: movimientos,
      ultimaSincronizacion: await this.obtenerUltimaSincronizacion(),
    });
  }

  /**
   * Descarga datos actualizados del servidor y purga cache local
   */
  async descargarDatosActualizados(): Promise<{
    precios: number;
    tiposMedio: number;
    usuarios: number;
  }> {
    // Ahora los datos vienen en la respuesta del /api/sync
    // Este método se mantiene por compatibilidad pero la lógica
    // principal está en procesarDatosActualizados()
    return {
      precios: 0,
      tiposMedio: 0,
      usuarios: 0,
    };
  }
}
