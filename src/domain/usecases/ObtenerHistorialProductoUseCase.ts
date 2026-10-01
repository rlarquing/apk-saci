/**
 * Use Case: ObtenerHistorialProductoUseCase (backlog P2 — timeline).
 * Consulta el kardex del servidor filtrado por producto
 * (GET /api/movimiento-inventario?productoId=…&limit=…).
 * ONLINE-ONLY: sin conexión devuelve un error amable sin throw.
 */
import { MovimientoRemoteDataSource } from '../../data/datasources/remote/MovimientoRemoteDataSource';

/** Fila cruda del kardex del API (puede traer nulls). */
interface MovimientoKardexCrud {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO';
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  almacenNombre: string;
  almacenDestinoNombre?: string | null;
  qrCodigo?: string | null;
  userName: string;
  fecha: string;
  saldoResultante?: number | null;
  observaciones?: string | null;
  signoAjuste?: number | null;
}

/** Fila del timeline del producto. */
export interface MovimientoHistorial {
  id: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'TRASLADO';
  productoCodigo: string;
  productoNombre: string;
  cantidad: number;
  almacenNombre: string;
  almacenDestinoNombre?: string;
  qrCodigo?: string;
  userName: string;
  fecha: string;
  saldoResultante?: number;
  observaciones?: string;
  signoAjuste?: number;
}

export interface ResultadoHistorial {
  exito: boolean;
  mensaje?: string;
  movimientos: MovimientoHistorial[];
}

export class ObtenerHistorialProductoUseCase {
  constructor(private movimientoRemoteDataSource: MovimientoRemoteDataSource) {}

  async execute(productoId: string): Promise<ResultadoHistorial> {
    try {
      const filas = await this.movimientoRemoteDataSource.obtenerMovimientosProducto(
        productoId
      );
      // Normalizar nulls del API a undefined (shape del dominio)
      const movimientos: MovimientoHistorial[] = filas.map(
        (m: MovimientoKardexCrud) => ({
          id: m.id,
          tipo: m.tipo,
          productoCodigo: m.productoCodigo,
          productoNombre: m.productoNombre,
          cantidad: m.cantidad,
          almacenNombre: m.almacenNombre,
          almacenDestinoNombre: m.almacenDestinoNombre ?? undefined,
          qrCodigo: m.qrCodigo ?? undefined,
          userName: m.userName,
          fecha: m.fecha,
          saldoResultante: m.saldoResultante ?? undefined,
          observaciones: m.observaciones ?? undefined,
          signoAjuste: m.signoAjuste ?? undefined,
        })
      );
      return { exito: true, movimientos };
    } catch (error) {
      return {
        exito: false,
        mensaje:
          error instanceof Error
            ? error.message
            : 'No se pudo consultar el historial (requiere conexión)',
        movimientos: [],
      };
    }
  }
}
