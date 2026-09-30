/**
 * Tipado de variables de entorno expuestas al bundle (prefijo EXPO_PUBLIC_).
 * Solo las variables con ese prefijo se inyectan en la compilación.
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL?: string;
    }
  }
}

export {};
