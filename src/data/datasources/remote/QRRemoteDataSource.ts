/**
 * Remote DataSource: QR
 * Maneja las etiquetas QR reutilizables con el API
 * La API usa camelCase (ReadQrDto), la APK usa snake_case internamente
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
  productoId: string;
  productoNombre: string;
  productoCodigo: string;
  almacenId: string;
  almacenNombre: string;
  contenido: string;
  fechaGeneracion: string;
  loteId: string;
  estado: string;       // 'disponible' | 'asignado' | 'anulado'
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
   * GET /api/qr/validar?codigo=...&almacen_id=... (el query param lleva underscore)
   * La API devuelve la respuesta casi directa; se mapea a snake_case interno.
   */
  async validarQR(codigo: string, almacenId: string): Promise<ValidarQRResponseDto> {
    const response = await networkService.get<any>(
      `${QR_ENDPOINTS.VALIDAR}?codigo=${encodeURIComponent(codigo)}&almacen_id=${almacenId}`
    );
    return QRRemoteDataSource.mapValidarResponseToDto(response.data);
  }

  /**
   * Obtiene etiquetas paginadas del servidor (ReadQrDto - camelCase)
   * El API devuelve Pagination directa {items, meta} y filtra por los
   * almacenes del usuario autenticado (ADMIN ve todos).
   * Nota: el endpoint no llena `links`; paginar con meta.totalPages.
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
   * Convierte ReadQrDto (camelCase del API) a QRDto (snake_case interno).
   * La etiqueta es reutilizable: se cachean las disponibles Y las asignadas
   * (ambas permiten operar); solo se descartan las anuladas/inactivas.
   */
  static mapListadoToQRDto(dto: QRListadoDto): QRDto {
    const descartada = !dto.activo || dto.estado === 'anulado';
    return {
      id: dto.id,
      codigo: dto.codigo,
      numeroConsecutivo: dto.numeroConsecutivo ?? 0,
      producto_id: dto.productoId || null,
      producto_nombre: dto.productoNombre || null,
      producto_codigo: dto.productoCodigo || null,
      almacen_id: dto.almacenId || null,
      almacen_nombre: dto.almacenNombre || null,
      lote_id: dto.loteId || null,
      estado: dto.estado || 'disponible',
      activo: !descartada,
      created_at: dto.fechaGeneracion || new Date().toISOString(),
    };
  }

  /**
   * Convierte la respuesta de validar QR a ValidarQRResponseDto (snake_case interno)
   * La API devuelve puede_entrada/puede_salida/puede_ajuste; movimiento_activo
   * siempre es null en SACI (la etiqueta no tiene "movimiento abierto").
   */
  static mapValidarResponseToDto(data: any): ValidarQRResponseDto {
    const qr = data.qr;

    return {
      valido: data.valido === true,
      mensaje: data.mensaje || '',
      qr: qr ? {
        id: qr.id || '',
        codigo: qr.codigo || '',
        numeroConsecutivo: qr.numeroConsecutivo ?? 0,
        producto_id: qr.productoId || null,
        producto_nombre: qr.productoNombre || null,
        producto_codigo: qr.productoCodigo || null,
        almacen_id: qr.almacenId || null,
        almacen_nombre: qr.almacenNombre || null,
        lote_id: qr.loteId || null,
        estado: qr.estado || 'disponible',
        activo: qr.activo === true,
        created_at: qr.fechaGeneracion || new Date().toISOString(),
      } : null,
      puede_entrada: data.puede_entrada === true,
      puede_salida: data.puede_salida === true,
      puede_ajuste: data.puede_ajuste === true,
      movimiento_activo: null,
    };
  }
}
