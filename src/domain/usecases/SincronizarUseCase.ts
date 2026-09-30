/**
 * Use Case: SincronizarUseCase
 * Maneja la sincronización de datos pendientes con el servidor.
 *
 * Diseño alineado con el contrato real del API (api-saci):
 * - POST /api/sync exige movimientosPendientes NO vacío (@ArrayNotEmpty) y
 *   procesa cada ítem de forma independiente, devolviendo los errores por
 *   ítem y los catálogos completos (productos, stock y categorías).
 * - Por eso el envío es en LOTE cuando hay pendientes (y la misma respuesta
 *   actualiza las caches), y por GETs individuales cuando no los hay.
 * - El sync solo acepta entrada/salida: ajustes y traslados se gestionan
 *   desde el panel web.
 *
 * Incluye: candado anti-concurrencia, purga de cache, límite de reintentos,
 * limpieza de credenciales, sincronización de QRs y almacenes.
 */
import { SyncRepository } from '@/src/domain';
import { MovimientoRepository } from '@/src/domain';
import { AuthRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { AlmacenRepository } from '@/src/domain';
import { SyncResult } from '../entities';

// Constantes de purga
const MAX_REINTENTOS = 5;           // Máximo reintentos antes de descartar
const DIAS_CACHE_MOVIMIENTOS = 30;  // Días para purgar el ledger local
const DIAS_CREDENCIALES = 90;       // Días para purgar credenciales offline

export interface SincronizarCallbacks {
  onProgress?: (progreso: number, mensaje: string) => void;
  onComplete?: (resultado: SyncResult) => void;
  onError?: (error: string) => void;
}

function resultadoVacio(errores: SyncResult['errores']): SyncResult {
  return {
    exito: false,
    movimientosSincronizados: 0,
    movimientosConError: 0,
    datosActualizados: { productos: 0, categorias: 0, stock: 0 },
    errores,
  };
}

export class SincronizarUseCase {
  constructor(
    private syncRepository: SyncRepository,
    private movimientoRepository: MovimientoRepository,
    private authRepository: AuthRepository,
    private qrRepository: QRRepository,
    private almacenRepository: AlmacenRepository
  ) {}

  /**
   * Candado de sincronización.
   *
   * El ServiceContainer expone una única instancia de este use case, así que
   * este flag serializa a TODOS los disparadores: auto-sync al recuperar
   * conexión, banner del dashboard, botón manual de Configuración y primera
   * sincronización tras el login. Sin él, dos disparadores simultáneos
   * reenviarían los mismos movimientos pendientes y los duplicarían en el
   * servidor.
   */
  private enCurso = false;

  async execute(callbacks?: SincronizarCallbacks): Promise<SyncResult> {
    if (this.enCurso) {
      const error = 'Ya hay una sincronización en curso';
      callbacks?.onError?.(error);
      return resultadoVacio([{ idLocal: '', operacion: 'concurrencia', error }]);
    }

    this.enCurso = true;
    try {
      return await this.ejecutarSincronizacion(callbacks);
    } finally {
      this.enCurso = false;
    }
  }

  private async ejecutarSincronizacion(callbacks?: SincronizarCallbacks): Promise<SyncResult> {
    const { onProgress, onComplete, onError } = callbacks || {};

    try {
      // 1. Verificar conexión
      onProgress?.(0, 'Verificando conexión...');
      const hayConexion = await this.syncRepository.hayConexion();

      if (!hayConexion) {
        const error = 'No hay conexión con el servidor';
        onError?.(error);
        return resultadoVacio([{ idLocal: '', operacion: 'conexion', error }]);
      }

      // 2. Obtener sesión actual
      onProgress?.(10, 'Obteniendo sesión...');
      const sesion = await this.authRepository.obtenerSesionLocal();
      if (!sesion) {
        throw new Error('No hay sesión activa');
      }

      // 3. Obtener movimientos pendientes
      onProgress?.(20, 'Buscando movimientos pendientes...');
      const pendientes = await this.movimientoRepository.obtenerMovimientosPendientes();

      let movimientosSincronizados = 0;
      let movimientosConError = 0;
      const errores: SyncResult['errores'] = [];
      let datosActualizados: SyncResult['datosActualizados'] = {
        productos: 0,
        categorias: 0,
        stock: 0,
      };

      if (pendientes.length > 0) {
        // 4a. Enviar el lote completo en una sola llamada al API
        const porItem = Math.max(Math.floor(30 / pendientes.length), 1);
        for (let i = 0; i < pendientes.length; i++) {
          onProgress?.(
            20 + Math.min(i * porItem, 30),
            `Sincronizando movimiento ${i + 1} de ${pendientes.length}...`
          );
        }

        const resultado = await this.syncRepository.sincronizar(
          pendientes,
          await this.syncRepository.obtenerUltimaSincronizacion()
        );

        // Un fallo total de la llamada (red caída a mitad del POST) llega como
        // error 'conexion' sin ítems procesados: NO marcar nada como enviado.
        const falloTotal = !resultado.exito && resultado.errores.some(
          e => e.operacion === 'conexion' || e.operacion === 'general'
        );
        if (falloTotal) {
          throw new Error(resultado.errores[0]?.error || 'Error de sincronización');
        }

        // El API retorna los errores por ítem (id local); los ítems ausentes
        // en la lista de errores fueron procesados con éxito.
        const mapaErrores = new Map(resultado.errores.map(e => [e.idLocal, e]));

        for (const pendiente of pendientes) {
          const error = mapaErrores.get(pendiente.idLocal);
          if (error) {
            movimientosConError++;

            // Contabilizar el intento fallido. Sin esto `reintentos` queda
            // siempre en 0 y la purga por MAX_REINTENTOS nunca descarta un
            // pendiente irrecuperable: se reintentaría de forma indefinida.
            await this.movimientoRepository
              .incrementarReintentos(pendiente.idLocal)
              .catch(() => {});

            errores.push({
              idLocal: pendiente.idLocal,
              operacion: pendiente.operacion,
              error: error.error,
            });
          } else {
            // El lote no retorna el id real por ítem: la fila del ledger
            // conserva su id local, pero queda marcada como sincronizada.
            await this.movimientoRepository
              .marcarSincronizado(pendiente.idLocal)
              .catch(() => {});
            movimientosSincronizados++;
          }
        }

        // La respuesta del lote trae los catálogos completos ya guardados
        // en las caches locales por el SyncRepository.
        movimientosSincronizados = resultado.movimientosSincronizados || movimientosSincronizados;
        datosActualizados = resultado.datosActualizados;
      } else {
        // 4b. Sin pendientes: refrescar catálogos por GETs individuales
        // (el POST /api/sync rechaza listas vacías con 400).
        onProgress?.(40, 'Actualizando catálogos...');
        try {
          datosActualizados = await this.syncRepository.descargarDatosActualizados();
        } catch {
          // Sin catálogos frescos no se aborta el sync: las caches vigentes
          // siguen siendo válidas para operar offline.
        }
      }

      // 5. Sincronizar etiquetas QR desde el servidor (todos los almacenes
      // del usuario: el API deriva el alcance del JWT)
      onProgress?.(65, 'Sincronizando etiquetas QR...');
      let qrsActualizados = 0;
      try {
        qrsActualizados = await this.qrRepository.sincronizarQRs();
      } catch {
        // ignore
      }

      // 6. Sincronizar almacenes desde el servidor
      onProgress?.(75, 'Sincronizando almacenes...');
      let almacenesActualizados = 0;
      try {
        almacenesActualizados = await this.almacenRepository.sincronizarAlmacenes();
      } catch {
        // ignore
      }

      // 7. Actualizar fecha de última sincronización
      onProgress?.(85, 'Actualizando fecha de sincronización...');
      await this.syncRepository.guardarUltimaSincronizacion(new Date());

      // 8. PURGA: Limpiar datos obsoletos
      onProgress?.(90, 'Limpiando datos obsoletos...');
      await this.purgarDatosObsoletos();

      onProgress?.(100, 'Sincronización completada');

      const resultado: SyncResult = {
        exito: true,
        movimientosSincronizados,
        movimientosConError,
        datosActualizados: {
          ...datosActualizados,
          qrs: qrsActualizados,
          almacenes: almacenesActualizados,
        },
        errores,
      };

      onComplete?.(resultado);
      return resultado;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      onError?.(errorMessage);

      return resultadoVacio([{ idLocal: '', operacion: 'general', error: errorMessage }]);
    }
  }

  /**
   * PURGA: Limpia datos obsoletos de todas las tablas cache
   */
  private async purgarDatosObsoletos(): Promise<void> {
    try {
      // 1. Limpiar movimientos pendientes sincronizados > 7 días
      await this.movimientoRepository.limpiarMovimientosPendientesAntiguos(7);

      // 2. Purgar ledger local > N días (crecimiento infinito)
      await this.movimientoRepository.limpiarMovimientosCacheAntiguos(DIAS_CACHE_MOVIMIENTOS);

      // 3. Purgar movimientos pendientes que excedieron reintentos
      await this.movimientoRepository.limpiarMovimientosPendientesExcedidos(MAX_REINTENTOS);

      // 4. Limpiar credenciales offline antiguas
      await this.authRepository.limpiarCredencialesAntiguas(DIAS_CREDENCIALES);

      // 5. Purgar etiquetas QR obsoletas del cache local
      await this.movimientoRepository.limpiarQRsInactivos();
    } catch {
      // ignore
    }
  }
}
