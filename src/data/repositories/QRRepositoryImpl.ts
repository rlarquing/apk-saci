/**
 * Repository Implementation: QRRepository
 * Incluye sincronización de QRs desde el API con purge
 */
import { QRRepository } from '@/src/domain';
import { QR, ResultadoEscaneoQR } from '@/src/domain';
import { QRLocalDataSource } from '@/src/data/datasources/local/QRLocalDataSource';
import { QRRemoteDataSource } from '@/src/data/datasources/remote/QRRemoteDataSource';
import { QRMapper, ValidarQRMapper } from '../mappers';
import { networkService, ApiError } from '@/src/infrastructure';

export class QRRepositoryImpl implements QRRepository {
  constructor(
    private localDataSource: QRLocalDataSource,
    private remoteDataSource: QRRemoteDataSource
  ) {}

  async validarQR(codigo: string, almacenId: string): Promise<ResultadoEscaneoQR> {
    // Verificar conexión
    const hayConexion = await networkService.checkConnection();

    if (hayConexion) {
      try {
        const response = await this.remoteDataSource.validarQR(codigo, almacenId);
        return ValidarQRMapper.toEntity(response);
      } catch (error) {
        // Solo se cae a la validación offline si de verdad no se alcanzó el
        // servidor. Un rechazo real (403, 404, QR de otro almacen) no puede
        // convertirse en "QR válido" por tragarse el error.
        const esFalloDeRed =
          error instanceof ApiError && (error.isNetworkError() || error.isTimeout());

        if (!esFalloDeRed) {
          return {
            valido: false,
            qr: null,
            mensaje:
              error instanceof Error ? error.message : 'No se pudo validar el QR',
            puedeEntrar: false,
            puedeSalir: false,
            movimientoActivo: null,
          };
        }
      }
    }

    // Modo offline - validar contra cache local
    const qrLocal = await this.localDataSource.buscarQRPorCodigo(codigo);
    
    if (!qrLocal) {
      return {
        valido: false,
        qr: null,
        mensaje: 'QR no encontrado (sin conexión al servidor)',
        puedeEntrar: false,
        puedeSalir: false,
        movimientoActivo: null,
      };
    }

    if (!qrLocal.activo) {
      return {
        valido: false,
        qr: qrLocal,
        mensaje: 'QR inactivo',
        puedeEntrar: false,
        puedeSalir: false,
        movimientoActivo: null,
      };
    }

    // Verificar si tiene movimiento activo
    // Nota: En modo offline completo, no podemos verificar esto con precisión
    return {
      valido: true,
      qr: qrLocal,
      mensaje: 'QR válido (modo offline)',
      puedeEntrar: true,
      puedeSalir: true,
      movimientoActivo: null,
    };
  }

  async guardarQRsLocal(qrs: QR[]): Promise<void> {
    await this.localDataSource.guardarQRs(qrs);
  }

  async obtenerQRsLocal(): Promise<QR[]> {
    return await this.localDataSource.obtenerQRs();
  }

  async buscarQRLocal(codigo: string): Promise<QR | null> {
    return await this.localDataSource.buscarQRPorCodigo(codigo);
  }

  /**
   * Sincroniza QRs desde el servidor: PURGA cache y guarda datos frescos
   * Usa paginación para obtener todos los QRs del usuario autenticado
   */
  async sincronizarQRs(almacenId: string): Promise<number> {
    try {
      const hayConexion = await networkService.checkConnection();
      if (!hayConexion) {
        return 0;
      }

      // Obtener todos los QRs paginados
      let todosQRs: QR[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const result = await this.remoteDataSource.obtenerQRsPaginados(page, limit);
        
        if (result.items.length === 0) {
          hasMore = false;
          break;
        }

        // Mapear ReadQrDto (camelCase) a QRDto (snake_case) y luego a entidad QR
        const qrs = result.items
          .map(dto => {
            const qrDto = QRRemoteDataSource.mapListadoToQRDto(dto);
            return QRMapper.toEntity(qrDto);
          });
        todosQRs = todosQRs.concat(qrs);

        // Si recibimos menos de 'limit' registros o ya estamos en la última página, terminamos
        if (result.items.length < limit || page >= result.meta.totalPages) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // PURGAR cache completo antes de insertar nuevos datos
      await this.localDataSource.limpiarQRs();

      if (todosQRs.length > 0) {
        await this.localDataSource.guardarQRs(todosQRs);
      }

      return todosQRs.length;
    } catch (error) {
      return 0;
    }
  }
}
