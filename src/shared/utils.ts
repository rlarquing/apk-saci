/**
 * Formatea una fecha a string legible
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea duración en minutos a string legible
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  return remainingHours > 0 
    ? `${days}d ${remainingHours}h` 
    : `${days}d`;
}

/**
 * Formatea monto a moneda
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Valida si un string es una URL válida
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parsea datos del QR
 */
export function parseQRData(data: string): { id?: string; plate?: string; type?: string } | null {
  try {
    // Intentar parsear como JSON
    const parsed = JSON.parse(data);
    return {
      id: parsed.id || parsed.vehicleId || parsed.vehiculo_id,
      plate: parsed.plate || parsed.placa,
      type: parsed.type || parsed.tipo,
    };
  } catch {
    // Si no es JSON, asumir que es un ID o placa
    if (data.length <= 10 && /^[A-Z0-9-]+$/i.test(data)) {
      // Parece una placa
      return { plate: data.toUpperCase() };
    }
    // Asumir que es un ID
    return { id: data };
  }
}
