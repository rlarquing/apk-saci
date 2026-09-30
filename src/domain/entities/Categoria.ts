/**
 * Domain Entity: Categoria
 * Representa una categoría de productos (nomenclador del API)
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
