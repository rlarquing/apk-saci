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
  userId?: string;
  userName?: string;
  email?: string;
  functions?: any[];
  menus?: any[];
  /** SelectDto[] {value, label} del API: almacenes del usuario (ADMIN: todos) */
  almacenes?: any[];
  /** SelectDto[] {value, label} del API: categorías */
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

/**
 * Request para POST /api/movimiento-inventario/entrada y /salida.
 * Alineado con CreateEntradaDto/CreateSalidaDto del API: requiere qrCodigo
 * o productoId, mas almacenId y cantidad (0.01-999999.99). Cualquier campo
 * extra en el body provoca 400 (ValidationPipe forbidNonWhitelisted).
 */
export interface RegistrarMovimientoRequestDto {
  qrCodigo?: string;
  productoId?: string;
  almacenId: string;
  cantidad: number;
  /** Fecha real en ISO (solo sincronización offline; opcional) */
  fecha?: string;
  observaciones?: string;
}

/** Response genérica de la API (ResponseDto) */
export interface ApiResponseDto {
  id?: string;
  successStatus: boolean;
  message: string;
}

/**
 * Registro diario del almacen (GET /api/registro-diario/actual/:almacenId).
 * Resumen del DÍA actual: el endpoint no acepta fecha.
 */
export interface RegistroDiarioDto {
  id?: string;
  fecha?: string;
  estado?: 'abierto' | 'cerrado';
  almacen?: { id: string; nombre: string; descripcion?: string };
  totalEntradas: number;
  totalSalidas: number;
  detalleCategorias: Array<{ categoria: string; entradas: number; salidas: number }>;
}

/**
 * Fila de stock derivado (GET /api/movimiento-inventario/stock).
 * Sin filtros retorna el stock de todos los almacenes del usuario.
 */
export interface StockApiDto {
  productoId: string;
  almacenId: string;
  productoNombre: string;
  productoCodigo: string;
  almacenNombre: string;
  stock: number;
}

// ==================== QR DTOs ====================

/**
 * Response de GET /api/qr/validar (ValidarQrResponseDto del API).
 * puede_entrada es true siempre que la etiqueta no esté anulada;
 * puede_salida/puede_ajuste solo con estado 'asignado'.
 */
export interface ValidarQRResponseDto {
  valido: boolean;
  qr: QRDto | null;
  mensaje: string;
  puede_entrada: boolean;
  puede_salida: boolean;
  puede_ajuste: boolean;
  movimiento_activo: any | null; // Siempre null en SACI (informativo)
}

export interface QRDto {
  id: string;
  codigo: string;
  numeroConsecutivo: number;
  producto_id: string | null;
  producto_nombre: string | null;
  producto_codigo: string | null;
  almacen_id: string | null;
  almacen_nombre: string | null;
  lote_id: string | null;
  estado: string; // 'disponible' | 'asignado' | 'anulado'
  activo: boolean;
  created_at: string;
}

// ==================== PRODUCTO / CATEGORIA DTOs ====================

/** ReadProductoDto del API (listado) */
export interface ProductoDto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: string | null;
  categoriaNombre: string | null;
  unidadId?: string | null;
  unidadNombre: string | null;
  stockMinimo: number;
  activo: boolean;
  createdAt: string;
  updatedAt?: string;
}

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
  /**
   * Shape que consume sync.service (movimientoInventarioService.entrada/salida):
   * requiere qrCodigo o productoId, mas almacenId y cantidad. El DTO del API
   * solo declara @IsObject, pero sin estos campos falla en runtime.
   */
  data: {
    qrCodigo?: string;
    productoId?: string;
    almacenId: string;
    cantidad: number;
    fecha?: string;
    observaciones?: string;
  };
  createdAt: string;
}

export interface ProductoSyncDto {
  id: string;
  codigo: string;
  nombre: string;
  categoriaId: string;
  categoriaNombre: string;
  unidadNombre: string;
  stockMinimo: number;
  activo: boolean;
  updatedAt: string;
}

export interface StockSyncDto {
  productoId: string;
  almacenId: string;
  stock: number;
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
    productos: number;
    categorias: number;
  };
  errores: SyncErrorDto[];
  productos: ProductoSyncDto[];
  stock: StockSyncDto[];
  categorias: CategoriaSyncDto[];
}

export interface SyncErrorDto {
  id: string;
  operacion: string;
  error: string;
}

// ============ CONTEO CÍCLICO ============

export interface ConteoLineaDto {
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  cantidadEsperada: number;
  cantidadContada: number | null;
  stockAlCierre: number | null;
  diferencia: number | null;
  ajusteId: string | null;
  observaciones?: string | null;
}

/** Reflejo del ReadConteoDto del API (con líneas embebidas). */
export interface ConteoDto {
  id: string;
  almacenId: string;
  almacenNombre: string;
  userName: string;
  estado: 'ABIERTO' | 'CERRADO' | 'CANCELADO';
  esCiego: boolean;
  fechaApertura?: string;
  fechaCierre?: string;
  lineas: ConteoLineaDto[];
  resumen: {
    lineas: number;
    contadas: number;
    sinContar: number;
    sobrantes: number;
    faltantes: number;
    ajustesGenerados: number;
    errores: Array<{ productoCodigo: string; error: string }>;
  } | null;
  totalLineas: number;
  totalContadas: number;
}

export interface CrearConteoRequestDto {
  almacenId: string;
  esCiego: boolean;
}

export interface ConteoLineaRequestDto {
  productoId: string;
  cantidadContada: number;
}
