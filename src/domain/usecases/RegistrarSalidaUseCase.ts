/**
 * Use Case: RegistrarSalidaUseCase
 * Maneja el registro de salidas con soporte offline
 * Campos alineados con la API (api-saci)
 */
import { MovimientoRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { SyncRepository } from '@/src/domain';
import { 
  RegistrarSalidaData, 
  ResultadoOperacion 
} from '../entities';

export class RegistrarSalidaUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private qrRepository: QRRepository,
    private syncRepository: SyncRepository
  ) {}

  async execute(
    qrCodigo: string,
    almacenId: string,
    usuarioId: string
  ): Promise<ResultadoOperacion> {
    // 1. Validar el QR
    const resultadoQR = await this.qrRepository.validarQR(qrCodigo, almacenId);
    
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
        mensaje: resultadoQR.mensaje || 'Este vehículo no tiene una entrada activa en el almacen',
        tipo: 'salida',
      };
    }

    // 2. Obtener el movimiento activo. Sin conexión la validación del QR no
    // puede devolverlo, así que se busca en el cache local: la entrada
    // (online u offline) siempre guarda el movimiento en el ledger del
    // teléfono con su id (real si fue online, local-... si está pendiente).
    let movimientoActivo = resultadoQR.movimientoActivo;
    if (!movimientoActivo) {
      const local = await this.movimientoRepository.obtenerMovimientoActivoPorQR(
        qrCodigo,
        almacenId
      );
      if (local) {
        movimientoActivo = {
          id: local.id,
          fechaEntrada: new Date(local.fechaEntrada),
          almacenId: local.almacenId,
          almacenNombre: local.almacenNombre,
          categoriaNombre: local.categoriaNombre,
          precioMonto: local.precioUnitarioCobrado,
        };
      }
    }

    if (!movimientoActivo) {
      return {
        exito: false,
        movimiento: null,
        mensaje: 'No se encontró movimiento activo para este QR',
        tipo: 'salida',
      };
    }

    // 3. Preparar datos de salida
    const data: RegistrarSalidaData = {
      movimientoId: movimientoActivo.id,
      qrCodigo,
      almacenId,
    };

    // 4. Registrar. Si la entrada vino de una operación offline aún no
    //    sincronizada (id local-...), el repository encola la salida offline
    //    y el SincronizarUseCase la resuelve en orden: primero crea la entrada
    //    en el server, reemplaza el id local por el real y luego cierra.
    return await this.movimientoRepository.registrarSalida(data);
  }
}
