/**
 * Domain Entities - Exports
 */
export * from './Usuario';
export * from './Movimiento';
export * from './QR';
export * from './Producto';
export * from './Almacen';
export * from './Categoria';

export interface SyncResult {
  exito: boolean;
  movimientosSincronizados: number;
  movimientosConError: number;
  datosActualizados: {
    productos: number;
    categorias: number;
    stock: number;
    qrs?: number;
    almacenes?: number;
  };
  errores: SyncError[];
}

export interface SyncError {
  idLocal: string;
  operacion: string;
  error: string;
}
