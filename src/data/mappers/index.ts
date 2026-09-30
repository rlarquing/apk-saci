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
  MovimientoActivo,
  RegistrarEntradaData,
  RegistrarSalidaData,
  QR,
  ResultadoEscaneoQR,
  Precio,
  Categoria,
  ResumenAlmacen,
  DetallePorTipo,
} from '../../domain/entities';

import {
  UsuarioDto,
  RolDto,
  AlmacenDto,
  MovimientoDto,
  MovimientoActivoDto,
  QRDto,
  ValidarQRResponseDto,
  PrecioDto,
  CategoriaDto,
  ResumenAlmacenDto,
  DetallePorTipoDto,
  LoginResponseDto,
  RegistrarEntradaRequestDto,
  RegistrarSalidaRequestDto,
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
      almacenesAsignados: (dto.almacenes || []).map(p => AlmacenMapper.toAlmacenAsignado(p)),
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
      almacenes: entity.almacenesAsignados?.map(p => AlmacenMapper.toDto(p)),
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
  static toEntity(dto: MovimientoDto): Movimiento {
    return {
      id: dto.id,
      qrCodigo: dto.qr_codigo,
      almacenId: dto.almacen_id,
      almacenNombre: dto.almacen_nombre,
      categoriaId: dto.categoria_id,
      categoriaNombre: dto.categoria_nombre,
      precioId: dto.precio_id,
      precioUnitarioCobrado: dto.precio_unitario_cobrado,
      fechaEntrada: new Date(dto.fecha_entrada),
      fechaSalida: dto.fecha_salida ? new Date(dto.fecha_salida) : null,
      sincronizado: true,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    };
  }

  static toDto(entity: Partial<Movimiento>): Partial<MovimientoDto> {
    return {
      id: entity.id,
      qr_codigo: entity.qrCodigo,
      almacen_id: entity.almacenId,
      almacen_nombre: entity.almacenNombre,
      categoria_id: entity.categoriaId,
      categoria_nombre: entity.categoriaNombre,
      precio_id: entity.precioId,
      precio_unitario_cobrado: entity.precioUnitarioCobrado,
      fecha_entrada: entity.fechaEntrada?.toISOString(),
      fecha_salida: entity.fechaSalida?.toISOString() || null,
    };
  }

  static toRegistrarEntradaRequest(data: RegistrarEntradaData): RegistrarEntradaRequestDto {
    return {
      qrEscaneado: data.qrCodigo,
      almacen: data.almacenId,
      // Solo los rezagados offline mandan su fecha real; una entrada en vivo
      // omite el campo y el servidor estampa la hora actual.
      ...(data.fechaEntrada ? { fechaEntrada: data.fechaEntrada } : {}),
    };
  }

  static toRegistrarSalidaRequest(data: RegistrarSalidaData): RegistrarSalidaRequestDto {
    return {
      qrEscaneado: data.qrCodigo,
      almacen: data.almacenId,
      // Solo los rezagados offline mandan su fecha real; una salida en vivo
      // omite el campo y el servidor estampa la hora actual.
      ...(data.fechaSalida ? { fechaSalida: data.fechaSalida } : {}),
    };
  }

  /**
   * Construye un Movimiento parcial desde los datos de entrada + el ID que devuelve la API.
   * La API solo retorna { id, successStatus, message }, no el objeto completo.
   */
  static buildFromEntradaResponse(id: string, data: RegistrarEntradaData): Movimiento {
    return {
      id,
      qrCodigo: data.qrCodigo,
      almacenId: data.almacenId,
      almacenNombre: '',
      categoriaId: data.categoriaId,
      categoriaNombre: '',
      precioId: data.precioId,
      precioUnitarioCobrado: data.precioMonto,
      fechaEntrada: data.fechaEntrada ? new Date(data.fechaEntrada) : new Date(),
      fechaSalida: null,
      sincronizado: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static buildFromSalidaResponse(id: string, data: RegistrarSalidaData): Movimiento {
    return {
      id,
      qrCodigo: data.qrCodigo,
      almacenId: data.almacenId,
      almacenNombre: '',
      categoriaId: '',
      categoriaNombre: '',
      precioId: '',
      precioUnitarioCobrado: 0,
      fechaEntrada: new Date(),
      fechaSalida: new Date(),
      sincronizado: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class MovimientoActivoMapper {
  static toEntity(dto: MovimientoActivoDto): MovimientoActivo {
    return {
      id: dto.id,
      fechaEntrada: new Date(dto.fecha_entrada),
      almacenId: dto.almacen_id,
      almacenNombre: dto.almacen_nombre,
      categoriaNombre: dto.categoria_nombre,
      precioMonto: dto.precio_monto,
    };
  }
}

// ==================== QR MAPPER ====================

export class QRMapper {
  static toEntity(dto: QRDto): QR {
    return {
      id: dto.id,
      codigo: dto.codigo,
      loteId: dto.lote_id,
      loteNombre: dto.lote_nombre,
      activo: dto.activo,
      categoriaId: dto.categoria_id,
      categoriaNombre: dto.categoria_nombre,
      createdAt: new Date(dto.created_at),
    };
  }

  static toDto(entity: QR): QRDto {
    return {
      id: entity.id,
      codigo: entity.codigo,
      lote_id: entity.loteId,
      lote_nombre: entity.loteNombre,
      activo: entity.activo,
      categoria_id: entity.categoriaId,
      categoria_nombre: entity.categoriaNombre,
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
      puedeEntrar: dto.puede_entrar,
      puedeSalir: dto.puede_salir,
      movimientoActivo: dto.movimiento_activo 
        ? MovimientoActivoMapper.toEntity(dto.movimiento_activo) 
        : null,
    };
  }
}

// ==================== PRECIO MAPPER ====================

export class PrecioMapper {
  static toEntity(dto: PrecioDto): Precio {
    return {
      id: dto.id,
      monto: dto.monto,
      categoriaId: dto.categoria_id,
      categoriaNombre: dto.categoria_nombre,
      almacenId: dto.almacen_id,
      activo: dto.activo,
      fechaVigenciaInicio: new Date(dto.fecha_vigencia_inicio),
      fechaVigenciaFin: dto.fecha_vigencia_fin ? new Date(dto.fecha_vigencia_fin) : null,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    };
  }

  static toDto(entity: Precio): PrecioDto {
    return {
      id: entity.id,
      monto: entity.monto,
      categoria_id: entity.categoriaId,
      categoria_nombre: entity.categoriaNombre,
      almacen_id: entity.almacenId,
      activo: entity.activo,
      fecha_vigencia_inicio: entity.fechaVigenciaInicio.toISOString(),
      fecha_vigencia_fin: entity.fechaVigenciaFin?.toISOString() || null,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }
}

// ==================== TIPO MEDIO MAPPER ====================

export class CategoriaMapper {
  static toEntity(dto: CategoriaDto): Categoria {
    return {
      id: dto.id,
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      activo: dto.activo,
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at),
    };
  }

  static toDto(entity: Categoria): CategoriaDto {
    return {
      id: entity.id,
      nombre: entity.nombre,
      descripcion: entity.descripcion,
      activo: entity.activo,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }
}

// ==================== RESUMEN PARQUEO MAPPER ====================

export class ResumenAlmacenMapper {
  static toEntity(dto: ResumenAlmacenDto): ResumenAlmacen {
    return {
      vehiculosDentro: dto.vehiculosDentro,
      vehiculosSalieronHoy: dto.vehiculosSalieronHoy,
      ingresosHoy: dto.ingresosHoy,
      detallePorTipo: (dto.detallePorTipo || []).map((d: DetallePorTipoDto): DetallePorTipo => ({
        categoria: d.categoria,
        cantidad: d.cantidad,
        ingreso: d.ingreso,
      })),
    };
  }
}
