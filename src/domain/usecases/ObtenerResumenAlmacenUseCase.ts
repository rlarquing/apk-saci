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
import { ResumenAlmacen, DetalleCategoria, ItemReponer } from '../entities';

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

    // 2. Alertas de stock (siempre desde caches locales): umbral efectivo
    //    nivel_stock producto/almacén si existe; si no, global del producto
    const { bajoMinimo, enReorden, items } = await this.contarBajoUmbral(almacenId);
    resumenLocal.alertasBajoMinimo = bajoMinimo;
    resumenLocal.alertasReorden = enReorden;
    resumenLocal.itemsReponer = items;

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
   * Productos del almacén por debajo del punto de reorden (backlog P2).
   * Umbral efectivo: nivel_stock (producto+almacén) si existe; si no, los
   * globales del producto. Devuelve conteos por estado y la lista ordenada
   * por criticidad (BAJO_MINIMO primero, luego menor stock relativo).
   */
  private async contarBajoUmbral(almacenId: string): Promise<{
    bajoMinimo: number;
    enReorden: number;
    items: ItemReponer[];
  }> {
    try {
      const [stockItems, productos, niveles] = await Promise.all([
        this.stockRepository.obtenerStockPorAlmacen(almacenId),
        this.productoRepository.obtenerProductosLocal(),
        this.stockRepository.obtenerNivelesPorAlmacen(almacenId),
      ]);

      const productosMap = new Map(productos.map(p => [p.id, p]));
      const nivelesMap = new Map(
        niveles.map(n => [`${n.productoId}|${n.almacenId}`, n])
      );

      const items: ItemReponer[] = [];
      for (const item of stockItems) {
        const producto = productosMap.get(item.productoId);
        if (!producto) continue;

        // Umbral efectivo: nivel específico > globales del producto
        const nivel = nivelesMap.get(`${item.productoId}|${almacenId}`);
        const stockMinimo = nivel ? nivel.stockMinimo : (producto.stockMinimo ?? 0);
        const stockSeguridad = nivel ? nivel.stockSeguridad : (producto.stockSeguridad ?? 0);
        const puntoReorden = stockMinimo + stockSeguridad;

        if (item.stock < puntoReorden) {
          items.push({
            productoId: item.productoId,
            productoCodigo: producto.codigo,
            productoNombre: producto.nombre,
            stock: item.stock,
            stockMinimo,
            puntoReorden,
            sugerido: Math.max(puntoReorden - item.stock, 0),
            estado: item.stock < stockMinimo ? 'BAJO_MINIMO' : 'REORDEN',
          });
        }
      }

      // Criticidad: bajo mínimo primero, luego déficit relativo más grave
      items.sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === 'BAJO_MINIMO' ? -1 : 1;
        const defA = b.puntoReorden > 0 ? b.stock / b.puntoReorden : 1;
        const defB = a.puntoReorden > 0 ? a.stock / a.puntoReorden : 1;
        return defA - defB;
      });

      return {
        bajoMinimo: items.filter(i => i.estado === 'BAJO_MINIMO').length,
        enReorden: items.filter(i => i.estado === 'REORDEN').length,
        items: items.slice(0, 10),
      };
    } catch {
      return { bajoMinimo: 0, enReorden: 0, items: [] };
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
      alertasReorden: local.alertasReorden ?? 0,
      itemsReponer: local.itemsReponer ?? [],
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
