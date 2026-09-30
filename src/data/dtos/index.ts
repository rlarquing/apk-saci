/**
 * DTOs para la capa de datos
 * Representan la estructura de datos recibida/enviada al API y almacenada en SQLite
 * Campos alineados con la API (api-saci)
 */

// ==================== AUTH DTOs ====================

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  userId?: number | string;
  userName?: string;
  email?: string;
  functions?: any[];
  menus?: any[];
  almacenes?: any[];
  categorias?: any[];
  roles?: any[];  // {value: string, label: string}[] from API (SelectDto)
}

export interface RefreshTokenRequestDto {
  refresh_token: string;
}

export interface UsuarioDto {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  roles: RolDto[];
  almacenes: AlmacenDto[];
  created_at: string;
  updated_at: string;
}

export interface RolDto {
  id: string;
  nombre: string;
  funciones: FuncionDto[];
}

export interface FuncionDto {
  id: string;
  nombre: string;
  endpoint: string;
}

export interface AlmacenDto {
  id: string;
  nombre: string;
  descripcion: string;
  activo?: boolean;
}

// ==================== MOVIMIENTO DTOs ====================

/** Request para POST /api/movimiento/ (entrada) — alineado con CreateMovimientoDto de api-saci */
export interface RegistrarEntradaRequestDto {
  qrEscaneado: string;
  almacen: string;
  /** Fecha real del cobro en ISO (solo sincronización offline; opcional) */
  fechaEntrada?: string;
}

/** Request para PATCH /api/movimiento/:id (salida) — alineado con UpdateMovimientoDto de api-saci */
export interface RegistrarSalidaRequestDto {
  qrEscaneado: string;
  almacen: string;
  /** Fecha real de la salida en ISO (solo sincronización offline; opcional) */
  fechaSalida?: string;
}

/** Response genérica de la API (ResponseDto) */
export interface ApiResponseDto {
  id?: string;
  successStatus: boolean;
  message: string;
}

export interface MovimientoDto {
  id: string;
  qr_codigo: string;
  almacen_id: string;
  almacen_nombre: string;
  categoria_id: string;
  categoria_nombre: string;
  precio_id: string;
  precio_unitario_cobrado: number;
  fecha_entrada: string;
  fecha_salida: string | null;
  created_at: string;
  updated_at: string;
}

export interface MovimientoActivoDto {
  id: string;
  fecha_entrada: string;
  almacen_id: string;
  almacen_nombre: string;
  categoria_nombre: string;
  precio_monto: number;
}

/** Request POST /api/movimiento/estado — verificar varios QRs a la vez */
export interface VerificarEstadoMovimientosRequestDto {
  codigos: string[];
}

/** Response POST /api/movimiento/estado — alineado con EstadoMovimientoDto de api-saci */
export interface EstadoMovimientoDto {
  codigo: string;
  dentro: boolean;
  fechaSalida: string | null;
}

export interface DetallePorTipoDto {
  categoria: string;
  cantidad: number;
  ingreso: number;
}

export interface ResumenAlmacenDto {
  vehiculosDentro: number;
  vehiculosSalieronHoy: number;
  ingresosHoy: number;
  detallePorTipo: DetallePorTipoDto[];
}

// ==================== QR DTOs ====================

export interface ValidarQRResponseDto {
  valido: boolean;
  qr: QRDto | null;
  mensaje: string;
  puede_entrar: boolean;
  puede_salir: boolean;
  movimiento_activo: MovimientoActivoDto | null;
}

export interface QRDto {
  id: string;
  codigo: string;
  lote_id: string;
  lote_nombre: string;
  activo: boolean;
  categoria_id: string | null;
  categoria_nombre: string | null;
  created_at: string;
}

// ==================== PRECIO DTOs ====================

export interface PrecioDto {
  id: string;
  monto: number;
  categoria_id: string;
  categoria_nombre: string;
  almacen_id: string | null;
  activo: boolean;
  fecha_vigencia_inicio: string;
  fecha_vigencia_fin: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreciosPorTipoDto {
  categoria_id: string;
  categoria_nombre: string;
  precios: PrecioDto[];
}

// ==================== TIPO MEDIO DTOs ====================

export interface CategoriaDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== SYNC DTOs ====================
// Alineados con api-saci SyncRequestDto/SyncResponseDto

export interface SyncRequestDto {
  movimientosPendientes: MovimientoPendienteSyncDto[];
  ultimaSincronizacion: string | null;
}

export interface MovimientoPendienteSyncDto {
  id: string;
  operacion: 'entrada' | 'salida';
  data: {
    qrCodigo?: string;
    almacen?: string;
    movimiento?: string;
  };
  createdAt: string;
}

export interface PrecioSyncDto {
  id: string;
  valor: number;
  categoria: string;
  categoriaNombre: string;
  almacen: string | null;
  activo: boolean;
  fechaInicioVigencia: string;
  fechaFinVigencia: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoriaSyncDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResponseDto {
  exito: boolean;
  movimientosSincronizados: number;
  movimientosConError: number;
  datosActualizados: {
    precios: number;
    categorias: number;
    usuarios: number;
  };
  errores: SyncErrorDto[];
  precios: PrecioSyncDto[];
  categorias: CategoriaSyncDto[];
}

export interface SyncErrorDto {
  id: string;
  operacion: string;
  error: string;
}
