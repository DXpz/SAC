import { API_CONFIG } from '../config';
import { Agente } from '../types';

// URL del webhook de n8n para gestión de Round Robin de agentes
// En desarrollo usa ruta relativa que pasa por el proxy de Vite (/api/round-robin)
// En producción puede usar URL completa si se configura en variables de entorno
const WEBHOOK_ROUND_ROBIN_URL = API_CONFIG.WEBHOOK_ROUND_ROBIN_URL || '/api/round-robin';

// Tipos para las acciones del webhook
type AgentAction = 'agents.read' | 'agent.update' | 'agent.create';

interface Actor {
  user_id: string;
  email: string;
  role?: string;
}

interface AgentWebhookPayload {
  action: AgentAction;
  actor?: Actor;
  data?: {
    agente_id?: string;
    activo?: boolean;
    vacaciones?: boolean;
    nombre?: string;
    email?: string;
    pais?: string;
    rol?: string;
    estado?: string;
  };
}

interface AgentWebhookResponse {
  success?: boolean;
  error?: boolean;
  message?: string;
  agents?: any[];
  [key: string]: any;
}

/**
 * Obtiene la información del actor (usuario autenticado)
 */
const getActor = (): Actor | null => {
  try {
    const userStr = localStorage.getItem('intelfon_user');
    const userEmail = sessionStorage.getItem('intelfon_user_email');
    
    if (!userStr) {
      return null;
    }
    
    const user = JSON.parse(userStr);
    const email = userEmail || `${user.role?.toLowerCase()}@intelfon.com`;
    
    return {
      user_id: user.id || 'unknown',
      email: email,
      role: user.role || undefined
    };
  } catch (error) {
    return null;
  }
};

/**
 * Mapea la respuesta del webhook a un objeto Agente de la UI
 * 
 * Nota sobre orden_round_robin: El backend calcula el orden del Round Robin según la siguiente lógica:
 * 1. El primero en ser elegido (#1) es el agente que tiene MENOS casos activos
 * 2. En caso de empate en número de casos activos, se elige el que tenga el caso MÁS ANTIGUO
 *    (menor fecha de último caso asignado)
 */
const mapWebhookResponseToAgent = (webhookData: any): Agente | null => {
  if (!webhookData) return null;
  
  try {
    // El webhook retorna: { id, nombre, email, activo, vacaciones, casos_activos, orden_round_robin, dias_desde_ultimo_caso }
    // Necesitamos mapear a: { idAgente, nombre, email, estado, ordenRoundRobin, ultimoCasoAsignado, casosActivos }
    
    // Determinar el estado basado en activo y vacaciones
    let estado: 'Activo' | 'Inactivo' | 'Vacaciones' = 'Inactivo';
    if (webhookData.vacaciones === true) {
      estado = 'Vacaciones';
    } else if (webhookData.activo === true) {
      estado = 'Activo';
    }
    
    // Calcular la fecha del último caso asignado basado en dias_desde_ultimo_caso
    let ultimoCasoAsignado = new Date().toISOString();
    if (webhookData.dias_desde_ultimo_caso !== undefined && webhookData.dias_desde_ultimo_caso !== null) {
      const dias = typeof webhookData.dias_desde_ultimo_caso === 'number' ? webhookData.dias_desde_ultimo_caso : 0;
      const fechaUltimoCaso = new Date();
      fechaUltimoCaso.setDate(fechaUltimoCaso.getDate() - dias);
      ultimoCasoAsignado = fechaUltimoCaso.toISOString();
    }
    
    return {
      idAgente: webhookData.id || webhookData.agente_id || webhookData.idAgente || '',
      nombre: webhookData.nombre || webhookData.name || '',
      email: webhookData.email || '',
      estado: estado,
      ordenRoundRobin: webhookData.orden_round_robin !== undefined ? webhookData.orden_round_robin : (webhookData.ordenRoundRobin || 999),
      ultimoCasoAsignado: webhookData.ultimo_caso_asignado || webhookData.ultimoCasoAsignado || ultimoCasoAsignado,
      casosActivos: webhookData.casos_activos !== undefined ? webhookData.casos_activos : (webhookData.casosActivos || 0)
    };
  } catch (error) {
    return null;
  }
};

