/**
 * Use Case: RegistrarEntradaUseCase
 * Registra una ENTRADA de producto con soporte offline.
 *
 * Dos modos de identificación:
 * 1. Etiqueta QR (QR-XXXXXX): se valida contra el API (o el cache offline).
 *    La etiqueta reutilizable acepta entradas siempre que no esté anulada;
 *    registrar una entrada la marca como 'asignado' en el servidor.
 * 2. SKU manual (PRD-XXXXXX): resuelto contra el catálogo local (el catálogo
 *    llega con cada sincronización), sin etiqueta.
 */
import { MovimientoRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { ProductoRepository } from '@/src/domain';
import { ResultadoOperacion, LoteInfo } from '../entities';

/** Prefijo del SKU autogenerado por el API para productos */
const PREFIJO_SKU = 'PRD-';

export function esCodigoSKU(codigo: string): boolean {
  return /^PRD-[0-9A-Za-z]+$/i.test(codigo.trim());
}

export class RegistrarEntradaUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private qrRepository: QRRepository,
    private productoRepository: ProductoRepository
  ) {}

  async execute(
    codigo: string,
    almacenId: string,
    cantidad: number,
    observaciones?: string,
    loteInfo?: LoteInfo
  ): Promise<ResultadoOperacion> {
    if (!almacenId) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'No hay almacen seleccionado',
        tipo: 'entrada',
      };
    }

    if (!(cantidad > 0)) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'La cantidad debe ser mayor que cero',
        tipo: 'entrada',
      };
    }

    const codigoLimpio = codigo.trim();

    let qrCodigo: string | undefined;
    let productoId: string | undefined;

    if (esCodigoSKU(codigoLimpio)) {
      // Modo manual por SKU: resolver contra el catálogo local
      const producto = await this.productoRepository.buscarPorCodigo(codigoLimpio.toUpperCase());
      if (!producto) {
        return {
          exito: false,
          movimiento: null,
          mensaje:
            'Producto no encontrado en la caché local. Sincronice la aplicación e intente de nuevo.',
          tipo: 'entrada',
        };
      }
      productoId = producto.id;
    } else {
      // Modo etiqueta QR: validar contra el API (fallback offline al cache)
      const resultadoQR = await this.qrRepository.validarQR(codigoLimpio, almacenId);

      if (!resultadoQR.valido) {
        return {
          exito: false,
          movimiento: null,
          mensaje: resultadoQR.mensaje,
          tipo: 'entrada',
        };
      }

      if (!resultadoQR.puedeEntrar) {
        return {
          exito: false,
          movimiento: null,
          mensaje: 'La etiqueta está anulada: no admite más movimientos',
          tipo: 'entrada',
        };
      }

      qrCodigo = resultadoQR.qr?.codigo;
    }

    // Registrar. El repository degrada solo a offline si la red falla
    // a mitad de la llamada (timeout/5xx tras un health check exitoso):
    // la operación siempre queda persistida en el teléfono.
    // El lote/caducidad (P3) solo viaja si el operario lo capturó.
    const resultado = await this.movimientoRepository.registrarEntrada({
      qrCodigo,
      productoId,
      almacenId,
      cantidad,
      observaciones,
      ...(loteInfo?.lote ? { lote: loteInfo.lote } : {}),
      ...(loteInfo?.fechaCaducidad ? { fechaCaducidad: loteInfo.fechaCaducidad } : {}),
    });

    // Actualización optimista del cache: la entrada asigna la etiqueta al
    // producto, así que las próximas validaciones offline ya lo saben.
    if (resultado.exito && qrCodigo) {
      await this.qrRepository
        .actualizarEstadoLocal(qrCodigo, 'asignado')
        .catch(() => {});
    }

    return resultado;
  }
}
