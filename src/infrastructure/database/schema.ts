/**
 * Database Schema - SQLite
 * Define la estructura de la base de datos local
 * Campos alineados con la API (api-saci)
 */

export const DATABASE_NAME = 'saci_offline.db';
export const DATABASE_VERSION = 5;

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
  -- El API /api/sync solo acepta entrada|salida (ajustes y traslados son web)
  CREATE TABLE IF NOT EXISTS movimientos_pendientes (
    id_local TEXT PRIMARY KEY,
    operacion TEXT NOT NULL CHECK(operacion IN ('entrada', 'salida')),
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reintentos INTEGER DEFAULT 0,
    sincronizado INTEGER DEFAULT 0,
    movimiento_id TEXT
  );

  -- Ledger local de movimientos de inventario (cache)
  -- Cada movimiento es un registro independiente e inmutable:
  -- tipo ENTRADA (suma stock) o SALIDA (resta stock), con su cantidad.
  CREATE TABLE IF NOT EXISTS movimientos_cache (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida')),
    qr_codigo TEXT,
    producto_id TEXT NOT NULL,
    producto_nombre TEXT,
    producto_codigo TEXT,
    categoria_nombre TEXT,
    almacen_id TEXT NOT NULL,
    almacen_nombre TEXT,
    cantidad REAL NOT NULL,
    fecha TEXT NOT NULL,
    observaciones TEXT,
    sincronizado INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de etiquetas QR reutilizables (cache)
  -- Ciclo de vida: disponible → asignado (anulable). No es un ticket.
  CREATE TABLE IF NOT EXISTS qrs_cache (
    id TEXT PRIMARY KEY,
    codigo TEXT UNIQUE NOT NULL,
    numero_consecutivo INTEGER DEFAULT 0,
    producto_id TEXT,
    producto_nombre TEXT,
    producto_codigo TEXT,
    almacen_id TEXT,
    almacen_nombre TEXT,
    lote_id TEXT,
    estado TEXT DEFAULT 'disponible',
    activo INTEGER DEFAULT 1,
    fecha_generacion TEXT,
    created_at TEXT NOT NULL
  );

  -- Tabla de productos (catálogo, cache)
  -- codigo = SKU autogenerado PRD-XXXXXX
  CREATE TABLE IF NOT EXISTS productos_cache (
    id TEXT PRIMARY KEY,
    codigo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    categoria_id TEXT,
    categoria_nombre TEXT,
    unidad_nombre TEXT,
    stock_minimo REAL DEFAULT 0,
    stock_seguridad REAL DEFAULT 0,
    activo INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Niveles de stock por producto/almacén (safety stock — backlog P2)
  -- Punto de reorden = stock_minimo + stock_seguridad. Llega con cada sync.
  CREATE TABLE IF NOT EXISTS niveles_stock_cache (
    producto_id TEXT NOT NULL,
    almacen_id TEXT NOT NULL,
    stock_minimo REAL NOT NULL DEFAULT 0,
    stock_seguridad REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producto_id, almacen_id)
  );

  -- Bins por producto/almacén (ubicación de estantería — backlog P3)
  -- Llega de GET /api/producto-ubicacion y del sync; el escáner lo muestra
  -- en la ficha del producto escaneado.
  CREATE TABLE IF NOT EXISTS producto_ubicacion_cache (
    producto_id TEXT NOT NULL,
    almacen_id TEXT NOT NULL,
    ubicacion_nombre TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producto_id, almacen_id)
  );

  -- Tabla de stock derivado (cache)
  -- El stock NUNCA se calcula localmente: llega del API en cada sync
  -- (es un valor derivado del kardex completo del servidor).
  CREATE TABLE IF NOT EXISTS stock_cache (
    producto_id TEXT NOT NULL,
    almacen_id TEXT NOT NULL,
    stock REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (producto_id, almacen_id)
  );

  -- Tabla de categorías (nomenclador, cache)
  CREATE TABLE IF NOT EXISTS categorias_cache (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Tabla de almacenes (nomenclador, cache)
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
  CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_cache(fecha);
  CREATE INDEX IF NOT EXISTS idx_movimientos_sincronizado ON movimientos_cache(sincronizado);
  CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_cache(producto_id);
  CREATE INDEX IF NOT EXISTS idx_qrs_codigo ON qrs_cache(codigo);
  CREATE INDEX IF NOT EXISTS idx_qrs_estado ON qrs_cache(estado);
  CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos_cache(codigo);
  CREATE INDEX IF NOT EXISTS idx_niveles_almacen ON niveles_stock_cache(almacen_id);
  CREATE INDEX IF NOT EXISTS idx_bins_almacen ON producto_ubicacion_cache(almacen_id);
  CREATE INDEX IF NOT EXISTS idx_stock_producto ON stock_cache(producto_id);
  CREATE INDEX IF NOT EXISTS idx_stock_almacen ON stock_cache(almacen_id);
  CREATE INDEX IF NOT EXISTS idx_pendientes_sincronizado ON movimientos_pendientes(sincronizado);
`;

// Claves de configuración
export const CONFIG_KEYS = {
  LAST_SYNC: 'ultima_sincronizacion',
  API_URL: 'api_url',
  USER_ID: 'user_id',
  FIRST_SYNC_DONE: 'primera_sincronizacion_completada',
} as const;