/**
 * Mapea un array de agentes del webhook a un array de Agente
 */
const mapWebhookResponseToAgents = (webhookData: any): Agente[] => {
  if (!webhookData) return [];
  
  try {
    // El webhook puede retornar un array directamente o dentro de una propiedad
    const agents = webhookData.agents || webhookData.agentes || (Array.isArray(webhookData) ? webhookData : []);
    
    if (!Array.isArray(agents)) {
      return [];
    }
    
    return agents
      .map(mapWebhookResponseToAgent)
      .filter((a): a is Agente => a !== null);
  } catch (error) {
    return [];
  }
};

/**
 * Llama al webhook de Round Robin con el payload especificado
 */
const callRoundRobinWebhook = async (payload: AgentWebhookPayload): Promise<AgentWebhookResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  
  try {
      url: WEBHOOK_ROUND_ROBIN_URL,
      action: payload.action,
      payload
    });
    
    const response = await fetch(WEBHOOK_ROUND_ROBIN_URL, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 0) {
        throw new Error('Error de CORS: El servidor no está permitiendo peticiones desde este origen.');
      }
      if (response.status === 404) {
        // Retornar respuesta vacía en lugar de lanzar error para que la app pueda usar fallback
        return { success: false, error: true, message: 'Webhook no disponible (404)', agents: [] };
      }
      // Para otros errores HTTP, también retornar respuesta con error en lugar de lanzar excepción
      return { success: false, error: true, message: `Error ${response.status}: ${response.statusText}`, agents: [] };
    }
    
    // Intentar parsear JSON
    let result: AgentWebhookResponse;
    try {
      const text = await response.text();
      if (text.trim() === '') {
        result = { success: true };
      } else {
        result = JSON.parse(text);
      }
    } catch (parseError) {
      if (response.ok) {
        result = { success: true };
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }
    
    
    // Verificar si hay error en la respuesta
    // Si el error es 404 o webhook no disponible, no lanzar excepción, solo retornar el resultado
    if (result && result.error === true && result.message?.includes('404')) {
      return result; // Retornar el resultado con error para que getAgents lo maneje
    }
    
    if (result && result.error === true) {
      throw new Error(result.message || 'Error en la operación');
    }
    
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Timeout: El servidor no respondió a tiempo. Verifica tu conexión.');
    }
    
            if (error.message && (
              error.message.includes('CORS') || 
              error.message.includes('cors') ||
              error.message.includes('fetch') ||
              error.message.includes('NetworkError')
            )) {
              throw new Error('Error de CORS: El servidor n8n necesita permitir peticiones desde este dominio. Contacta al administrador.');
            }
            
            if (error.message && error.message.includes('404')) {
              // Retornar respuesta con error pero sin lanzar excepción para que la app pueda usar fallback
              return { success: false, error: true, message: 'Webhook no disponible', agents: [] };
            }
    
    if (error.message) {
      throw error;
    }
    
    throw new Error('Error de conexión con el servidor.');
  }
};

/**
 * Obtiene todos los agentes con información de Round Robin
 * DESHABILITADO: Ya no se usa el webhook de round robin
 */
export const getAgents = async (): Promise<Agente[]> => {
  // Webhook de round robin deshabilitado - retornar array vacío
  return [];
};

/**
 * Actualiza el estado de un agente (activo/inactivo/vacaciones)
 * DESHABILITADO: Ya no se usa el webhook de round robin
 */
export const updateAgentStatus = async (
  agenteId: string,
  activo: boolean,
  vacaciones: boolean = false
): Promise<boolean> => {
  // Webhook de round robin deshabilitado
  return false;
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!agenteId) {
    throw new Error('ID de agente requerido.');
  }
  
  const payload: AgentWebhookPayload = {
    action: 'agent.update',
    actor,
    data: {
      agente_id: agenteId,
      activo: activo,
      vacaciones: vacaciones
    }
  };
  
  const response = await callRoundRobinWebhook(payload);
  
  return response.success !== false && !response.error;
};

/**
 * Crea un nuevo agente en el sistema
 * DESHABILITADO: Ya no se usa el webhook de round robin
 */
export const createAgent = async (
  nombre: string,
  email: string,
  pais: string
): Promise<boolean> => {
  // Webhook de round robin deshabilitado
  return false;
};

