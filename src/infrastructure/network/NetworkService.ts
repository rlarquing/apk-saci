/**
 * Network Service - Cliente HTTP
 * Maneja todas las comunicaciones con el API
 * Incluye auto-refresh de token en caso de 401
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'saci_token';
const REFRESH_TOKEN_KEY = 'saci_refresh_token';

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: any;
  requiresAuth?: boolean;
  timeout?: number;
  _isRetry?: boolean; // Flag interno para evitar refresh infinito
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class NetworkService {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 segundos
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  private onSessionExpired: (() => void) | null = null;

  constructor() {
    // La URL viene siempre de EXPO_PUBLIC_API_URL (inyectada en build time desde .env).
    // La configuración guardada en la app (ServiceContainer.initialize) la sobreescribe al arrancar.
    if (!process.env.EXPO_PUBLIC_API_URL) {
      throw new Error(
        'EXPO_PUBLIC_API_URL no está definida. Verifica que exista un archivo .env en la raíz del proyecto.'
      );
    }
    this.baseUrl = process.env.EXPO_PUBLIC_API_URL;
  }

  /**
   * Registra un callback para cuando la sesión expira (no se pudo refrescar)
   */
  setOnSessionExpired(callback: () => void): void {
    this.onSessionExpired = callback;
  }

  /**
   * Configura la URL base del API
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, ''); // Remover trailing slash
  }

  /**
   * Construye la URL completa combinando la base con el path,
   * evitando duplicar el segmento /api cuando la base ya lo incluye.
   * Ej: base="http://host:3000/api" + path="/api/auth/login" → "http://host:3000/api/auth/login"
   */
  private buildUrl(path: string): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const baseEndsWithApi = /\/api$/i.test(base);
    const pathStartsWithApi = /^\/api(\/|$)/i.test(cleanPath);
    if (baseEndsWithApi && pathStartsWithApi) {
      return `${base}${cleanPath.replace(/^\/api/i, '')}`;
    }
    return `${base}${cleanPath}`;
  }

  /**
   * Obtiene la URL base actual
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

/**
   * Guarda el token de autenticación
   */
  async saveToken(token: string, refreshToken?: string): Promise<void> {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  /**
   * Obtiene el token de autenticación
   */
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEY);
  }

  /**
   * Obtiene el refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * Elimina los tokens
   */
  async clearTokens(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  }

  /**
   * Verifica si hay conexión con el servidor
   */
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.buildUrl('/api/health'), {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Leer el boolean que devuelve el endpoint
      const data = await response.json();
      return data === true || data?.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Realiza una petición HTTP con auto-refresh en caso de 401
   */
  async request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
    const { method, path, body, requiresAuth = true, timeout = this.defaultTimeout, _isRetry = false } = config;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await this.getToken();
        if (token && token !== 'offline-token') {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(this.buildUrl(path), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Manejar 401 - Intentar refresh de token automáticamente
      if (response.status === 401 && requiresAuth && !_isRetry) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // Reintentar la petición original con el nuevo token
          return this.request<T>({ ...config, _isRetry: true });
        } else {
          // No se pudo refrescar - sesión expirada
          if (this.onSessionExpired) {
            this.onSessionExpired();
          }
          const errorData = await response.json().catch(() => ({ message: 'Sesión expirada' }));
          throw new ApiError('Sesión expirada. Por favor inicie sesión nuevamente.', 401, errorData);
        }
      }

      // Manejar respuesta
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new ApiError(
          errorData.message || `Error HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      
      return {
        data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Tiempo de espera agotado', 408, {});
        }
        throw new ApiError(error.message, 0, {});
      }

      throw new ApiError('Error de conexión', 0, {});
    }
  }

  /**
   * Intenta refrescar el token de acceso
   * Retorna true si el refresh fue exitoso, false si falló
   * Usa deduplicación: si ya hay un refresh en curso, espera ese resultado
   */
  private async tryRefreshToken(): Promise<boolean> {
    // Si ya hay un refresh en curso, esperar su resultado
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefreshToken();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Ejecuta el refresh del token
   */
  private async doRefreshToken(): Promise<boolean> {
    try {
      const refreshToken = await this.getRefreshToken();
      const currentToken = await this.getToken();

      if (!refreshToken || refreshToken === 'offline-refresh-token' ||
          !currentToken || currentToken === 'offline-token') {
        return false;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.buildUrl('/api/auth/refresh-tokens'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      if (data.accessToken) {
        await this.saveToken(data.accessToken, data.refreshToken || undefined);
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Realiza una petición GET
   */
  async get<T>(path: string, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'GET', path, requiresAuth });
  }

  /**
   * Realiza una petición POST
   */
  async post<T>(path: string, body: any, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'POST', path, body, requiresAuth });
  }

  /**
   * Realiza una petición PUT
   */
  async put<T>(path: string, body: any, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PUT', path, body, requiresAuth });
  }

  /**
   * Realiza una petición PATCH
   */
  async patch<T>(path: string, body: any, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'PATCH', path, body, requiresAuth });
  }

  /**
   * Realiza una petición DELETE
   */
  async delete<T>(path: string, requiresAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>({ method: 'DELETE', path, requiresAuth });
  }
}

/**
 * Error personalizado para respuestas del API
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  isTimeout(): boolean {
    return this.statusCode === 408;
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

// Instancia singleton
export const networkService = new NetworkService();
