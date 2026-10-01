/**
 * Service Container - Dependency Injection
 * Centraliza la creación y gestión de todas las dependencias
 */

// Database
import { initDatabase, executeQueryFirst, executeUpdate } from '../database/database';

// Local DataSources
import { AuthLocalDataSource } from '../../data/datasources/local/AuthLocalDataSource';
import { MovimientoLocalDataSource } from '../../data/datasources/local/MovimientoLocalDataSource';
import { QRLocalDataSource } from '../../data/datasources/local/QRLocalDataSource';
import { ProductoLocalDataSource } from '../../data/datasources/local/ProductoLocalDataSource';
import { StockLocalDataSource } from '../../data/datasources/local/StockLocalDataSource';
import { ConfigLocalDataSource } from '../../data/datasources/local/ConfigLocalDataSource';
import { CategoriaLocalDataSource } from '../../data/datasources/local/CategoriaLocalDataSource';
import { AlmacenLocalDataSource } from '../../data/datasources/local/AlmacenLocalDataSource';

// Remote DataSources
import { AuthRemoteDataSource } from '../../data/datasources/remote/AuthRemoteDataSource';
import { MovimientoRemoteDataSource } from '../../data/datasources/remote/MovimientoRemoteDataSource';
import { QRRemoteDataSource } from '../../data/datasources/remote/QRRemoteDataSource';
import { ProductoRemoteDataSource } from '../../data/datasources/remote/ProductoRemoteDataSource';
import { CategoriaRemoteDataSource } from '../../data/datasources/remote/CategoriaRemoteDataSource';
import { SyncRemoteDataSource } from '../../data/datasources/remote/SyncRemoteDataSource';
import { AlmacenRemoteDataSource } from '../../data/datasources/remote/AlmacenRemoteDataSource';
import { ConteoInventarioRemoteDataSource } from '../../data/datasources/remote/ConteoInventarioRemoteDataSource';

// Repository Implementations
import { AuthRepositoryImpl } from '../../data/repositories/AuthRepositoryImpl';
import { MovimientoRepositoryImpl } from '../../data/repositories/MovimientoRepositoryImpl';
import { QRRepositoryImpl } from '../../data/repositories/QRRepositoryImpl';
import { ProductoRepositoryImpl } from '../../data/repositories/ProductoRepositoryImpl';
import { StockRepositoryImpl } from '../../data/repositories/StockRepositoryImpl';
import { SyncRepositoryImpl } from '../../data/repositories/SyncRepositoryImpl';
import { CategoriaRepositoryImpl } from '../../data/repositories/CategoriaRepositoryImpl';
import { AlmacenRepositoryImpl } from '../../data/repositories/AlmacenRepositoryImpl';
import { ConteoRepositoryImpl } from '../../data/repositories/ConteoRepositoryImpl';

// Use Cases
import { LoginUseCase } from '../../domain/usecases/LoginUseCase';
import { LogoutUseCase } from '../../domain/usecases/LogoutUseCase';
import { RegistrarEntradaUseCase } from '../../domain/usecases/RegistrarEntradaUseCase';
import { RegistrarSalidaUseCase } from '../../domain/usecases/RegistrarSalidaUseCase';
import { SincronizarUseCase } from '../../domain/usecases/SincronizarUseCase';
import { ObtenerResumenAlmacenUseCase } from '../../domain/usecases/ObtenerResumenAlmacenUseCase';
import {
  CancelarConteoUseCase,
  CerrarConteoUseCase,
  ContarProductoUseCase,
  CrearConteoUseCase,
  ListarConteosUseCase,
  ObtenerConteoUseCase,
} from '../../domain/usecases/ConteoUseCases';

// Network
import { networkService } from '../network/NetworkService';

/**
 * ServiceContainer - Singleton
 * Gestiona todas las dependencias de la aplicación
 */
