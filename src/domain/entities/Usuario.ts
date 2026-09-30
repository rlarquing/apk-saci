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
 * del API (api-saci/src/shared/enum/rol-type.enum.ts):
 * ADMINISTRADOR, JEFE_DE_ALMACEN y OPERARIO.
 */
export const ROLES = {
  ADMINISTRADOR: 'ADMINISTRADOR',
  JEFE_DE_ALMACEN: 'JEFE_DE_ALMACEN',
  OPERARIO: 'OPERARIO',
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
 * El móvil es la herramienta de los almacenes: OPERARIO escanea entradas y
 * salidas, JEFE_DE_ALMACEN supervisa y ADMINISTRADOR tiene acceso completo.
 * Un usuario sin ninguno de estos roles (solo perfiles administrativos de la
 * web) no puede operar en campo.
 *
 * Nota: esta es una regla de la app. El API además aplica @Roles y scoping
 * por almacén en cada endpoint.
 */
export function puedeOperarEnMovil(usuario: Usuario | null | undefined): boolean {
  const roles = usuario?.roles?.map(r => r.nombre) ?? [];
  const rolesPermitidos: string[] = [
    ROLES.ADMINISTRADOR,
    ROLES.JEFE_DE_ALMACEN,
    ROLES.OPERARIO,
  ];

  return roles.some(rol => rolesPermitidos.includes(rol));
}
