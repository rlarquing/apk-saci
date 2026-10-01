/**
 * Use cases del conteo cíclico de inventario (backlog P1).
 * Devuelven ResultadoConteo/ResultadoListaConteos (nunca lanzan) para que
 * las pantallas muestren los mensajes directamente.
 */
import {
  ConteoInventario,
  EstadoConteo,
  ResultadoConteo,
  ResultadoListaConteos,
} from '../entities/Conteo';
import { ConteoRepository } from '../repositories/ConteoRepository';

export class ListarConteosUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(estado?: EstadoConteo): Promise<ResultadoListaConteos> {
    return await this.conteoRepository.listarConteos(estado);
  }
}

export class ObtenerConteoUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(conteoId: string): Promise<{
    exito: boolean;
    mensaje: string;
    conteo: ConteoInventario | null;
  }> {
    try {
      const conteo = await this.conteoRepository.obtenerConteo(conteoId);
      if (!conteo) {
        return { exito: false, mensaje: 'No se pudo cargar el conteo', conteo: null };
      }
      return { exito: true, mensaje: 'OK', conteo };
    } catch (error) {
      return {
        exito: false,
        mensaje: error instanceof Error ? error.message : 'Error al cargar el conteo',
        conteo: null,
      };
    }
  }
}

export class CrearConteoUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(almacenId: string, esCiego: boolean): Promise<ResultadoConteo> {
    return await this.conteoRepository.crearConteo(almacenId, esCiego);
  }
}

export class ContarProductoUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(
    conteoId: string,
    productoId: string,
    cantidad: number
  ): Promise<ResultadoConteo> {
    return await this.conteoRepository.contarProducto(conteoId, productoId, cantidad);
  }
}

export class CerrarConteoUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(conteoId: string): Promise<ResultadoConteo> {
    return await this.conteoRepository.cerrarConteo(conteoId);
  }
}

export class CancelarConteoUseCase {
  constructor(private conteoRepository: ConteoRepository) {}

  async execute(conteoId: string): Promise<ResultadoConteo> {
    return await this.conteoRepository.cancelarConteo(conteoId);
  }
}
