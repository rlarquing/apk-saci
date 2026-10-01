/**
 * Implementación del repositorio de conteo cíclico.
 * ONLINE-ONLY: sin caché local ni cola de pendientes. Un conteo compara
 * cantidades físicas contra el stock real del API, así que degradar a
 * offline sería inventar datos; sin conexión se devuelve error limpio.
 */
import {
  ConteoInventario,
  ConteoLinea,
  EstadoConteo,
  ResultadoConteo,
  ResultadoListaConteos,
} from '../../domain/entities/Conteo';
import { ConteoRepository } from '../../domain/repositories/ConteoRepository';
import { ConteoDto, ConteoLineaDto } from '../dtos';
import { ConteoInventarioRemoteDataSource } from '../datasources/remote/ConteoInventarioRemoteDataSource';
import { ApiError, networkService } from '../../infrastructure/network/NetworkService';

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkError() || error.isTimeout()) {
      return 'Sin conexión con el servidor: el conteo requiere estar en línea';
    }
    if (error.isUnauthorized()) return 'Sesión expirada. Vuelve a iniciar sesión';
    if (error.isForbidden()) return 'No tienes permisos para operar este conteo';
    if (error.isNotFound()) return 'El conteo o producto no existe';
    return error.message || 'Error del servidor';
  }
  return error instanceof Error ? error.message : 'Error inesperado';
}

function mapLinea(dto: ConteoLineaDto): ConteoLinea {
  return {
    productoId: dto.productoId,
    productoCodigo: dto.productoCodigo,
    productoNombre: dto.productoNombre,
    cantidadEsperada: dto.cantidadEsperada,
    cantidadContada: dto.cantidadContada ?? null,
    stockAlCierre: dto.stockAlCierre ?? null,
    diferencia: dto.diferencia ?? null,
    ajusteId: dto.ajusteId ?? null,
    observaciones: dto.observaciones ?? null,
  };
}

function mapConteo(dto: ConteoDto): ConteoInventario {
  return {
    id: dto.id,
    almacenId: dto.almacenId,
    almacenNombre: dto.almacenNombre,
    userName: dto.userName,
    estado: dto.estado,
    esCiego: dto.esCiego,
    fechaApertura: dto.fechaApertura,
    fechaCierre: dto.fechaCierre,
    lineas: (dto.lineas ?? []).map(mapLinea),
    resumen: dto.resumen ?? null,
    totalLineas: dto.totalLineas ?? dto.lineas?.length ?? 0,
    totalContadas:
      dto.totalContadas ??
      (dto.lineas ?? []).filter((l) => l.cantidadContada !== null).length,
  };
}

export class ConteoRepositoryImpl implements ConteoRepository {
  constructor(private remoteDataSource: ConteoInventarioRemoteDataSource) {}

  async listarConteos(estado?: EstadoConteo): Promise<ResultadoListaConteos> {
    try {
      if (!(await networkService.checkConnection())) {
        return {
          exito: false,
          mensaje: 'Sin conexión con el servidor: el conteo requiere estar en línea',
          conteos: [],
        };
      }
      const dtos = await this.remoteDataSource.listar(estado);
      return { exito: true, mensaje: 'OK', conteos: dtos.map(mapConteo) };
    } catch (error) {
      return { exito: false, mensaje: mensajeDeError(error), conteos: [] };
    }
  }

  async obtenerConteo(conteoId: string): Promise<ConteoInventario | null> {
    try {
      const dto = await this.remoteDataSource.obtener(conteoId);
      return mapConteo(dto);
    } catch {
      return null;
    }
  }

  async crearConteo(almacenId: string, esCiego: boolean): Promise<ResultadoConteo> {
    try {
      const respuesta = await this.remoteDataSource.crear({ almacenId, esCiego });
      return {
        exito: respuesta.successStatus === true,
        mensaje: respuesta.message || (respuesta.successStatus ? 'Conteo abierto' : 'No se pudo abrir el conteo'),
        conteoId: respuesta.id,
      };
    } catch (error) {
      return { exito: false, mensaje: mensajeDeError(error) };
    }
  }

  async contarProducto(
    conteoId: string,
    productoId: string,
    cantidad: number
  ): Promise<ResultadoConteo> {
    try {
      const respuesta = await this.remoteDataSource.contarLinea(conteoId, {
        productoId,
        cantidadContada: cantidad,
      });
      return {
        exito: respuesta.successStatus === true,
        mensaje: respuesta.message || 'Cantidad registrada',
        conteoId,
      };
    } catch (error) {
      return { exito: false, mensaje: mensajeDeError(error), conteoId };
    }
  }

  async cerrarConteo(conteoId: string): Promise<ResultadoConteo> {
    try {
      const respuesta = await this.remoteDataSource.cerrar(conteoId);
      return {
        exito: respuesta.successStatus === true,
        mensaje: respuesta.message || 'Conteo cerrado',
        conteoId,
      };
    } catch (error) {
      return { exito: false, mensaje: mensajeDeError(error), conteoId };
    }
  }

  async cancelarConteo(conteoId: string): Promise<ResultadoConteo> {
    try {
      const respuesta = await this.remoteDataSource.cancelar(conteoId);
      return {
        exito: respuesta.successStatus === true,
        mensaje: respuesta.message || 'Conteo cancelado',
        conteoId,
      };
    } catch (error) {
      return { exito: false, mensaje: mensajeDeError(error), conteoId };
    }
  }
}
