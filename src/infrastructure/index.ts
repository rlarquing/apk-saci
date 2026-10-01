/**
 * Infrastructure Layer - Exports
 *
 * NOTE: ServiceContainer is intentionally NOT re-exported here.
 * Re-exporting it created require cycles: barrel -> ServiceContainer -> data layer -> barrel.
 * Import it directly from '@/src/infrastructure/di/ServiceContainer'.
 */
export * from './database';
export * from './network/NetworkService';
export * from './alerts/AlertasLocales';
