/**
 * Remote DataSource: Categoria (Nomenclador)
 * GET /api/nomenclador/categoria/create/select → SelectDto[] {value, label}
 * (endpoint público y liviano del nomenclador genérico)
 */
import { networkService } from '@/src/infrastructure';

export class CategoriaRemoteDataSource {
  /**
   * Descarga la lista liviana de categorías (id + nombre).
   * Se usa cuando el sync no trae el catálogo completo en su respuesta:
   * descripcion=null, activo=true.
   */
  async obtenerCategoriasSelect(): Promise<Array<{ value: string; label: string }>> {
    try {
      const response = await networkService.get<Array<{ value: string; label: string }>>(
        '/api/nomenclador/categoria/create/select'
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      return [];
    }
  }
}
