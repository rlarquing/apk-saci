/**
 * Database Service - SQLite
 * Maneja la conexión y operaciones de la base de datos local
 * Incluye migración para cambios de esquema
 */
import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME, DATABASE_VERSION, createTablesSQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Inicializa la base de datos
 * Si la versión del esquema cambió, migra las tablas cache
 */
export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);

    // Verificar versión del esquema y migrar si es necesario
    await migrateSchema();

    // Crear tablas
    await db.execAsync(createTablesSQL);

    return db;
  } catch (error) {
    throw error;
  }
}

/**
 * Migra el esquema si la versión cambió
 * Las tablas cache se eliminan y recrean (los datos se re-descargan del servidor)
 * Las tablas de sesión se preservan
 */
async function migrateSchema(): Promise<void> {
  if (!db) return;

  try {
    // Verificar si existe la tabla de configuración con la versión
    const versionRow = await db.getFirstAsync<{ valor: string }>(
      "SELECT valor FROM configuracion WHERE clave = 'db_version'"
    );

    const currentVersion = versionRow ? parseInt(versionRow.valor, 10) : 0;

    if (currentVersion < DATABASE_VERSION) {
      // Eliminar tablas cache que cambiaron (los datos se re-descargan)
      await db.execAsync(`
        DROP TABLE IF EXISTS movimientos_cache;
        DROP TABLE IF EXISTS qrs_cache;
        DROP TABLE IF EXISTS productos_cache;
        DROP TABLE IF EXISTS stock_cache;
        DROP TABLE IF EXISTS almacenes_cache;
        DROP TABLE IF EXISTS categorias_cache;
        DROP TABLE IF EXISTS movimientos_pendientes;
        DROP TABLE IF EXISTS producto_ubicacion_cache;
      `);

      // Guardar nueva versión
      await db.runAsync(
        "INSERT OR REPLACE INTO configuracion (clave, valor, updated_at) VALUES ('db_version', ?, ?)",
        [DATABASE_VERSION.toString(), new Date().toISOString()]
      );
    }
  } catch (error) {
    // Si la tabla configuracion no existe aún (primera instalación), no hay problema
  }
}

/**
 * Obtiene la instancia de la base de datos
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Base de datos no inicializada. Llama a initDatabase() primero.');
  }
  return db;
}

/**
 * Cierra la conexión a la base de datos
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

/**
 * Ejecuta una consulta y retorna todos los resultados
 */
export async function executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
  const database = getDatabase();
  const result = await database.getAllAsync<T>(sql, params);
  return result;
}

/**
 * Ejecuta una consulta y retorna el primer resultado
 */
export async function executeQueryFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
  const database = getDatabase();
  const result = await database.getFirstAsync<T>(sql, params);
  return result || null;
}

/**
 * Ejecuta una sentencia INSERT, UPDATE o DELETE
 */
export async function executeUpdate(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
  const database = getDatabase();
  const result = await database.runAsync(sql, params);
  return result;
}

/**
 * Ejecuta múltiples sentencias en una transacción
 */
export async function executeTransaction(
  operations: Array<{ sql: string; params: any[] }>
): Promise<void> {
  const database = getDatabase();
  
  await database.withTransactionAsync(async () => {
    for (const op of operations) {
      await database.runAsync(op.sql, op.params);
    }
  });
}

/**
 * Limpia todas las tablas de cache
 */
export async function clearCache(): Promise<void> {
  const database = getDatabase();

  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM movimientos_cache');
    await database.runAsync('DELETE FROM movimientos_pendientes');
    await database.runAsync('DELETE FROM qrs_cache');
    await database.runAsync('DELETE FROM productos_cache');
    await database.runAsync('DELETE FROM stock_cache');
    await database.runAsync('DELETE FROM categorias_cache');
    await database.runAsync('DELETE FROM almacenes_cache');
    await database.runAsync('DELETE FROM producto_ubicacion_cache');
  });
}

/**
 * Obtiene el tamaño de la base de datos
 */
export async function getDatabaseStats(): Promise<{
  movimientos: number;
  qrs: number;
  productos: number;
  stock: number;
  pendientes: number;
}> {
  const database = getDatabase();

  const movimientos = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM movimientos_cache'
  );
  const qrs = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM qrs_cache'
  );
  const productos = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM productos_cache'
  );
  const stock = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM stock_cache'
  );
  const pendientes = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM movimientos_pendientes WHERE sincronizado = 0'
  );

  return {
    movimientos: movimientos?.count || 0,
    qrs: qrs?.count || 0,
    productos: productos?.count || 0,
    stock: stock?.count || 0,
    pendientes: pendientes?.count || 0,
  };
}
