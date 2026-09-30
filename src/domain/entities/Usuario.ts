/**
 * Domain Entity: Usuario
 * Representa un usuario del sistema SACI
 */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  roles: Rol[];
  almacenesAsignados: AlmacenAsignado[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Rol {
  id: string;
  nombre: string;
  funciones: Funcion[];
}

export interface Funcion {
  id: string;
  nombre: string;
  endpoint: string;
}

export interface AlmacenAsignado {
  id: string;
  nombre: string;
  descripcion: string;
}

/**
 * Credenciales para autenticación
 */
export interface Credenciales {
  userName: string;
  password: string;
}

/**
 * Sesión activa del usuario
 */
export interface Sesion {
  usuario: Usuario;
  token: string;
  refreshToken: string;
  almacenSeleccionado: AlmacenAsignado | null;
  expiresAt: Date;
}

/**
 * Estado de sincronización de credenciales
 */
export interface CredencialesOffline {
  userName: string;
  passwordHash: string;
  usuarioJson: string;
  syncedAt: Date;
}

/**
 * Nombres de rol del sistema. Deben coincidir exactamente con RolType
 * del API (api-saci/src/shared/enum/rol-type.enum.ts).
 */
export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  JEFE_DE_ALMACEN: 'JEFE_DE_ALMACEN',
  USUARIO: 'OPERARIO',
} as const;

export const MENSAJE_ACCESO_MOVIL_DENEGADO =
  'Este usuario no puede operar en la aplicación móvil. Utilice el sistema web.';

/**
 * Error de acceso denegado por rol.
 * Es una decisión firme: nunca debe degradarse a un intento de login offline.
 */
export class AccesoMovilDenegadoError extends Error {
  constructor(message: string = MENSAJE_ACCESO_MOVIL_DENEGADO) {
    super(message);
    this.name = 'AccesoMovilDenegadoError';
  }
}

/**
 * Regla de acceso a la app móvil.
 *
 * JEFE_DE_ALMACEN es un rol de supervisión y no opera en campo, por lo que
 * se le niega el acceso. La excepción es que además tenga un rol operativo
 * (USUARIO) o de administración, para no dejar fuera a un usuario con
 * roles combinados.
 *
 * Nota: esta es una regla de la app. El API sí autoriza a JEFE_DE_ALMACEN
 * en los endpoints de movimiento (@Roles en movimiento.controller.ts).
 */
export function puedeOperarEnMovil(usuario: Usuario | null | undefined): boolean {
  const roles = usuario?.roles?.map(r => r.nombre) ?? [];
  const esJefe = roles.includes(ROLES.JEFE_DE_ALMACEN);
  const tieneRolOperativo =
    roles.includes(ROLES.USUARIO) || roles.includes(ROLES.ADMINISTRADOR);

  return !esJefe || tieneRolOperativo;
}
