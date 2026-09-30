/**
 * Use Case: RegistrarSalidaUseCase
 * Registra una SALIDA de producto con soporte offline.
 *
 * Reglas:
 * 1. La etiqueta debe estar 'asignado' (puedeSalir); si está disponible, no
 *    hay stock asociado que retirar.
 * 2. Validación previa de stock con el cache local: si el stock conocido del
 *    producto en el almacen es menor que la cantidad solicitada, se rechaza
 *    antes de llamar al API (que además lo valida como 409 "Stock insuficiente").
 * 3. El stock en inventario NUNCA puede quedar negativo (regla del API).
 */
import { MovimientoRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { ProductoRepository } from '@/src/domain';
import { StockRepository } from '@/src/domain';
import { ResultadoOperacion } from '../entities';
import { esCodigoSKU } from './RegistrarEntradaUseCase';

export class RegistrarSalidaUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private qrRepository: QRRepository,
    private productoRepository: ProductoRepository,
    private stockRepository: StockRepository
  ) {}

  async execute(
    codigo: string,
    almacenId: string,
    cantidad: number,
    observaciones?: string
  ): Promise<ResultadoOperacion> {
    if (!almacenId) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'No hay almacen seleccionado',
        tipo: 'salida',
      };
    }

    if (!(cantidad > 0)) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'La cantidad debe ser mayor que cero',
        tipo: 'salida',
      };
    }

    const codigoLimpio = codigo.trim();

    let qrCodigo: string | undefined;
    let productoId: string | undefined;

    if (esCodigoSKU(codigoLimpio)) {
      // Modo manual por SKU
      const producto = await this.productoRepository.buscarPorCodigo(codigoLimpio.toUpperCase());
      if (!producto) {
        return {
          exito: false,
          movimiento: null,
          mensaje:
            'Producto no encontrado en la caché local. Sincronice la aplicación e intente de nuevo.',
          tipo: 'salida',
        };
      }
      productoId = producto.id;
    } else {
      // Modo etiqueta QR
      const resultadoQR = await this.qrRepository.validarQR(codigoLimpio, almacenId);

      if (!resultadoQR.valido) {
        return {
          exito: false,
          movimiento: null,
          mensaje: resultadoQR.mensaje,
          tipo: 'salida',
        };
      }

      if (!resultadoQR.puedeSalir) {
        return {
          exito: false,
          movimiento: null,
          mensaje:
            'La etiqueta no tiene producto asignado (estado: disponible). Registre primero una entrada.',
          tipo: 'salida',
        };
      }

      qrCodigo = resultadoQR.qr?.codigo;
      productoId = resultadoQR.qr?.productoId || undefined;
    }

    // Validación previa de stock con el cache local. Solo se bloquea cuando
    // hay un dato conocido: sin dato (null) el API resolverá con el kardex real.
    if (productoId) {
      const stock = await this.stockRepository.obtenerStock(productoId, almacenId);
      if (stock !== null && cantidad > stock) {
        return {
          exito: false,
          movimiento: null,
          mensaje: `Stock insuficiente: disponible ${stock}, solicitado ${cantidad}`,
          tipo: 'salida',
        };
      }
    }

    const resultado = await this.movimientoRepository.registrarSalida({
      qrCodigo,
      productoId,
      almacenId,
      cantidad,
      observaciones,
    });

    return resultado;
  }
}
