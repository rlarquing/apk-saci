/**
 * Repository Implementation: AuthRepository
 * Implementa la interfaz del dominio usando datasources local y remoto
 */
import { AuthRepository } from '@/src/domain';
import { 
  Usuario, 
  Credenciales, 
  Sesion, 
  CredencialesOffline 
} from '@/src/domain';
import { AuthLocalDataSource } from '@/src/data/datasources/local/AuthLocalDataSource';
import { AuthRemoteDataSource } from '@/src/data/datasources/remote/AuthRemoteDataSource';
import { SesionMapper } from '../mappers';
import { networkService } from '@/src/infrastructure';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(
    private localDataSource: AuthLocalDataSource,
    private remoteDataSource: AuthRemoteDataSource
  ) {}

async login(credenciales: Credenciales): Promise<Sesion> {
    const response = await this.remoteDataSource.login(credenciales);

    // Crear usuario con los datos del login
    const almacenes = response.almacenes || [];

    // Mapear roles - la API ahora devuelve roles como SelectDto {value, label}
    // ANTES se mapeaba functions a roles, lo cual era INCORRECTO (functions son permisos, no roles)
    const roles = Array.isArray(response.roles) ? response.roles.map((r: any) => ({
      id: r?.value?.toString() || r?.id?.toString() || '',
      nombre: r?.label || r?.nombre || '',
      funciones: [],
    })) : [];

    // Mapear almacenes - soportar ambos formatos: {value,label} y {id,nombre}
    const almacenesAsignados = Array.isArray(almacenes) ? almacenes.map((p: any) => ({
      id: p?.value?.toString() || p?.id?.toString() || '1',
      nombre: p?.label || p?.nombre || 'Almacen',
      descripcion: p?.descripcion || p?.direccion || '',
    })) : [];

    const usuario = {
      id: response.userId?.toString() || credenciales.userName,
      nombre: response.userName || credenciales.userName,
      email: response.email || '',
      activo: true,
      roles,
      almacenesAsignados,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Si solo tiene un almacen, seleccionarlo automáticamente
    // Si tiene múltiples, dejarlo null para que la pantalla de selección se muestre
    const almacenSeleccionado = usuario.almacenesAsignados.length === 1
      ? usuario.almacenesAsignados[0]
      : null;

    return {
      usuario,
      token: response.accessToken || '',
      refreshToken: response.refreshToken || '',
      almacenSeleccionado,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

async refreshToken(refreshToken: string): Promise<Sesion> {
    const response = await this.remoteDataSource.refreshToken(refreshToken);

    const sesionActual = await this.localDataSource.obtenerSesion();

    // Mantener el usuario de la sesión actual
    const usuario = sesionActual?.usuario || {
      id: 'usuario',
      nombre: 'Usuario',
      email: 'usuario@saci.com',
      activo: true,
      roles: [{ id: '1', nombre: 'Usuario', funciones: [] }],
      almacenesAsignados: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Actualizar roles del API si vienen en el refresh
    if (Array.isArray(response.roles) && response.roles.length > 0) {
      usuario.roles = response.roles.map((r: any) => ({
        id: r?.value?.toString() || r?.id?.toString() || '',
        nombre: r?.label || r?.nombre || '',
        funciones: [],
      }));
    }

    // Actualizar almacenes del API si vienen en el refresh
    const almacenes = response.almacenes || [];
    if (Array.isArray(almacenes) && almacenes.length > 0) {
      usuario.almacenesAsignados = almacenes.map((p: any) => ({
        id: p?.value?.toString() || p?.id?.toString() || '1',
        nombre: p?.label || p?.nombre || 'Almacen',
        descripcion: p?.descripcion || p?.direccion || '',
      }));
    }

    return {
      usuario,
      token: response.accessToken,
      refreshToken: response.refreshToken,
      almacenSeleccionado: sesionActual?.almacenSeleccionado || null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async logout(token: string): Promise<void> {
    try {
      await this.remoteDataSource.logout();
    } catch (error) {
      // ignore
    }
  }

  async guardarSesionLocal(sesion: Sesion): Promise<void> {
    await this.localDataSource.guardarSesion(sesion);
    await networkService.saveToken(sesion.token, sesion.refreshToken);
  }

  async obtenerSesionLocal(): Promise<Sesion | null> {
    return await this.localDataSource.obtenerSesion();
  }

  async eliminarSesionLocal(): Promise<void> {
    await this.localDataSource.eliminarSesion();
    await networkService.clearTokens();
  }

  async guardarCredencialesOffline(credenciales: CredencialesOffline): Promise<void> {
    await this.localDataSource.guardarCredencialesOffline(credenciales);
  }

async obtenerCredencialesOffline(userName: string): Promise<CredencialesOffline | null> {
    return await this.localDataSource.obtenerCredencialesOffline(userName);
  }

async verificarCredencialesOffline(userName: string, password: string): Promise<Usuario | null> {
    // Generar hash del password
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const passwordHash = hash.toString(16);

    return await this.localDataSource.verificarCredenciales(userName, passwordHash);
  }

  async seleccionarAlmacen(almacenId: string): Promise<void> {
    const sesion = await this.localDataSource.obtenerSesion();
    if (!sesion) throw new Error('No hay sesión activa');

    const almacen = sesion.usuario.almacenesAsignados.find(p => p.id === almacenId);
    if (!almacen) throw new Error('Almacen no asignado al usuario');

    await this.localDataSource.actualizarAlmacenSeleccionado(almacen);
  }

  async requestResetPassword(email: string): Promise<{ successStatus: boolean; message: string }> {
    return await this.remoteDataSource.requestResetPassword(email);
  }

  async resetPassword(resetPasswordCode: number, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }> {
    return await this.remoteDataSource.resetPassword(resetPasswordCode, password, confirmPassword);
  }

  async changePassword(oldPassword: string, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }> {
    return await this.remoteDataSource.changePassword(oldPassword, password, confirmPassword);
  }

  async limpiarCredencialesAntiguas(diasAntiguedad: number): Promise<void> {
    await this.localDataSource.limpiarCredencialesAntiguas(diasAntiguedad);
  }
}
