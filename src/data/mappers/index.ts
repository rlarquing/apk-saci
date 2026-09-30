/**
 * Mappers: Convierten entre DTOs y Domain Entities
 * Campos alineados con la API (api-saci)
 */

import {
  Usuario,
  Rol,
  AlmacenAsignado,
  Sesion,
  Movimiento,
  RegistrarMovimientoData,
  QR,
  ResultadoEscaneoQR,
  Producto,
  Categoria,
  ResumenAlmacen,
  TipoOperacion,
  EstadoQR,
} from '../../domain/entities';

import {
  UsuarioDto,
  RolDto,
  AlmacenDto,
  QRDto,
  ValidarQRResponseDto,
  ProductoDto,
  CategoriaDto,
  RegistroDiarioDto,
  LoginResponseDto,
  RegistrarMovimientoRequestDto,
} from '../dtos';

// ==================== USUARIO MAPPER ====================

export class UsuarioMapper {
  static toEntity(dto: UsuarioDto): Usuario {
    return {
      id: dto.id || '',
      nombre: dto.nombre || '',
      email: dto.email || '',
      activo: dto.activo ?? true,
      roles: (dto.roles || []).map(r => RolMapper.toEntity(r)),
      almacenesAsignados: (dto.almacenes || []).map(a => AlmacenMapper.toAlmacenAsignado(a)),
      createdAt: dto.created_at ? new Date(dto.created_at) : new Date(),
      updatedAt: dto.updated_at ? new Date(dto.updated_at) : new Date(),
    };
  }

  static toDto(entity: Partial<Usuario>): Partial<UsuarioDto> {
    return {
      id: entity.id,
      nombre: entity.nombre,
      email: entity.email,
      activo: entity.activo,
      roles: entity.roles?.map(r => RolMapper.toDto(r)),
      almacenes: entity.almacenesAsignados?.map(a => AlmacenMapper.toDto(a)),
    };
  }
}

export class RolMapper {
  static toEntity(dto: RolDto): Rol {
    return {
      id: dto.id,
      nombre: dto.nombre,
      funciones: dto.funciones?.map(f => ({
        id: f.id,
        nombre: f.nombre,
        endpoint: f.endpoint,
      })) || [],
    };
  }

  static toDto(entity: Rol): RolDto {
    return {
      id: entity.id,
      nombre: entity.nombre,
      funciones: entity.funciones.map(f => ({
        id: f.id,
        nombre: f.nombre,
        endpoint: f.endpoint,
      })),
    };
  }
}

export class AlmacenMapper {
  static toAlmacenAsignado(dto: AlmacenDto): AlmacenAsignado {
    return {
      id: dto.id,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
    };
  }

  static toDto(entity: AlmacenAsignado): AlmacenDto {
    return {
      id: entity.id,
      nombre: entity.nombre,
      descripcion: entity.descripcion,
    };
  }
}

// ==================== SESION MAPPER ====================

