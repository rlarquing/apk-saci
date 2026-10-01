/**
 * Contrato del repositorio de conteo cíclico (online-only por diseño:
 * el conteo es una actividad supervisada contra el stock real del API).
 */
import {
  ConteoInventario,
  EstadoConteo,
  ResultadoConteo,
  ResultadoListaConteos,
} from '../entities/Conteo';

export interface ConteoRepository {
  listarConteos(estado?: EstadoConteo): Promise<ResultadoListaConteos>;
  obtenerConteo(conteoId: string): Promise<ConteoInventario | null>;
  crearConteo(almacenId: string, esCiego: boolean): Promise<ResultadoConteo>;
  contarProducto(
    conteoId: string,
    productoId: string,
    cantidad: number,
  ): Promise<ResultadoConteo>;
  cerrarConteo(conteoId: string): Promise<ResultadoConteo>;
  cancelarConteo(conteoId: string): Promise<ResultadoConteo>;
}
