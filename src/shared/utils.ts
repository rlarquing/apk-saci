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
 * Formatea una cantidad de unidades (hasta 2 decimales, sin ceros de más)
 */
export function formatCantidad(cantidad: number): string {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(cantidad);
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
 * Extrae el código de etiqueta de un QR escaneado.
 * El contenido puede ser un JSON con {codigo} (formato del generador de
 * etiquetas del API) o el código en texto plano (QR-XXXXXX / PRD-XXXXXX).
 */
export function parseQRData(data: string): { codigo: string } {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.codigo === 'string') {
      return { codigo: parsed.codigo };
    }
  } catch {
    // No es JSON: usar el texto crudo
  }
  return { codigo: data.trim() };
}