export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  private initialized: boolean = false;

  // Local DataSources
  private authLocalDataSource!: AuthLocalDataSource;
  private movimientoLocalDataSource!: MovimientoLocalDataSource;
  private qrLocalDataSource!: QRLocalDataSource;
  private productoLocalDataSource!: ProductoLocalDataSource;
  private stockLocalDataSource!: StockLocalDataSource;
  private configLocalDataSource!: ConfigLocalDataSource;
  private categoriaLocalDataSource!: CategoriaLocalDataSource;
  private almacenLocalDataSource!: AlmacenLocalDataSource;

  // Remote DataSources
  private authRemoteDataSource!: AuthRemoteDataSource;
  private movimientoRemoteDataSource!: MovimientoRemoteDataSource;
  private qrRemoteDataSource!: QRRemoteDataSource;
  private productoRemoteDataSource!: ProductoRemoteDataSource;
  private categoriaRemoteDataSource!: CategoriaRemoteDataSource;
  private syncRemoteDataSource!: SyncRemoteDataSource;
  private almacenRemoteDataSource!: AlmacenRemoteDataSource;

  // Repositories
  private authRepository!: AuthRepositoryImpl;
  private movimientoRepository!: MovimientoRepositoryImpl;
  private qrRepository!: QRRepositoryImpl;
  private productoRepository!: ProductoRepositoryImpl;
  private stockRepository!: StockRepositoryImpl;
  private syncRepository!: SyncRepositoryImpl;
  private categoriaRepository!: CategoriaRepositoryImpl;
  private almacenRepository!: AlmacenRepositoryImpl;
  private conteoInventarioRemoteDataSource!: ConteoInventarioRemoteDataSource;
  private conteoRepository!: ConteoRepositoryImpl;
  private listarConteosUseCase!: ListarConteosUseCase;
  private obtenerConteoUseCase!: ObtenerConteoUseCase;
  private crearConteoUseCase!: CrearConteoUseCase;
  private contarProductoUseCase!: ContarProductoUseCase;
  private cerrarConteoUseCase!: CerrarConteoUseCase;
  private cancelarConteoUseCase!: CancelarConteoUseCase;

  // Use Cases
  private loginUseCase!: LoginUseCase;
  private logoutUseCase!: LogoutUseCase;
  private registrarEntradaUseCase!: RegistrarEntradaUseCase;
  private registrarSalidaUseCase!: RegistrarSalidaUseCase;
  private sincronizarUseCase!: SincronizarUseCase;
  private obtenerResumenAlmacenUseCase!: ObtenerResumenAlmacenUseCase;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  /**
   * Inicializa todos los servicios
   */
  async initialize(apiUrl?: string): Promise<void> {
    if (this.initialized) return;

    // Configurar URL del API
    if (apiUrl) {
      networkService.setBaseUrl(apiUrl);
    }

    // Inicializar base de datos
    await initDatabase();

    // Inicializar Local DataSources
    this.authLocalDataSource = new AuthLocalDataSource();
    this.movimientoLocalDataSource = new MovimientoLocalDataSource();
    this.qrLocalDataSource = new QRLocalDataSource();
    this.productoLocalDataSource = new ProductoLocalDataSource();
    this.stockLocalDataSource = new StockLocalDataSource();
    this.configLocalDataSource = new ConfigLocalDataSource();
    this.categoriaLocalDataSource = new CategoriaLocalDataSource();
    this.almacenLocalDataSource = new AlmacenLocalDataSource();

    // Inicializar Remote DataSources
    this.authRemoteDataSource = new AuthRemoteDataSource();
    this.movimientoRemoteDataSource = new MovimientoRemoteDataSource();
    this.qrRemoteDataSource = new QRRemoteDataSource();
    this.productoRemoteDataSource = new ProductoRemoteDataSource();
    this.categoriaRemoteDataSource = new CategoriaRemoteDataSource();
    this.syncRemoteDataSource = new SyncRemoteDataSource();
    this.almacenRemoteDataSource = new AlmacenRemoteDataSource();
    this.conteoInventarioRemoteDataSource = new ConteoInventarioRemoteDataSource();

    // Inicializar Repositories
    this.authRepository = new AuthRepositoryImpl(
      this.authLocalDataSource,
      this.authRemoteDataSource
    );
    this.movimientoRepository = new MovimientoRepositoryImpl(
      this.movimientoLocalDataSource,
      this.movimientoRemoteDataSource,
      this.qrLocalDataSource,
      this.productoLocalDataSource
    );
    this.qrRepository = new QRRepositoryImpl(
      this.qrLocalDataSource,
      this.qrRemoteDataSource
    );
    this.productoRepository = new ProductoRepositoryImpl(
      this.productoLocalDataSource
    );
    this.stockRepository = new StockRepositoryImpl(
      this.stockLocalDataSource
    );
    this.syncRepository = new SyncRepositoryImpl(
      this.configLocalDataSource,
      this.syncRemoteDataSource,
      this.movimientoRemoteDataSource,
      this.productoRemoteDataSource,
      this.categoriaRemoteDataSource,
      this.productoLocalDataSource,
      this.stockLocalDataSource,
      this.categoriaLocalDataSource
    );
    this.categoriaRepository = new CategoriaRepositoryImpl(
      this.categoriaLocalDataSource,
    );
    this.almacenRepository = new AlmacenRepositoryImpl(
      this.almacenLocalDataSource,
      this.almacenRemoteDataSource,
    );
    this.conteoRepository = new ConteoRepositoryImpl(
      this.conteoInventarioRemoteDataSource
    );

    // Inicializar Use Cases
    this.loginUseCase = new LoginUseCase(this.authRepository);
    this.logoutUseCase = new LogoutUseCase(this.authRepository);
    this.registrarEntradaUseCase = new RegistrarEntradaUseCase(
      this.movimientoRepository,
      this.qrRepository,
      this.productoRepository
    );
    this.registrarSalidaUseCase = new RegistrarSalidaUseCase(
      this.movimientoRepository,
      this.qrRepository,
      this.productoRepository,
      this.stockRepository
    );
    this.sincronizarUseCase = new SincronizarUseCase(
      this.syncRepository,
      this.movimientoRepository,
      this.authRepository,
      this.qrRepository,
      this.almacenRepository
    );
    this.obtenerResumenAlmacenUseCase = new ObtenerResumenAlmacenUseCase(
      this.movimientoRepository,
      this.syncRepository,
      this.productoRepository,
      this.stockRepository
    );
    this.listarConteosUseCase = new ListarConteosUseCase(this.conteoRepository);
    this.obtenerConteoUseCase = new ObtenerConteoUseCase(this.conteoRepository);
    this.crearConteoUseCase = new CrearConteoUseCase(this.conteoRepository);
    this.contarProductoUseCase = new ContarProductoUseCase(this.conteoRepository);
    this.cerrarConteoUseCase = new CerrarConteoUseCase(this.conteoRepository);
    this.cancelarConteoUseCase = new CancelarConteoUseCase(this.conteoRepository);

    // Cargar configuración guardada
    const savedApiUrl = await this.configLocalDataSource.obtenerApiUrl();
    if (savedApiUrl) {
      networkService.setBaseUrl(savedApiUrl);
    }

    this.initialized = true;
  }

  /**
   * Verifica si el container está inicializado
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==================== GETTERS ====================

  // Repositories
  get auth() { return this.authRepository; }
  get movimiento() { return this.movimientoRepository; }
  get qr() { return this.qrRepository; }
  get producto() { return this.productoRepository; }
  get stock() { return this.stockRepository; }
  get sync() { return this.syncRepository; }
  get categoria() { return this.categoriaRepository; }
  get almacen() { return this.almacenRepository; }
  get conteo() { return this.conteoRepository; }

  // Use Cases
  get login() { return this.loginUseCase; }
  get logout() { return this.logoutUseCase; }
  get registrarEntrada() { return this.registrarEntradaUseCase; }
  get registrarSalida() { return this.registrarSalidaUseCase; }
  get sincronizar() { return this.sincronizarUseCase; }
  get obtenerResumen() { return this.obtenerResumenAlmacenUseCase; }
  get listarConteos() { return this.listarConteosUseCase; }
  get obtenerConteo() { return this.obtenerConteoUseCase; }
  get crearConteo() { return this.crearConteoUseCase; }
  get contarProducto() { return this.contarProductoUseCase; }
  get cerrarConteo() { return this.cerrarConteoUseCase; }
  get cancelarConteo() { return this.cancelarConteoUseCase; }

  // DataSources directos (para casos especiales)
  get localAuth() { return this.authLocalDataSource; }
  get localMovimiento() { return this.movimientoLocalDataSource; }
  get localQR() { return this.qrLocalDataSource; }
  get localProducto() { return this.productoLocalDataSource; }
  get localStock() { return this.stockLocalDataSource; }
  get localConfig() { return this.configLocalDataSource; }
  get localCategoria() { return this.categoriaLocalDataSource; }
  get localAlmacen() { return this.almacenLocalDataSource; }

  // Network
  get network() { return networkService; }

  /**
   * Configura la URL del API
   */
  async setApiUrl(url: string): Promise<void> {
    // Asegurar que el container esté inicializado (y la DB lista)
    if (!this.initialized) {
      await this.initialize();
    }

    networkService.setBaseUrl(url);
    await this.configLocalDataSource.guardarApiUrl(url);
  }

  /**
   * Obtiene la URL del API actual
   */
  getApiUrl(): string {
    return networkService.getBaseUrl();
  }

  // ==================== ADMIN: GESTIÓN DE CACHÉ ====================

  /**
   * Obtiene estadísticas de las tablas de caché
   */
  async getCacheStats(): Promise<Record<string, number>> {
    const getTableCount = async (tableName: string): Promise<number> => {
      const row = await executeQueryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );
      return row?.count || 0;
    };

    return {
      movimientos_cache: await getTableCount('movimientos_cache'),
      movimientos_pendientes: await getTableCount('movimientos_pendientes WHERE sincronizado = 0'),
      qrs_cache: await getTableCount('qrs_cache'),
      productos_cache: await getTableCount('productos_cache'),
      stock_cache: await getTableCount('stock_cache'),
      categorias_cache: await getTableCount('categorias_cache'),
      almacenes_cache: await getTableCount('almacenes_cache'),
      usuarios_offline: await getTableCount('usuarios_offline'),
    };
  }

  /**
   * Limpia TODOS los datos de caché (no borra sesión ni configuración)
   */
  async limpiarTodoCache(): Promise<void> {
    await executeUpdate('DELETE FROM movimientos_cache');
    await executeUpdate('DELETE FROM movimientos_pendientes');
    await executeUpdate('DELETE FROM qrs_cache');
    await executeUpdate('DELETE FROM productos_cache');
    await executeUpdate('DELETE FROM stock_cache');
    await executeUpdate('DELETE FROM categorias_cache');
    await executeUpdate('DELETE FROM almacenes_cache');
    await executeUpdate('DELETE FROM usuarios_offline');
  }

  /**
   * Limpia una tabla de caché específica
   */
  async limpiarTablaCache(tabla: string): Promise<void> {
    const tablasPermitidas = [
      'movimientos_cache',
      'movimientos_pendientes',
      'qrs_cache',
      'productos_cache',
      'stock_cache',
      'categorias_cache',
      'almacenes_cache',
      'usuarios_offline',
    ];

    if (!tablasPermitidas.includes(tabla)) {
      throw new Error(`Tabla no permitida para limpiar: ${tabla}`);
    }

    await executeUpdate(`DELETE FROM ${tabla}`);
  }

  /**
   * Limpia datos de la aplicación (reseteo completo excepto configuración)
   */
  async resetearAplicacion(): Promise<void> {
    await this.limpiarTodoCache();
    await executeUpdate('DELETE FROM sesion');
    // Mantener configuración (api_url, etc.)
  }

  /**
   * Obtiene la última fecha de sincronización
   */
  async getUltimaSincronizacion(): Promise<Date | null> {
    return await this.configLocalDataSource.obtenerUltimaSincronizacion();
  }
}

// Instancia global
export const serviceContainer = ServiceContainer.getInstance();
