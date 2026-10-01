/**
 * Entidad de conteo cíclico de inventario (backlog P1).
 * Reflejo del ReadConteoDto del API. El conteo es una actividad ONLINE:
 * no se cachea ni se encola — si no hay conexión, no se puede contar.
 */

export type EstadoConteo = 'ABIERTO' | 'CERRADO' | 'CANCELADO';

export interface ConteoLinea {
  productoId: string;
  productoCodigo: string;
  productoNombre: string;
  /** Stock esperado congelado al abrir el conteo. */
  cantidadEsperada: number;
  cantidadContada: number | null;
  stockAlCierre: number | null;
  /** contada - stock real al cierre (negativo = faltante). */
  diferencia: number | null;
  ajusteId: string | null;
  observaciones?: string | null;
}

export interface ConteoResumen {
  lineas: number;
  contadas: number;
  sinContar: number;
  sobrantes: number;
  faltantes: number;
  ajustesGenerados: number;
  errores: Array<{ productoCodigo: string; error: string }>;
}

export interface ConteoInventario {
  id: string;
  almacenId: string;
  almacenNombre: string;
  userName: string;
  estado: EstadoConteo;
  esCiego: boolean;
  fechaApertura?: string;
  fechaCierre?: string;
  lineas: ConteoLinea[];
  resumen?: ConteoResumen | null;
  totalLineas: number;
  totalContadas: number;
}

/** Resultado estándar de operaciones de conteo (sin excepciones). */
export interface ResultadoConteo {
  exito: boolean;
  mensaje: string;
  conteoId?: string;
}

/** Resultado de abrir la lista/detalle de conteos. */
export interface ResultadoListaConteos {
  exito: boolean;
  mensaje: string;
  conteos: ConteoInventario[];
}
