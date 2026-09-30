/**
 * Remote DataSource: Auth
 * Maneja la autenticación con el API
 */
import { networkService, ApiError } from '@/src/infrastructure';
import { LoginResponseDto } from '../../dtos';
import { Credenciales } from '@/src/domain';

const AUTH_ENDPOINTS = {
  LOGIN: '/api/auth/signin',
  REFRESH: '/api/auth/refresh-tokens',
  LOGOUT: '/api/auth/logout',
  REQUEST_RESET_PASSWORD: '/api/auth/request/reset/password',
  RESET_PASSWORD: '/api/auth/reset/password',
  CHANGE_PASSWORD: '/api/auth/change/password',
};

export class AuthRemoteDataSource {
  /**
   * Inicia sesión en el servidor
   */
async login(credenciales: Credenciales): Promise<LoginResponseDto> {
    const response = await networkService.post<LoginResponseDto>(
      AUTH_ENDPOINTS.LOGIN,
      {
        userName: credenciales.userName,
        password: credenciales.password,
      },
      false // No requiere auth
    );

// Guardar tokens (verificar que existan)
    if (response.data.accessToken) {
      await networkService.saveToken(response.data.accessToken, response.data.refreshToken || undefined);
    }

    return response.data;
  }

  /**
   * Refresca el token de acceso
   */
  async refreshToken(refreshToken: string): Promise<LoginResponseDto> {
    // El refresh endpoint requiere:
    // - Header: Authorization: Bearer <expired-token> (se agrega automáticamente si requiresAuth=true)
    // - Body: { refreshToken }
    const response = await networkService.post<LoginResponseDto>(
      AUTH_ENDPOINTS.REFRESH,
      { refreshToken },
      true  // requiresAuth = true para enviar el token expirado en el header
    );

    await networkService.saveToken(response.data.accessToken, response.data.refreshToken);

    return response.data;
  }

/**
   * Cierra sesión en el servidor
   */
  async logout(): Promise<void> {
    try {
      await networkService.post(AUTH_ENDPOINTS.LOGOUT, {});
    } finally {
      await networkService.clearTokens();
    }
  }

  /**
   * Solicitar código de recuperación de contraseña
   */
  async requestResetPassword(email: string): Promise<{ successStatus: boolean; message: string }> {
    const response = await networkService.patch<{ successStatus: boolean; message: string }>(
      AUTH_ENDPOINTS.REQUEST_RESET_PASSWORD,
      { email },
      false // No requiere auth
    );
    return response.data;
  }

  /**
   * Restablecer contraseña con código
   */
  async resetPassword(resetPasswordCode: number, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }> {
    const response = await networkService.patch<{ successStatus: boolean; message: string }>(
      AUTH_ENDPOINTS.RESET_PASSWORD,
      { resetPasswordCode, password, confirmPassword },
      false // No requiere auth
    );
    return response.data;
  }

  /**
   * Cambiar contraseña (usuario autenticado)
   */
  async changePassword(oldPassword: string, password: string, confirmPassword: string): Promise<{ successStatus: boolean; message: string }> {
    const response = await networkService.patch<{ successStatus: boolean; message: string }>(
      AUTH_ENDPOINTS.CHANGE_PASSWORD,
      { oldPassword, password, confirmPassword },
      true // Requiere auth
    );
    return response.data;
  }
}
