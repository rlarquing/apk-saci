/**
 * Repository Implementation: SyncRepository
 * Sincroniza con el servidor y actualiza las caches locales
 * Alineado con el contrato real del API api-saci:
 * - POST /api/sync: lote de pendientes (entrada/salida) + catálogos en la
 *   respuesta (productos, stock y categorías). @ArrayNotEmpty: nunca llamar
 *   con lista vacía.
 * - GETs individuales cuando no hay pendientes.
 */
import { SyncRepository } from '@/src/domain';
import { SyncResult, MovimientoPendiente, Producto, StockItem, Categoria } from '@/src/domain';
import { ConfigLocalDataSource } from '@/src/data/datasources/local/ConfigLocalDataSource';
import { SyncRemoteDataSource } from '@/src/data/datasources/remote/SyncRemoteDataSource';
import { MovimientoRemoteDataSource } from '@/src/data/datasources/remote/MovimientoRemoteDataSource';
import { ProductoRemoteDataSource } from '@/src/data/datasources/remote/ProductoRemoteDataSource';
import { CategoriaRemoteDataSource } from '@/src/data/datasources/remote/CategoriaRemoteDataSource';
import { ProductoLocalDataSource } from '@/src/data/datasources/local/ProductoLocalDataSource';
import { StockLocalDataSource } from '@/src/data/datasources/local/StockLocalDataSource';
import { CategoriaLocalDataSource } from '@/src/data/datasources/local/CategoriaLocalDataSource';
import { NivelStockRemoteDataSource } from '@/src/data/datasources/remote/NivelStockRemoteDataSource';
import { networkService } from '@/src/infrastructure';
import {
  SyncRequestDto,
  SyncResponseDto,
  ProductoSyncDto,
  CategoriaSyncDto,
} from '../dtos';
import { ProductoMapper, CategoriaMapper } from '../mappers';

export class SyncRepositoryImpl implements SyncRepository {
  constructor(
    private configLocalDataSource: ConfigLocalDataSource,
    private syncRemoteDataSource: SyncRemoteDataSource,
    private movimientoRemoteDataSource: MovimientoRemoteDataSource,
    private productoRemoteDataSource: ProductoRemoteDataSource,
    private categoriaRemoteDataSource: CategoriaRemoteDataSource,
    private productoLocalDataSource: ProductoLocalDataSource,
    private stockLocalDataSource: StockLocalDataSource,
    private categoriaLocalDataSource: CategoriaLocalDataSource,
    private nivelStockRemoteDataSource?: NivelStockRemoteDataSource,
  ) {}

  /**
   * Envía el lote de pendientes al servidor (POST /api/sync) y procesa la
   * respuesta: guarda los catálogos completos (productos, stock y categorías)
   * y mapea los errores por ítem al shape local {idLocal, operacion, error}.
   */
  async sincronizar(
    pendientes: MovimientoPendiente[],
    ultimaSincronizacion: Date | null
  ): Promise<SyncResult> {
    try {
      // Construir request alineado con api-saci SyncRequestDto.
      // El shape de data es el que consume sync.service: qrCodigo|productoId,
      // almacenId, cantidad y la fecha real del movimiento offline.
      const request: SyncRequestDto = {
        movimientosPendientes: pendientes.map(m => ({
          id: m.idLocal,
          operacion: m.operacion,
          data: {
            ...(m.data.qrCodigo ? { qrCodigo: m.data.qrCodigo } : {}),
            ...(m.data.productoId ? { productoId: m.data.productoId } : {}),
            almacenId: m.data.almacenId,
            cantidad: m.data.cantidad,
            ...(m.data.fecha ? { fecha: m.data.fecha } : {}),
            ...(m.data.observaciones ? { observaciones: m.data.observaciones } : {}),
            ...(m.data.lote ? { lote: m.data.lote } : {}),
            ...(m.data.fechaCaducidad ? { fechaCaducidad: m.data.fechaCaducidad } : {}),
          },
          createdAt: m.createdAt.toISOString(),
        })),
        ultimaSincronizacion: ultimaSincronizacion?.toISOString() || null,
      };

      const response = await this.syncRemoteDataSource.sincronizar(request);

      // Guardar los catálogos que llegan en la respuesta (purge + replace)
      await this.procesarDatosActualizados(response);

      return {
        exito: response.exito,
        movimientosSincronizados: response.movimientosSincronizados,
        movimientosConError: response.movimientosConError,
        datosActualizados: {
          productos: response.datosActualizados?.productos || response.productos?.length || 0,
          categorias: response.datosActualizados?.categorias || response.categorias?.length || 0,
          stock: response.stock?.length || 0,
        },
        errores: (response.errores || []).map(e => ({
          idLocal: e.id,
          operacion: e.operacion,
          error: e.error,
        })),
      };
    } catch (error) {
      return {
        exito: false,
        movimientosSincronizados: 0,
        movimientosConError: 0,
        datosActualizados: { productos: 0, categorias: 0, stock: 0 },
        errores: [{
          idLocal: '',
          operacion: 'conexion',
          error: error instanceof Error ? error.message : 'Error de conexión',
        }],
      };
    }
  }

