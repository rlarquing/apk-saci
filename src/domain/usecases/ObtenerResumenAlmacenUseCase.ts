/**
 * Use Case: ObtenerResumenAlmacenUseCase
 * Obtiene el resumen del estado actual del almacen
 * Campos alineados con la API (api-saci) ResumenAlmacenDto
 *
 * Estrategia offline-first:
 * 1. El ledger local (SQLite) es la base: refleja de inmediato cada entrada y
 *    salida registrada en el teléfono, sin esperar al servidor ni al cierre del
 *    día. Permanece en el dispositivo y sobrevive reinicios de la app.
 * 2. Con el servidor disponible se reconcilia la lista de activos (cierra en
 *    local lo que la web u otro teléfono ya cerró) y se mergea el resumen del
 *    servidor con el local: se toma el máximo de cada contador y los ingresos
 *    del día se suman sin duplicar (los movimientos sincronizados existen en
 *    ambos lados; los pendientes solo en local).
 */
import { MovimientoRepository } from '@/src/domain';
import { SyncRepository } from '@/src/domain';
import { ResumenAlmacen } from '../entities';

export class ObtenerResumenAlmacenUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private syncRepository: SyncRepository
  ) {}

  async execute(almacenId: string): Promise<ResumenAlmacen> {
    // 1. Base: ledger local del teléfono (siempre disponible, siempre fresco)
    const resumenLocal = await this.movimientoRepository.obtenerResumenLocal(almacenId);

    // 2. Intentar reconciliar + enriquecer con el servidor
    const hayConexion = await this.syncRepository.hayConexion();
    if (!hayConexion) {
      return resumenLocal;
    }

    try {
      // Reconciliación: si una salida se hizo por la web u otro teléfono,
      // el ledger local se cierra aquí para que el conteo "dentro" baje.
      await this.movimientoRepository.reconciliarMovimientosActivos(almacenId);

      // Tras reconciliar, recalcular el local (pudo cambiar)
      const localTrasReconciliar = await this.movimientoRepository.obtenerResumenLocal(almacenId);

      // Resumen autoritativo del servidor
      const resumenServidor = await this.movimientoRepository.obtenerResumenAlmacen(almacenId);

      return this.mergeResumen(resumenServidor, localTrasReconciliar);
    } catch (error) {
      // No romper la UI: el ledger local ya es una respuesta válida
      console.warn('[ObtenerResumenAlmacen] Servidor no disponible, usando ledger local:', error);
      return resumenLocal;
    }
  }

  /**
   * Merge conservador: cada lado ve los movimientos que el otro puede no ver.
   * - vehiculosDentro: el máximo de ambos. El server puede no ver las entradas
   *   pendientes del teléfono; el teléfono puede no ver entradas hechas en la
   *   web. El mínimo ocultaría una de las dos realidades.
   * - salieronHoy/ingresosHoy: el server trae el histórico completo del día
   *   (todas las salidas y cobros, también los hechos en la web); el local
   *   aporta los pendientes aún no subidos. Como el día avanza los movimientos
   *   sincronizados están en ambos lados, se usa el mayor y no una suma.
   */
  private mergeResumen(servidor: ResumenAlmacen, local: ResumenAlmacen): ResumenAlmacen {
    return {
      vehiculosDentro: Math.max(servidor.vehiculosDentro, local.vehiculosDentro),
      vehiculosSalieronHoy: Math.max(servidor.vehiculosSalieronHoy, local.vehiculosSalieronHoy),
      ingresosHoy: Math.max(servidor.ingresosHoy, local.ingresosHoy),
      detallePorTipo: this.mergeDetalle(servidor.detallePorTipo, local.detallePorTipo),
    };
  }

  private mergeDetalle(
    servidor: ResumenAlmacen['detallePorTipo'],
    local: ResumenAlmacen['detallePorTipo']
  ): ResumenAlmacen['detallePorTipo'] {
    const mapa = new Map<string, { categoria: string; cantidad: number; ingreso: number }>();

    for (const d of servidor) {
      mapa.set(d.categoria, { ...d });
    }
    for (const d of local) {
      const existente = mapa.get(d.categoria);
      if (existente) {
        existente.cantidad = Math.max(existente.cantidad, d.cantidad);
        existente.ingreso = Math.max(existente.ingreso, d.ingreso);
      } else {
        mapa.set(d.categoria, { ...d });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.cantidad - a.cantidad);
  }
}
