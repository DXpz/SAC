/**
 * Servicio de Round Robin - DESHABILITADO.
 *
 * El backend ahora hace round-robin directamente en BD (ordenBy por
 * secuencia_asignacion, sin balanceo de carga). Este archivo se conserva
 * solo por compatibilidad histórica y queda como no-op.
 */

export type Agente = {
  id: string;
  nombre: string;
  email: string;
  pais?: string;
  orden?: number;
};

export const getAgents = async (): Promise<Agente[]> => {
  return [];
};

export const updateAgentStatus = async (
  _agenteId: string,
  _activo: boolean,
  _vacaciones: boolean = false
): Promise<boolean> => {
  return false;
};

export const createAgent = async (
  _nombre: string,
  _email: string,
  _pais: string
): Promise<boolean> => {
  return false;
};