/**
 * Domain Entities - Exports
 */
export * from './Usuario';
export * from './Movimiento';
export * from './QR';
export * from './Precio';
export * from './Almacen';
export * from './Categoria';

/**
 * Sync Data - Datos para sincronización
 */
export interface SyncData {
  movimientosPendientes: MovimientoPendiente[];
  ultimaSincronizacion: Date | null;
}

export interface SyncResult {
  exito: boolean;
  movimientosSincronizados: number;
  movimientosConError: number;
  datosActualizados: {
    precios: number;
    tiposMedio: number;
    usuarios: number;
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

import { MovimientoPendiente } from './Movimiento';
