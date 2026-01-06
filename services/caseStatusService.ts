/**
 * Servicio centralizado para gestión de cambios de estado de casos
 * Funciona localmente pero preparado para integración con webhook n8n
 */

import { CASE_TRANSITIONS } from '../constants';
import { HistorialEntry, AutorRol } from '../types';

// ==================================================
// INTERFACES Y TIPOS
// ==================================================

export interface ChangeStatusParams {
  nuevoEstado: string;
  justificacion: string;
  autor_nombre: string;
  autor_rol: AutorRol;
}

export interface WebhookPayload {
  case_id: string;
  estado_anterior: string;
  estado_nuevo: string;
  justificacion: string;
  autor: {
    nombre: string;
    rol: AutorRol;
  };
  fecha: string;
}

// ==================================================
// FUNCIÓN CENTRAL DE CAMBIO DE ESTADO
// ==================================================

export function changeCaseStatus(
  caso: any,
  params: ChangeStatusParams
): { casoActualizado: any; payload: WebhookPayload | null } {
  const { nuevoEstado, justificacion, autor_nombre, autor_rol } = params;
  const estadoActual = caso.estado || caso.status || 'Nuevo';

  // 1. Validar que la transición esté permitida
  const transicionesPermitidas = CASE_TRANSITIONS[estadoActual] || [];
  if (!transicionesPermitidas.includes(nuevoEstado)) {
    throw new Error(
      `Transición no permitida: No se puede cambiar de "${estadoActual}" a "${nuevoEstado}". ` +
      `Transiciones permitidas: ${transicionesPermitidas.join(', ')}`
    );
  }

  // 2. Validar que la justificación no esté vacía
  if (!justificacion || !justificacion.trim()) {
    throw new Error('La justificación es obligatoria');
  }

  // 3. Guardar el estado anterior
  const estadoAnterior = estadoActual;

  // 4. Crear copia del caso para actualizar
  const casoActualizado = { ...caso };

  // 5. Actualizar el estado
  casoActualizado.estado = nuevoEstado;
  casoActualizado.status = nuevoEstado;

  // 6. Inicializar historial si no existe
  if (!casoActualizado.historial) {
    casoActualizado.historial = [];
  }
  if (!casoActualizado.history) {
    casoActualizado.history = [];
  }

  // 7. Crear nueva entrada en el historial
  const nuevaEntrada: HistorialEntry = {
    tipo_evento: "CAMBIO_ESTADO",
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    justificacion: justificacion.trim(),
    autor_nombre: autor_nombre,
    autor_rol: autor_rol,
    fecha: new Date().toISOString()
  };

  // 8. Insertar al inicio del historial (más reciente primero)
  casoActualizado.historial.unshift(nuevaEntrada);
  casoActualizado.history.unshift(nuevaEntrada);

  // 9. Preparar payload para webhook futuro
  const payload: WebhookPayload = {
    case_id: caso.id || caso.ticketNumber || '',
    estado_anterior: estadoAnterior,
    estado_nuevo: nuevoEstado,
    justificacion: justificacion.trim(),
    autor: {
      nombre: autor_nombre,
      rol: autor_rol
    },
    fecha: nuevaEntrada.fecha
  };

  return {
    casoActualizado,
    payload
  };
}

// ==================================================
// FUNCIÓN PREPARADA PARA WEBHOOK FUTURO (NO USADA AÚN)
// ==================================================

/**
 * Función preparada para enviar cambios de estado al webhook n8n
 * Actualmente NO se ejecuta, solo prepara el payload
 * 
 * @param payload - Payload con información del cambio de estado
 * @returns Promise que se resolverá cuando exista el webhook
 */
export async function sendStatusChangeToWebhook(payload: WebhookPayload): Promise<void> {
  // TODO: cuando exista el webhook de n8n
  // const N8N_WEBHOOK_URL = process.env.REACT_APP_N8N_WEBHOOK_URL || '';
  // 
  // try {
  //   await fetch(N8N_WEBHOOK_URL, {
  //     method: "POST",
  //     headers: { 
  //       "Content-Type": "application/json",
  //       "Authorization": `Bearer ${localStorage.getItem('intelfon_token')}`
  //     },
  //     body: JSON.stringify(payload)
  //   });
  // } catch (error) {
  //   console.error('Error al enviar cambio de estado al webhook:', error);
  //   throw error;
  // }
  
  console.log('📤 [Webhook] Payload preparado (no enviado aún):', payload);
}

// ==================================================
// HELPER: Inicializar historial al crear caso
// ==================================================

/**
 * Inicializa el historial de un caso nuevo con el evento de creación
 */
export function initializeCaseHistory(casoId: string): HistorialEntry[] {
  return [
    {
      tipo_evento: "CREADO",
      justificacion: "Caso creado",
      autor_nombre: "Sistema",
      autor_rol: "sistema",
      fecha: new Date().toISOString()
    }
  ];
}

// ==================================================
// HELPER: Obtener transiciones permitidas
// ==================================================

/**
 * Obtiene los estados destino permitidos para un estado dado
 */
export function getAllowedTransitions(estadoActual: string): string[] {
  return CASE_TRANSITIONS[estadoActual] || [];
}

// ==================================================
// HELPER: Validar transición
// ==================================================

/**
 * Valida si una transición de estado está permitida
 */
export function isValidTransition(estadoActual: string, estadoDestino: string): boolean {
  const transicionesPermitidas = CASE_TRANSITIONS[estadoActual] || [];
  return transicionesPermitidas.includes(estadoDestino);
}


