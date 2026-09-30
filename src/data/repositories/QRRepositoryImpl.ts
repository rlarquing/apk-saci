/**
 * Repository Implementation: QRRepository
 * Incluye sincronización de etiquetas desde el API con purge
 */
import { QRRepository } from '@/src/domain';
import { QR, ResultadoEscaneoQR, EstadoQR } from '@/src/domain';
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
              error instanceof Error ? error.message : 'No se pudo validar la etiqueta',
            puedeEntrar: false,
            puedeSalir: false,
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
        mensaje: 'Etiqueta no encontrada (sin conexión al servidor)',
        puedeEntrar: false,
        puedeSalir: false,
      };
    }

    if (!qrLocal.activo || qrLocal.estado === 'anulado') {
      return {
        valido: false,
        qr: qrLocal,
        mensaje: 'La etiqueta está anulada',
        puedeEntrar: false,
        puedeSalir: false,
      };
    }

    // Etiqueta reutilizable: disponible admite entrada; asignado admite
    // entrada y salida. (El ajuste es una operación del panel web.)
    const asignada = qrLocal.estado === 'asignado';
    return {
      valido: true,
      qr: qrLocal,
      mensaje: asignada
        ? 'Etiqueta válida (modo offline): entrada o salida disponibles'
        : 'Etiqueta válida (modo offline): primera asignación (entrada)',
      puedeEntrar: true,
      puedeSalir: asignada,
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

  async actualizarEstadoLocal(codigo: string, estado: EstadoQR): Promise<void> {
    await this.localDataSource.actualizarEstado(codigo, estado);
  }

  /**
   * Sincroniza etiquetas desde el servidor: PURGA cache y guarda datos frescos
   * Usa paginación para obtener todas las etiquetas de los almacenes del usuario
   */
  async sincronizarQRs(): Promise<number> {
    try {
      const hayConexion = await networkService.checkConnection();
      if (!hayConexion) {
        return 0;
      }

      // Obtener todas las etiquetas paginadas
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
          })
          // Solo etiquetas operables: disponibles y asignadas activas
          .filter(qr => qr.activo && qr.estado !== 'anulado');
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
