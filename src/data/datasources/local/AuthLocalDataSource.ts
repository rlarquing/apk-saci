/**
 * Local DataSource: Auth
 * Maneja los datos de autenticación en SQLite
 */
import { executeQuery, executeQueryFirst, executeUpdate, executeTransaction } from '@/src/infrastructure';
import { Usuario, Sesion, CredencialesOffline } from '@/src/domain';
import { UsuarioDto } from '../../dtos';
import { UsuarioMapper } from '../../mappers';

export class AuthLocalDataSource {
  // ==================== SESIÓN ====================

  async guardarSesion(sesion: Sesion): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO sesion (id, token, refresh_token, usuario_json, almacen_seleccionado_json, expires_at, created_at)
      VALUES (1, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeUpdate(sql, [
      sesion.token,
      sesion.refreshToken,
      JSON.stringify(UsuarioMapper.toDto(sesion.usuario)),
      sesion.almacenSeleccionado ? JSON.stringify(sesion.almacenSeleccionado) : null,
      sesion.expiresAt.toISOString(),
      new Date().toISOString(),
    ]);
  }

  async obtenerSesion(): Promise<Sesion | null> {
    const row = await executeQueryFirst<{
      token: string;
      refresh_token: string;
      usuario_json: string;
      almacen_seleccionado_json: string | null;
      expires_at: string;
    }>('SELECT * FROM sesion WHERE id = 1');

    if (!row) return null;

    const usuarioDto: UsuarioDto = JSON.parse(row.usuario_json);
    const almacenSeleccionado = row.almacen_seleccionado_json 
      ? JSON.parse(row.almacen_seleccionado_json) 
      : null;

    return {
      usuario: UsuarioMapper.toEntity(usuarioDto),
      token: row.token,
      refreshToken: row.refresh_token,
      almacenSeleccionado,
      expiresAt: new Date(row.expires_at),
    };
  }

  async eliminarSesion(): Promise<void> {
    await executeUpdate('DELETE FROM sesion WHERE id = 1');
  }

  async actualizarAlmacenSeleccionado(almacen: any): Promise<void> {
    const sql = `
      UPDATE sesion SET almacen_seleccionado_json = ? WHERE id = 1
    `;
    await executeUpdate(sql, [almacen ? JSON.stringify(almacen) : null]);
  }

  // ==================== CREDENCIALES OFFLINE ====================

async guardarCredencialesOffline(credenciales: CredencialesOffline): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO usuarios_offline (user_name, password_hash, usuario_json, synced_at)
      VALUES (?, ?, ?, ?)
    `;
    
    await executeUpdate(sql, [
      credenciales.userName,
      credenciales.passwordHash,
      credenciales.usuarioJson,
      credenciales.syncedAt.toISOString(),
    ]);
  }

  async obtenerCredencialesOffline(userName: string): Promise<CredencialesOffline | null> {
    const row = await executeQueryFirst<{
      user_name: string;
      password_hash: string;
      usuario_json: string;
      synced_at: string;
    }>('SELECT * FROM usuarios_offline WHERE user_name = ?', [userName]);

    if (!row) return null;

    return {
      userName: row.user_name,
      passwordHash: row.password_hash,
      usuarioJson: row.usuario_json,
      syncedAt: new Date(row.synced_at),
    };
  }

async verificarCredenciales(userName: string, passwordHash: string): Promise<Usuario | null> {
    try {
      const row = await executeQueryFirst<{
        usuario_json: string;
      }>(
        'SELECT usuario_json FROM usuarios_offline WHERE user_name = ? AND password_hash = ?',
        [userName, passwordHash]
      );

      if (!row) return null;

      const usuarioDto: UsuarioDto = JSON.parse(row.usuario_json);

      return UsuarioMapper.toEntity(usuarioDto);
    } catch (error) {
      return null;
    }
  }

  async limpiarCredencialesAntiguas(diasAntiguedad: number): Promise<void> {
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasAntiguedad);

    await executeUpdate(
      'DELETE FROM usuarios_offline WHERE synced_at < ?',
      [fechaLimite.toISOString()]
    );
  }
}
