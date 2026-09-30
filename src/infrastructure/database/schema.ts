/**
 * Database Schema - SQLite
 * Define la estructura de la base de datos local
 * Campos alineados con la API (api-saci)
 */

export const DATABASE_NAME = 'saci_offline.db';
export const DATABASE_VERSION = 2;

export const createTablesSQL = `
  -- Tabla de usuarios para login offline
CREATE TABLE IF NOT EXISTS usuarios_offline (
    user_name TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    usuario_json TEXT NOT NULL,
    synced_at TEXT NOT NULL
  );

  -- Tabla de sesión actual
  CREATE TABLE IF NOT EXISTS sesion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    token TEXT,
    refresh_token TEXT,
    usuario_json TEXT NOT NULL,
    almacen_seleccionado_json TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL
  );

  -- Tabla de movimientos pendientes de sincronización
  CREATE TABLE IF NOT EXISTS movimientos_pendientes (
    id_local TEXT PRIMARY KEY,
    operacion TEXT NOT NULL CHECK(operacion IN ('entrada', 'salida')),
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reintentos INTEGER DEFAULT 0,
    sincronizado INTEGER DEFAULT 0,
    movimiento_id TEXT
  );

  -- Tabla de movimientos locales (cache)
  -- Campos alineados con MovimientoEntity del API
  CREATE TABLE IF NOT EXISTS movimientos_cache (
    id TEXT PRIMARY KEY,
    qr_codigo TEXT NOT NULL,
    almacen_id TEXT NOT NULL,
    almacen_nombre TEXT,
    categoria_id TEXT,
    categoria_nombre TEXT,
    precio_id TEXT,
    precio_unitario_cobrado REAL DEFAULT 0,
    fecha_entrada TEXT NOT NULL,
    fecha_salida TEXT,
    sincronizado INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de QRs (cache)
  CREATE TABLE IF NOT EXISTS qrs_cache (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    lote_id TEXT,
    lote_nombre TEXT,
    activo INTEGER DEFAULT 1,
    categoria_id TEXT,
    categoria_nombre TEXT,
    created_at TEXT NOT NULL
  );

  -- Tabla de precios (cache)
  CREATE TABLE IF NOT EXISTS precios_cache (
    id TEXT PRIMARY KEY,
    monto REAL NOT NULL,
    categoria_id TEXT NOT NULL,
    categoria_nombre TEXT,
    almacen_id TEXT,
    activo INTEGER DEFAULT 1,
    fecha_vigencia_inicio TEXT NOT NULL,
    fecha_vigencia_fin TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de tipos de medio (cache)
  -- Sin campo 'orden' (no existe en el API)
  CREATE TABLE IF NOT EXISTS categorias_cache (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de almacenes (cache)
  -- Usa 'descripcion' en vez de 'direccion', sin 'capacidad' (no existe en el API)
  CREATE TABLE IF NOT EXISTS almacenes_cache (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de configuración
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Índices para búsquedas rápidas
  CREATE INDEX IF NOT EXISTS idx_movimientos_almacen ON movimientos_cache(almacen_id);
  CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_cache(fecha_entrada);
  CREATE INDEX IF NOT EXISTS idx_movimientos_sincronizado ON movimientos_cache(sincronizado);
  CREATE INDEX IF NOT EXISTS idx_qrs_codigo ON qrs_cache(codigo);
  CREATE INDEX IF NOT EXISTS idx_precios_categoria ON precios_cache(categoria_id);
  CREATE INDEX IF NOT EXISTS idx_precios_almacen ON precios_cache(almacen_id);
  CREATE INDEX IF NOT EXISTS idx_pendientes_sincronizado ON movimientos_pendientes(sincronizado);
`;

// Claves de configuración
export const CONFIG_KEYS = {
  LAST_SYNC: 'ultima_sincronizacion',
  API_URL: 'api_url',
  USER_ID: 'user_id',
  FIRST_SYNC_DONE: 'primera_sincronizacion_completada',
} as const;
