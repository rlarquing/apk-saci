/**
 * Hook de presentación del conteo cíclico (backlog P1).
 * Encapsula listado, detalle y operaciones (crear/contar/cerrar/cancelar)
 * contra los use cases del container. ONLINE-ONLY: los mensajes de
 * desconexión los devuelven los use cases, no hay cola offline.
 */
import { useCallback, useState } from 'react';
import {
  ConteoInventario,
  EstadoConteo,
  ResultadoConteo,
} from '../../domain/entities/Conteo';
import { serviceContainer } from '../../infrastructure/di/ServiceContainer';

export interface MensajeConteo {
  tipo: 'success' | 'error';
  texto: string;
}

export function useConteoInventario() {
  const [conteos, setConteos] = useState<ConteoInventario[]>([]);
  const [conteo, setConteo] = useState<ConteoInventario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mensaje, setMensaje] = useState<MensajeConteo | null>(null);

  const cargarConteos = useCallback(async (estado?: EstadoConteo): Promise<void> => {
    setIsLoading(true);
    setMensaje(null);
    try {
      const resultado = await serviceContainer.listarConteos.execute(estado);
      setConteos(resultado.conteos);
      if (!resultado.exito) {
        setMensaje({ tipo: 'error', texto: resultado.mensaje });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cargarConteo = useCallback(async (conteoId: string): Promise<void> => {
    setIsLoading(true);
    setMensaje(null);
    try {
      const resultado = await serviceContainer.obtenerConteo.execute(conteoId);
      setConteo(resultado.conteo);
      if (!resultado.exito) {
        setMensaje({ tipo: 'error', texto: resultado.mensaje });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const crearConteo = useCallback(
    async (almacenId: string, esCiego: boolean): Promise<ResultadoConteo> => {
      setIsLoading(true);
      setMensaje(null);
      try {
        const resultado = await serviceContainer.crearConteo.execute(almacenId, esCiego);
        setMensaje({ tipo: resultado.exito ? 'success' : 'error', texto: resultado.mensaje });
        return resultado;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const registrarCantidad = useCallback(
    async (conteoId: string, productoId: string, cantidad: number): Promise<ResultadoConteo> => {
      setIsLoading(true);
      try {
        const resultado = await serviceContainer.contarProducto.execute(
          conteoId,
          productoId,
          cantidad
        );
        setMensaje({ tipo: resultado.exito ? 'success' : 'error', texto: resultado.mensaje });
        // Refrescar el detalle para reflejar la línea contada
        if (resultado.exito) {
          await cargarConteo(conteoId);
        }
        return resultado;
      } finally {
        setIsLoading(false);
      }
    },
    [cargarConteo]
  );

  const cerrarConteo = useCallback(
    async (conteoId: string): Promise<ResultadoConteo> => {
      setIsLoading(true);
      try {
        const resultado = await serviceContainer.cerrarConteo.execute(conteoId);
        setMensaje({ tipo: resultado.exito ? 'success' : 'error', texto: resultado.mensaje });
        if (resultado.exito) {
          await cargarConteo(conteoId);
        }
        return resultado;
      } finally {
        setIsLoading(false);
      }
    },
    [cargarConteo]
  );

  const cancelarConteo = useCallback(
    async (conteoId: string): Promise<ResultadoConteo> => {
      setIsLoading(true);
      try {
        const resultado = await serviceContainer.cancelarConteo.execute(conteoId);
        setMensaje({ tipo: resultado.exito ? 'success' : 'error', texto: resultado.mensaje });
        if (resultado.exito) {
          await cargarConteo(conteoId);
        }
        return resultado;
      } finally {
        setIsLoading(false);
      }
    },
    [cargarConteo]
  );

  const limpiarMensaje = useCallback((): void => {
    setMensaje(null);
  }, []);

  const limpiarConteo = useCallback((): void => {
    setConteo(null);
    setMensaje(null);
  }, []);

  return {
    conteos,
    conteo,
    isLoading,
    mensaje,
    cargarConteos,
    cargarConteo,
    crearConteo,
    registrarCantidad,
    cerrarConteo,
    cancelarConteo,
    limpiarMensaje,
    limpiarConteo,
  };
}