  /**
   * PURGA cache y guarda los catálogos de la respuesta del sync
   */
  private async procesarDatosActualizados(response: SyncResponseDto): Promise<void> {
    // 1. Productos
    if (response.productos && response.productos.length > 0) {
      try {
        await this.productoLocalDataSource.limpiarProductos();
        const productos: Producto[] = response.productos
          .filter((p: ProductoSyncDto) => p.activo)
          .map((p: ProductoSyncDto) =>
            ProductoMapper.toEntity({
              id: p.id,
              codigo: p.codigo,
              nombre: p.nombre,
              descripcion: null,
              categoriaId: p.categoriaId,
              categoriaNombre: p.categoriaNombre,
              unidadNombre: p.unidadNombre,
              stockMinimo: p.stockMinimo,
              stockSeguridad: p.stockSeguridad ?? 0,
              activo: p.activo,
              createdAt: p.updatedAt,
              updatedAt: p.updatedAt,
            })
          );
        await this.productoLocalDataSource.guardarProductos(productos);
      } catch {
        // ignore
      }
    }

    // 2. Stock derivado (todos los almacenes del usuario)
    if (response.stock && response.stock.length > 0) {
      try {
        await this.stockLocalDataSource.limpiarStock();
        const stock: StockItem[] = response.stock.map(s => ({
          productoId: s.productoId,
          almacenId: s.almacenId,
          stock: s.stock,
        }));
        await this.stockLocalDataSource.guardarStock(stock);
      } catch {
        // ignore
      }
    }

    // 3. Niveles de stock por producto/almacén (safety stock — P2)
    if (response.niveles && response.niveles.length > 0) {
      try {
        await this.stockLocalDataSource.reemplazarNiveles(
          response.niveles.map(n => ({
            productoId: n.productoId,
            almacenId: n.almacenId,
            stockMinimo: n.stockMinimo,
            stockSeguridad: n.stockSeguridad,
          }))
        );
      } catch {
        // ignore
      }
    }

    // 4. Bins producto-ubicación (backlog P3): llegan de todos los almacenes
    //    del usuario; obtenerBin filtra por producto+almacén al leer.
    if (response.bins && response.bins.length > 0) {
      try {
        await this.stockLocalDataSource.reemplazarBins(
          response.bins.map(b => ({
            productoId: b.productoId,
            almacenId: b.almacenId,
            ubicacionNombre: b.ubicacionNombre,
          }))
        );
      } catch {
        // ignore
      }
    }

    // 5. Categorías
    if (response.categorias && response.categorias.length > 0) {
      try {
        await this.categoriaLocalDataSource.limpiarTiposMedio();
        const categorias: Categoria[] = response.categorias
          .filter((c: CategoriaSyncDto) => c.activo)
          .map((c: CategoriaSyncDto) =>
            CategoriaMapper.toEntity({
              id: c.id,
              nombre: c.nombre,
              descripcion: c.descripcion,
              activo: c.activo,
              created_at: c.createdAt,
              updated_at: c.updatedAt,
            })
          );
        await this.categoriaLocalDataSource.guardarTiposMedio(categorias);
      } catch {
        // ignore
      }
    }
  }

