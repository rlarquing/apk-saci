/**
 * Use Case: SincronizarUseCase
 * Maneja la sincronización de datos pendientes con el servidor
 * Incluye: purga de cache, límite de reintentos, limpieza de credenciales,
 * sincronización de QRs y almacenes
 */
import { SyncRepository } from '@/src/domain';
import { MovimientoRepository } from '@/src/domain';
import { AuthRepository } from '@/src/domain';
import { PrecioRepository } from '@/src/domain';
import { CategoriaRepository } from '@/src/domain';
import { QRRepository } from '@/src/domain';
import { AlmacenRepository } from '@/src/domain';
import { SyncResult, MovimientoPendiente } from '../entities';

// Constantes de purga
const MAX_REINTENTOS = 5;          // Máximo reintentos antes de descartar
const DIAS_CACHE_MOVIMIENTOS = 30;  // Días para purgar movimientos cache
const DIAS_CREDENCIALES = 90;      // Días para purgar credenciales offline

export interface SincronizarCallbacks {
  onProgress?: (progreso: number, mensaje: string) => void;
  onComplete?: (resultado: SyncResult) => void;
  onError?: (error: string) => void;
}

export class SincronizarUseCase {
  constructor(
    private syncRepository: SyncRepository,
    private movimientoRepository: MovimientoRepository,
    private authRepository: AuthRepository,
    private precioRepository: PrecioRepository,
    private categoriaRepository: CategoriaRepository,
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
      return {
        exito: false,
        movimientosSincronizados: 0,
        movimientosConError: 0,
        datosActualizados: { precios: 0, tiposMedio: 0, usuarios: 0 },
        errores: [{ idLocal: '', operacion: 'concurrencia', error }],
      };
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
        return {
          exito: false,
          movimientosSincronizados: 0,
          movimientosConError: 0,
          datosActualizados: { precios: 0, tiposMedio: 0, usuarios: 0 },
          errores: [{ idLocal: '', operacion: 'conexion', error }],
        };
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
      const errores: Array<{ idLocal: string; operacion: string; error: string }> = [];

      // 4. Enviar cada movimiento pendiente
      for (let i = 0; i < pendientes.length; i++) {
        const pendiente = pendientes[i];
        const progreso = 20 + Math.floor((i / Math.max(pendientes.length, 1)) * 30);
        onProgress?.(progreso, `Sincronizando movimiento ${i + 1} de ${pendientes.length}...`);

        try {
          if (pendiente.operacion === 'entrada') {
            const resultado = await this.movimientoRepository.registrarEntrada(pendiente.data as any, {
              // El pendiente YA está encolado: si la red falla a mitad del
              // sync, el fallback offline del repository crearía un duplicado.
              permitirFallbackOffline: false,
            });

            // registrarEntrada/registrarSalida NO lanzan: capturan el error
            // internamente y devuelven exito=false. Sin esta comprobación el
            // pendiente se marcaba como sincronizado aunque el servidor lo
            // hubiera rechazado, perdiendo el movimiento en silencio.
            if (!resultado.exito) {
              throw new Error(resultado.mensaje || 'El servidor rechazó la entrada');
            }

            const idReal = resultado.movimiento?.id || '';

            // La entrada offline se guardó con id temporal `local-...`. Si el
            // id difiere, insertar la fila con el id real del server y borrar
            // la fila local para no duplicar el conteo de vehículos dentro.
            if (idReal && /^[0-9a-f]{24}$/i.test(idReal) && idReal !== pendiente.idLocal) {
              const local = await this.movimientoRepository.obtenerMovimientoPorId(pendiente.idLocal);
              if (local) {
                const conIdReal = { ...local, id: idReal, sincronizado: true };
                await this.movimientoRepository.guardarMovimiento(conIdReal);
                await this.movimientoRepository.eliminarMovimientoLocal(pendiente.idLocal);
              }
            }

            await this.movimientoRepository.marcarSincronizado(pendiente.idLocal, idReal);
            movimientosSincronizados++;
          } else {
            // Salida: resolver antes el id real del movimiento. Si la entrada
            // se creó offline y aún no está sincronizada, el id del cache es
            // `local-...` que la API rechazaría. Las pendientes se procesan en
            // orden de creación (ASC), así que si la entrada de este QR está
            // pendiente ANTES en la lista, ya fue enviada en este mismo loop y
            // su id real quedó en el cache. Aquí solo falta resolver el caso
            // en que la entrada se sincronizó en un ciclo anterior.
            const salidaData = pendiente.data as any;
            let movimientoId: string = salidaData.movimientoId;
            if (/^local-/i.test(movimientoId)) {
              // La fila local ya está cerrada (la salida offline la cerró), así
              // que la búsqueda debe incluir movimientos cerrados.
              const ultimo = await this.movimientoRepository.obtenerUltimoMovimientoPorQR(
                salidaData.qrCodigo,
                salidaData.almacenId
              );
              if (ultimo && !/^local-/i.test(ultimo.id)) {
                movimientoId = ultimo.id;
              } else {
                // La entrada aún no existe en el server: abortar este intento
                // (sin contar reintento como error duro; se logra en el próximo
                // ciclo cuando la entrada llegue).
                throw new Error('La entrada asociada aún no está sincronizada');
              }
            }

            // Con el id ya resuelto, enviar la salida al server. Se pasa la
            // fecha de salida offline guardada en data para que el ledger
            // local conserve la hora real, no la de la sincronización.
            const fechaSalidaOffline = (salidaData as any).fechaSalida
              ? new Date((salidaData as any).fechaSalida)
              : undefined;
            const resultado = await this.movimientoRepository.registrarSalida({
              ...salidaData,
              movimientoId,
            } as any, { permitirFallbackOffline: false, fechaSalida: fechaSalidaOffline });

            if (!resultado.exito) {
              throw new Error(resultado.mensaje || 'El servidor rechazó la salida');
            }

            await this.movimientoRepository.marcarSincronizado(
              pendiente.idLocal,
              resultado.movimiento?.id || movimientoId
            );
            movimientosSincronizados++;
          }
        } catch (error) {
          // El abort "entrada aún no sincronizada" no es un fallo del
          // pendiente: es una dependencia que se resolverá en el próximo ciclo
          // cuando la entrada llegue al server. Contarlo aquí incrementaría
          // reintentos y la purga por MAX_REINTENTOS borraría la salida,
          // dejando el movimiento abierto en el server para siempre.
          const esDependenciaSinResolver =
            error instanceof Error &&
            error.message === 'La entrada asociada aún no está sincronizada';

          if (!esDependenciaSinResolver) {
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
              error: error instanceof Error ? error.message : 'Error desconocido',
            });
          }
        }
      }

      // 5. Sincronizar precios y tipos de medio con el endpoint /api/sync
      //
      // No se condiciona al almacen seleccionado: SyncRequestDto no lleva
      // almacenId y el API deriva el alcance del usuario del JWT. Antes esto
      // estaba dentro de un `if (almacenId)` que impedía descargar catálogos
      // a un usuario que todavía no había elegido almacen.
      onProgress?.(55, 'Sincronizando datos del servidor...');
      const almacenId = sesion.almacenSeleccionado?.id;
      let preciosActualizados = 0;
      let tiposMedioActualizados = 0;

      try {
        const syncResult = await this.syncRepository.sincronizar({
          movimientosPendientes: [],
          ultimaSincronizacion: await this.syncRepository.obtenerUltimaSincronizacion(),
        });

        preciosActualizados = syncResult.datosActualizados.precios;

        // Sincronizar tipos de medio (vienen en la respuesta del sync)
        if (syncResult.datosActualizados.tiposMedio > 0) {
          onProgress?.(60, 'Actualizando tipos de medio...');
          tiposMedioActualizados = syncResult.datosActualizados.tiposMedio;
        }
      } catch (error) {
        // ignore
      }

      // 6. Sincronizar QRs desde el servidor
      onProgress?.(65, 'Sincronizando códigos QR...');
      let qrsActualizados = 0;
      try {
        qrsActualizados = await this.qrRepository.sincronizarQRs(almacenId || '');
      } catch (error) {
        // ignore
      }

      // 7. Sincronizar Almacenes desde el servidor
      onProgress?.(75, 'Sincronizando almacenes...');
      let almacenesActualizados = 0;
      try {
        almacenesActualizados = await this.almacenRepository.sincronizarAlmacenes();
      } catch (error) {
        // ignore
      }

      // 8. Actualizar fecha de última sincronización
      onProgress?.(85, 'Actualizando fecha de sincronización...');
      await this.syncRepository.guardarUltimaSincronizacion(new Date());

      // 9. PURGA: Limpiar datos obsoletos
      onProgress?.(90, 'Limpiando datos obsoletos...');
      await this.purgarDatosObsoletos();

      onProgress?.(100, 'Sincronización completada');

      const resultado: SyncResult = {
        exito: true,
        movimientosSincronizados,
        movimientosConError,
        datosActualizados: {
          precios: preciosActualizados,
          tiposMedio: tiposMedioActualizados,
          usuarios: 0,
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
      
      return {
        exito: false,
        movimientosSincronizados: 0,
        movimientosConError: 0,
        datosActualizados: { precios: 0, tiposMedio: 0, usuarios: 0 },
        errores: [{ idLocal: '', operacion: 'general', error: errorMessage }],
      };
    }
  }

  /**
   * PURGA: Limpia datos obsoletos de todas las tablas cache
   */
  private async purgarDatosObsoletos(): Promise<void> {
    try {
      // 1. Limpiar movimientos pendientes sincronizados > 7 días
      await this.movimientoRepository.limpiarMovimientosPendientesAntiguos(7);

      // 2. Purgar movimientos cache con salida > N días (crecimiento infinito)
      await this.movimientoRepository.limpiarMovimientosCacheAntiguos(DIAS_CACHE_MOVIMIENTOS);

      // 3. Purgar movimientos pendientes que excedieron reintentos
      await this.movimientoRepository.limpiarMovimientosPendientesExcedidos(MAX_REINTENTOS);

      // 4. Limpiar credenciales offline antiguas
      await this.authRepository.limpiarCredencialesAntiguas(DIAS_CREDENCIALES);

      // 5. Purgar QRs inactivos del cache local
      await this.movimientoRepository.limpiarQRsInactivos();
    } catch (error) {
      // ignore
    }
  }
}
