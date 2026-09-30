/**
 * Use Case: ObtenerResumenAlmacenUseCase
 * Obtiene el resumen de movimientos del día en un almacen.
 *
 * Estrategia offline-first:
 * 1. El ledger local (SQLite) es la base: refleja de inmediato cada entrada y
 *    salida registrada en el teléfono, sin esperar al servidor. Permanece en
 *    el dispositivo y sobrevive reinicios de la app.
 * 2. Con el servidor disponible se consulta el registro diario del API
 *    (GET /api/registro-diario/actual/:almacenId) y se mergea con el local:
 *    se toma el máximo de cada contador porque cada lado ve movimientos que
 *    el otro puede no ver (pendientes offline en el teléfono; movimientos de
 *    la web en el servidor).
 * 3. Las alertas de stock bajo mínimo se calculan SIEMPRE desde las caches
 *    locales de productos y stock (el registro diario del API no las trae).
 */
import { MovimientoRepository } from '@/src/domain';
import { SyncRepository } from '@/src/domain';
import { ProductoRepository } from '@/src/domain';
import { StockRepository } from '@/src/domain';
import { ResumenAlmacen, DetalleCategoria } from '../entities';

export class ObtenerResumenAlmacenUseCase {
  constructor(
    private movimientoRepository: MovimientoRepository,
    private syncRepository: SyncRepository,
    private productoRepository: ProductoRepository,
    private stockRepository: StockRepository
  ) {}

  async execute(almacenId: string): Promise<ResumenAlmacen> {
    // 1. Base: ledger local del teléfono (siempre disponible, siempre fresco)
    const resumenLocal = await this.movimientoRepository.obtenerResumenLocal(almacenId);

    // 2. Alertas de stock bajo mínimo (siempre desde caches locales)
    const alertas = await this.contarBajoMinimo(almacenId);
    resumenLocal.alertasBajoMinimo = alertas;

    // 3. Intentar enriquecer con el registro diario del servidor
    const hayConexion = await this.syncRepository.hayConexion();
    if (!hayConexion) {
      return resumenLocal;
    }

    try {
      const resumenServidor = await this.movimientoRepository.obtenerRegistroDiario(almacenId);
      return this.mergeResumen(resumenServidor, resumenLocal);
    } catch (error) {
      // No romper la UI: el ledger local ya es una respuesta válida
      console.warn('[ObtenerResumenAlmacen] Servidor no disponible, usando ledger local:', error);
      return resumenLocal;
    }
  }

  /**
   * Cuenta los productos del almacen cuyo stock cacheado quedó por debajo
   * del stock mínimo del catálogo.
   */
  private async contarBajoMinimo(almacenId: string): Promise<number> {
    try {
      const [stockItems, productos] = await Promise.all([
        this.stockRepository.obtenerStockPorAlmacen(almacenId),
        this.productoRepository.obtenerProductosLocal(),
      ]);

      const minimos = new Map(productos.map(p => [p.id, p.stockMinimo]));

      let alertas = 0;
      for (const item of stockItems) {
        const minimo = minimos.get(item.productoId);
        if (minimo !== undefined && item.stock < minimo) {
          alertas++;
        }
      }
      return alertas;
    } catch {
      return 0;
    }
  }

  /**
   * Merge conservador: cada lado ve los movimientos que el otro puede no ver.
   * - totalEntradas/totalSalidas: el máximo de ambos. El server puede no ver
   *   los pendientes del teléfono; el teléfono puede no ver movimientos
   *   hechos en la web. El mínimo ocultaría una de las dos realidades.
   * - alertasBajoMinimo: se conserva el valor local (el registro diario del
   *   API no incluye alertas).
   */
  private mergeResumen(servidor: ResumenAlmacen, local: ResumenAlmacen): ResumenAlmacen {
    return {
      totalEntradas: Math.max(servidor.totalEntradas || 0, local.totalEntradas || 0),
      totalSalidas: Math.max(servidor.totalSalidas || 0, local.totalSalidas || 0),
      detalleCategorias: this.mergeDetalle(
        servidor.detalleCategorias || [],
        local.detalleCategorias || []
      ),
      alertasBajoMinimo: local.alertasBajoMinimo ?? 0,
    };
  }

  private mergeDetalle(
    servidor: DetalleCategoria[],
    local: DetalleCategoria[]
  ): DetalleCategoria[] {
    const mapa = new Map<string, DetalleCategoria>();

    for (const d of servidor) {
      mapa.set(d.categoria, { ...d });
    }
    for (const d of local) {
      const existente = mapa.get(d.categoria);
      if (existente) {
        existente.entradas = Math.max(existente.entradas, d.entradas);
        existente.salidas = Math.max(existente.salidas, d.salidas);
      } else {
        mapa.set(d.categoria, { ...d });
      }
    }

    return Array.from(mapa.values()).sort(
      (a, b) => b.entradas + b.salidas - (a.entradas + a.salidas)
    );
  }
}
