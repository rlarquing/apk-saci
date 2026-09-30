/**
 * Domain Entity: Categoria
 * Representa un tipo de vehículo/medio de transporte
 * Campos alineados con la API (api-saci)
 */
export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Lista de tipos de medio con precios
 */
export interface CategoriaConPrecio {
  categoria: Categoria;
  precio: Precio | null;
}

import { Precio } from './Precio';
