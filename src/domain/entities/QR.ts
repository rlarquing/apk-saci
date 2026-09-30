/**
 * Domain Entity: QR
 * Representa un código QR del sistema
 */
export interface QR {
  id: string;
  codigo: string;
  loteId: string;
  loteNombre: string;
  activo: boolean;
  categoriaId: string | null;
  categoriaNombre: string | null;
  createdAt: Date;
}

/**
 * Resultado de escanear un QR
 */
export interface ResultadoEscaneoQR {
  valido: boolean;
  qr: QR | null;
  mensaje: string;
  puedeEntrar: boolean;
  puedeSalir: boolean;
  movimientoActivo: MovimientoActivo | null;
}

/**
 * Movimiento activo asociado a un QR
 */
export interface MovimientoActivo {
  id: string;
  fechaEntrada: Date;
  almacenId: string;
  almacenNombre: string;
  categoriaNombre: string;
  precioMonto: number;
}

import { Movimiento } from './Movimiento';