  async hayConexion(): Promise<boolean> {
    return await networkService.checkConnection();
  }

  async obtenerUltimaSincronizacion(): Promise<Date | null> {
    return await this.configLocalDataSource.obtenerUltimaSincronizacion();
  }

  async guardarUltimaSincronizacion(fecha: Date): Promise<void> {
    await this.configLocalDataSource.guardarUltimaSincronizacion(fecha);
  }

  /**
   * Refresca los catálogos por GETs individuales (ruta sin pendientes).
   * Cada descarga es tolerante a fallos: una que falle no impide las demás.
   */
  async descargarDatosActualizados(): Promise<{
    productos: number;
    categorias: number;
    stock: number;
  }> {
    let productos = 0;
    let categorias = 0;
    let stock = 0;

    // 1. Catálogo de productos (GET /api/producto?sinPaginacion=true)
    try {
      const dtos = await this.productoRemoteDataSource.obtenerProductos();
      const activos = dtos.filter(p => p.activo);
      if (activos.length > 0) {
        await this.productoLocalDataSource.limpiarProductos();
        await this.productoLocalDataSource.guardarProductos(activos.map(ProductoMapper.toEntity));
      }
      productos = activos.length;
    } catch {
      // ignore
    }

    // 2. Stock derivado (GET /api/movimiento-inventario/stock sin filtros)
    try {
      const filas = await this.movimientoRemoteDataSource.obtenerStock();
      if (filas.length > 0) {
        await this.stockLocalDataSource.limpiarStock();
        await this.stockLocalDataSource.guardarStock(
          filas.map(s => ({ productoId: s.productoId, almacenId: s.almacenId, stock: s.stock }))
        );
      }
      stock = filas.length;
    } catch {
      // ignore
    }

    // 3. Categorías (create/select del nomenclador, liviano)
    try {
      const select = await this.categoriaRemoteDataSource.obtenerCategoriasSelect();
      if (select.length > 0) {
        await this.categoriaLocalDataSource.limpiarTiposMedio();
        const now = new Date();
        const categorias: Categoria[] = select.map(item => ({
          id: item.value,
          nombre: item.label,
          descripcion: null,
          activo: true,
          createdAt: now,
          updatedAt: now,
        }));
        await this.categoriaLocalDataSource.guardarTiposMedio(categorias);
      }
      categorias = select.length;
    } catch {
      // ignore
    }

    // 4. Niveles de stock (GET /api/nivel-stock — safety stock P2)
    if (this.nivelStockRemoteDataSource) {
      try {
        const nivelesDto = await this.nivelStockRemoteDataSource.obtenerNiveles();
        if (nivelesDto.length > 0) {
          await this.stockLocalDataSource.reemplazarNiveles(
            nivelesDto.map(n => ({
              productoId: n.productoId,
              almacenId: n.almacenId,
              stockMinimo: n.stockMinimo,
              stockSeguridad: n.stockSeguridad,
            }))
          );
        }
      } catch {
        // ignore
      }
    }

    // 5. Bins producto-ubicación (GET /api/producto-ubicacion — backlog P3)
    try {
      const binsDto = await this.productoRemoteDataSource.obtenerBins();
      const binsActivos = binsDto.filter(b => b.activo);
      if (binsActivos.length > 0) {
        await this.stockLocalDataSource.reemplazarBins(
          binsActivos.map(b => ({
            productoId: b.productoId,
            almacenId: b.almacenId,
            ubicacionNombre: b.ubicacionNombre,
          }))
        );
      }
    } catch {
      // ignore
    }

    return { productos, categorias, stock };
  }
}
