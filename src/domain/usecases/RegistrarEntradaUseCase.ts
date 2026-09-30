/**
 * Use Case: RegistrarEntradaUseCase
 * Maneja el registro de entradas con soporte offline
 * Campos alineados con la API (api-saci)
 */
import { MovimientoRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { PrecioRepository } from '@/src/domain';
import { SyncRepository } from '@/src/domain';
import { 
  RegistrarEntradaData, 
  ResultadoOperacion, 
} from '../entities';

export class RegistrarEntradaUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private qrRepository: QRRepository,
    private precioRepository: PrecioRepository,
    private syncRepository: SyncRepository
  ) {}

  async execute(
    qrCodigo: string,
    almacenId: string,
    usuarioId: string,
    categoriaId?: string
  ): Promise<ResultadoOperacion> {
    // 1. Validar el QR
    const resultadoQR = await this.qrRepository.validarQR(qrCodigo, almacenId);
    
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
        mensaje: 'Este vehículo ya tiene una entrada activa en el almacen',
        tipo: 'entrada',
      };
    }

    // Usar categoriaId del QR validado si no se recibió del caller
    const categoriaIdFinal = categoriaId || resultadoQR.qr?.categoriaId;
    if (!categoriaIdFinal) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'No se pudo determinar el tipo de vehículo',
        tipo: 'entrada',
      };
    }

    // 2. Obtener precio vigente (cache local; nunca bloquea por red)
    const precio = await this.precioRepository.obtenerPrecioVigente(categoriaIdFinal, almacenId);
    if (!precio) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'No hay precio vigente para este tipo de vehículo',
        tipo: 'entrada',
      };
    }

    // 3. Preparar datos de entrada
    const data: RegistrarEntradaData = {
      qrCodigo,
      almacenId,
      categoriaId: categoriaIdFinal,
      precioId: precio.id,
      precioMonto: precio.monto,
    };

    // 4. Registrar. El repository degrada solo a offline si la red falla
    //    a mitad de la llamada (timeout/5xx tras un health check exitoso):
    //    la operación siempre queda persistida en el teléfono.
    return await this.movimientoRepository.registrarEntrada(data);
  }
}
