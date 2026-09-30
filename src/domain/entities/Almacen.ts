/**
 * Domain Entity: Almacen
 * Representa un estacionamiento/almacen
 */
export interface Almacen {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resumen del estado de un almacen
 * Alineado con api-saci ResumenAlmacenDto
 */
export interface DetallePorTipo {
  categoria: string;
  cantidad: number;
  ingreso: number;
}

export interface ResumenAlmacen {
  vehiculosDentro: number;
  vehiculosSalieronHoy: number;
  ingresosHoy: number;
  detallePorTipo: DetallePorTipo[];
}


