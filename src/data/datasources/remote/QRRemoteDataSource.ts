/**
 * Remote DataSource: QR
 * Maneja los códigos QR con el API
 * La API usa camelCase (ReadQrDto), el APK usa snake_case internamente
 */
import { networkService } from '@/src/infrastructure';
import { ValidarQRResponseDto, QRDto } from '../../dtos';

const QR_ENDPOINTS = {
  VALIDAR: '/api/qr/validar',
  LISTADO: '/api/qr/',
};

/**
 * DTO de la respuesta del listado de QRs (ReadQrDto del API - camelCase)
 */
interface QRListadoDto {
  id: string;
  codigo: string;
  numeroConsecutivo: number;
  categoriaId: string;
  categoriaNombre: string;
  categoriaCodigo: string;
  almacenId: string;
  almacenNombre: string;
  contenido: string;
  fechaGeneracion: string;
  loteId: string;
  estado: string;       // 'disponible' | 'usado' | 'anulado'
  fechaEstado?: string;
  activo: boolean;
}

interface QRListadoResponseDto {
  items: QRListadoDto[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export class QRRemoteDataSource {
  /**
   * Valida un código QR
   * La API devuelve camelCase, se mapea a snake_case internamente
   */
  async validarQR(codigo: string, almacenId: string): Promise<ValidarQRResponseDto> {
    const response = await networkService.get<any>(
      `${QR_ENDPOINTS.VALIDAR}?codigo=${encodeURIComponent(codigo)}&almacen_id=${almacenId}`
    );
    return QRRemoteDataSource.mapValidarResponseToDto(response.data);
  }

  /**
   * Obtiene QRs paginados del servidor (ReadQrDto - camelCase)
   * El API devuelve Pagination directa {items, meta} y filtra por almacenes del usuario autenticado (rol USUARIO)
   * ADMIN ve todos los QRs
   */
  async obtenerQRsPaginados(page: number = 1, limit: number = 100): Promise<QRListadoResponseDto> {
    try {
      const response = await networkService.get<QRListadoResponseDto>(
        `${QR_ENDPOINTS.LISTADO}?page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      return {
        items: [],
        meta: { totalItems: 0, itemCount: 0, itemsPerPage: limit, totalPages: 0, currentPage: page },
      };
    }
  }

  /**
   * Convierte ReadQrDto (camelCase del API) a QRDto (snake_case interno)
   */
  static mapListadoToQRDto(dto: QRListadoDto): QRDto {
    return {
      id: dto.id,
      codigo: dto.codigo,
      lote_id: dto.loteId,
      lote_nombre: '',  // No viene en ReadQrDto
      activo: dto.activo && dto.estado === 'disponible',
      categoria_id: dto.categoriaId,
      categoria_nombre: dto.categoriaNombre,
      created_at: dto.fechaGeneracion,
    };
  }

  /**
   * Convierte la respuesta de validar QR (camelCase del API) a ValidarQRResponseDto (snake_case interno)
   * La API devuelve puede_entrar/puede_salir/movimiento_activo; se usan directamente
   */
  static mapValidarResponseToDto(data: any): ValidarQRResponseDto {
    const qr = data.qr;

    return {
      valido: data.valido === true,
      mensaje: data.mensaje || '',
      qr: qr ? {
        id: qr.id || '',
        codigo: qr.codigo || '',
        lote_id: qr.loteId || '',
        lote_nombre: qr.almacenNombre || '',
        activo: qr.activo === true,
        categoria_id: qr.categoriaId || null,
        categoria_nombre: qr.categoriaNombre || null,
        created_at: qr.fechaGeneracion || new Date().toISOString(),
      } : null,
      puede_entrar: data.puede_entrar === true,
      puede_salir: data.puede_salir === true,
      movimiento_activo: data.movimiento_activo
        ? {
            id: data.movimiento_activo.id || '',
            fecha_entrada: data.movimiento_activo.fechaEntrada || data.movimiento_activo.fecha_entrada || '',
            almacen_id: data.movimiento_activo.almacenId || data.movimiento_activo.almacen_id || '',
            almacen_nombre: data.movimiento_activo.almacenNombre || data.movimiento_activo.almacen_nombre || '',
            categoria_nombre: data.movimiento_activo.categoriaNombre || data.movimiento_activo.categoria_nombre || '',
            precio_monto: data.movimiento_activo.precioMonto ?? data.movimiento_activo.precio_monto ?? 0,
          }
        : null,
    };
  }
}
