/**
 * AlertasLocalesService (backlog P2 — push).
 *
 * Notificaciones locales (expo-notifications) cuando el resumen del almacén
 * detecta productos por debajo del punto de reorden que NO estaban antes.
 * No requiere credenciales de Expo Push ni servidor: es una notificación
 * local del dispositivo, disparada tras el refresco del resumen (post-sync,
 * polling de 30s o pull-to-refresh).
 *
 * Deduplicación: se guarda en memoria la firma (productoId|almacenId) de la
 * última notificación; tras reiniciar la app la primera detección sirve de
 * línea base (no se spamea al abrir). El envío es best-effort: cualquier
 * fallo (permiso denegado, módulo ausente) se ignora silenciosamente.
 */

class AlertasLocalesServiceImpl {
  private modulo: any = null;
  private permisoVerificado = false;
  private permisoConcedido = false;
  /** Firma por almacén: Set de "productoId" que estaban bajo umbral. */
  private firmaActual = new Map<string, Set<string>>();

  /** Carga perezosa del módulo nativo (puede no estar en el bundle). */
  private async cargarModulo(): Promise<any> {
    if (this.modulo) return this.modulo;
    try {
      // require dinámico: evita romper el arranque si el módulo nativo no existe
      this.modulo = require('expo-notifications');
    } catch {
      this.modulo = null;
    }
    return this.modulo;
  }

  private async asegurarPermiso(): Promise<boolean> {
    if (this.permisoVerificado) return this.permisoConcedido;
    try {
      const Notifications = await this.cargarModulo();
      if (!Notifications) return false;

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const permisos = await Notifications.getPermissionsAsync();
      if (permisos.granted) {
        this.permisoConcedido = true;
      } else if (permisos.canAskAgain) {
        const pedido = await Notifications.requestPermissionsAsync();
        this.permisoConcedido = !!pedido.granted;
      }
    } catch {
      this.permisoConcedido = false;
    } finally {
      this.permisoVerificado = true;
    }
    return this.permisoConcedido;
  }

  /**
   * Procesa la lista de productos a reponer y notifica los NUEVOS (que no
   * estaban en la firma anterior). Deduplica por producto+almacén.
   */
  async procesarAlertas(
    items: Array<{
      productoId: string;
      productoCodigo: string;
      productoNombre: string;
      stock: number;
      puntoReorden: number;
      estado: 'BAJO_MINIMO' | 'REORDEN';
    }>,
    almacenId: string
  ): Promise<void> {
    try {
      if (items.length === 0) {
        // Todo volvió al punto de reorden: resetear línea base
        this.firmaActual.set(almacenId, new Set());
        return;
      }

      const setNuevo = new Set(items.map(i => `${i.productoId}|${almacenId}`));
      const setPrevio = this.firmaActual.get(almacenId) ?? new Set<string>();

      // Línea base tras reinicio: si no había firma en memoria, solo registrar
      const esPrimeraDeteccion = !this.firmaActual.has(almacenId);
      this.firmaActual.set(almacenId, setNuevo);

      if (esPrimeraDeteccion) return;

      const nuevos = items.filter(i => !setPrevio.has(`${i.productoId}|${almacenId}`));
      if (nuevos.length === 0) return;

      const concedido = await this.asegurarPermiso();
      if (!concedido) return;

      const Notifications = await this.cargarModulo();
      if (!Notifications) return;

      const titulo =
        nuevos.length === 1
          ? 'Stock bajo el punto de reorden'
          : `${nuevos.length} productos requieren reposición`;
      const cuerpo =
        nuevos
          .slice(0, 3)
          .map(n => `${n.productoCodigo} ${n.productoNombre} (${n.stock}/${n.puntoReorden})`)
          .join(' · ') + (nuevos.length > 3 ? ' …' : '');

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `SACI · ${titulo}`,
          body: cuerpo,
          sound: true,
        },
        trigger: null, // inmediato
      });
    } catch {
      // best-effort: nunca romper el flujo por una notificación
    }
  }
}

export const alertasLocalesService = new AlertasLocalesServiceImpl();