export class SesionMapper {
  static toEntity(dto: LoginResponseDto, almacenSeleccionado: AlmacenAsignado | null): Sesion {
    // Este mapper ya no se usa, el AuthRepository crea la sesión directamente
    return {
      usuario: {
        id: '',
        nombre: '',
        email: '',
        activo: true,
        roles: [],
        almacenesAsignados: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      token: dto.accessToken || '',
      refreshToken: dto.refreshToken || '',
      almacenSeleccionado,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}

// ==================== MOVIMIENTO MAPPER ====================

export class MovimientoMapper {
  /**
   * Request para POST /api/movimiento-inventario/entrada|salida.
   * Solo los rezagados offline mandan su fecha real; una operación en vivo
   * omite el campo y el servidor estampa la hora actual.
   */
  static toRegistrarRequest(data: RegistrarMovimientoData): RegistrarMovimientoRequestDto {
    return {
      ...(data.qrCodigo ? { qrCodigo: data.qrCodigo } : {}),
      ...(data.productoId ? { productoId: data.productoId } : {}),
      almacenId: data.almacenId,
      cantidad: data.cantidad,
      ...(data.fecha ? { fecha: data.fecha } : {}),
      ...(data.observaciones ? { observaciones: data.observaciones } : {}),
    };
  }

  /**
   * Construye un Movimiento desde los datos de la operación + el ID de la
   * respuesta del API (online) o el id local-... (offline). Los nombres de
   * producto/categoría se resuelven con las caches locales (QR y productos).
   */
  static buildFromOperacion(params: {
    id: string;
    tipo: TipoOperacion;
    data: RegistrarMovimientoData;
    productoNombre: string;
    productoCodigo: string;
    categoriaNombre: string;
    almacenNombre: string;
    sincronizado: boolean;
  }): Movimiento {
    const now = new Date();
    return {
      id: params.id,
      tipo: params.tipo,
      qrCodigo: params.data.qrCodigo || null,
      productoId: params.data.productoId || '',
      productoNombre: params.productoNombre,
      productoCodigo: params.productoCodigo,
      categoriaNombre: params.categoriaNombre,
      almacenId: params.data.almacenId,
      almacenNombre: params.almacenNombre,
      cantidad: params.data.cantidad,
      fecha: params.data.fecha ? new Date(params.data.fecha) : now,
      observaciones: params.data.observaciones || null,
      sincronizado: params.sincronizado,
      createdAt: now,
      updatedAt: now,
    };
  }
}

// ==================== QR MAPPER ====================

export class QRMapper {
  static toEntity(dto: QRDto): QR {
    return {
      id: dto.id,
      codigo: dto.codigo,
      numeroConsecutivo: dto.numeroConsecutivo ?? 0,
      productoId: dto.producto_id,
      productoNombre: dto.producto_nombre,
      productoCodigo: dto.producto_codigo,
      almacenId: dto.almacen_id,
      almacenNombre: dto.almacen_nombre,
      loteId: dto.lote_id,
      estado: (dto.estado as EstadoQR) || 'disponible',
      activo: dto.activo,
      fechaGeneracion: dto.created_at ? new Date(dto.created_at) : null,
      createdAt: dto.created_at ? new Date(dto.created_at) : new Date(),
    };
  }

  static toDto(entity: QR): QRDto {
    return {
      id: entity.id,
      codigo: entity.codigo,
      numeroConsecutivo: entity.numeroConsecutivo,
      producto_id: entity.productoId,
      producto_nombre: entity.productoNombre,
      producto_codigo: entity.productoCodigo,
      almacen_id: entity.almacenId,
      almacen_nombre: entity.almacenNombre,
      lote_id: entity.loteId,
      estado: entity.estado,
      activo: entity.activo,
      created_at: entity.createdAt.toISOString(),
    };
  }
}

export class ValidarQRMapper {
  static toEntity(dto: ValidarQRResponseDto): ResultadoEscaneoQR {
    return {
      valido: dto.valido,
      qr: dto.qr ? QRMapper.toEntity(dto.qr) : null,
      mensaje: dto.mensaje,
      puedeEntrar: dto.puede_entrada,
      puedeSalir: dto.puede_salida,
    };
  }
}

// ==================== PRODUCTO MAPPER ====================

export class ProductoMapper {
  static toEntity(dto: ProductoDto): Producto {
    return {
      id: dto.id,
      codigo: dto.codigo,
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      categoriaId: dto.categoriaId ?? null,
      categoriaNombre: dto.categoriaNombre ?? null,
      unidadNombre: dto.unidadNombre ?? null,
      stockMinimo: dto.stockMinimo ?? 0,
      activo: dto.activo,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
      updatedAt: dto.updatedAt ? new Date(dto.updatedAt) : new Date(),
    };
  }

  static toDto(entity: Producto): ProductoDto {
    return {
      id: entity.id,
      codigo: entity.codigo,
      nombre: entity.nombre,
      descripcion: entity.descripcion,
      categoriaId: entity.categoriaId,
      categoriaNombre: entity.categoriaNombre,
      unidadNombre: entity.unidadNombre,
      stockMinimo: entity.stockMinimo,
      activo: entity.activo,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

// ==================== CATEGORIA MAPPER ====================

export class CategoriaMapper {
  static toEntity(dto: CategoriaDto): Categoria {
    return {
      id: dto.id,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      activo: dto.activo,
      createdAt: dto.created_at ? new Date(dto.created_at) : new Date(),
      updatedAt: dto.updated_at ? new Date(dto.updated_at) : new Date(),
    };
  }
}

// ==================== REGISTRO DIARIO MAPPER ====================

export class RegistroDiarioMapper {
  static toEntity(dto: RegistroDiarioDto): ResumenAlmacen {
    return {
      totalEntradas: dto.totalEntradas ?? 0,
      totalSalidas: dto.totalSalidas ?? 0,
      detalleCategorias: (dto.detalleCategorias || []).map(d => ({
        categoria: d.categoria,
        entradas: d.entradas ?? 0,
        salidas: d.salidas ?? 0,
      })),
    };
  }
}
