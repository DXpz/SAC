import { API_CONFIG } from '../config';
import { Case, CaseStatus, Channel, HistorialEntry, CaseTransition } from '../types';
import { calculateBusinessDaysElapsed, calculateSLADelayDays } from '../utils/slaUtils';
import { api } from './api';

// URL del webhook de n8n para gestión de casos
// En desarrollo usa ruta relativa que pasa por el proxy de Vite (/api/casos)
// En producción puede usar URL completa si se configura en variables de entorno
const WEBHOOK_CASOS_URL = API_CONFIG.WEBHOOK_CASOS_URL || '/api/casos';

// Tipos para las acciones del webhook
type CaseAction = 'case.create' | 'case.update' | 'case.edit' | 'case.read' | 'case.delete' | 'case.query' | 'case.agent';

interface Actor {
  user_id: number;
  email: string;
  role: string;
}

interface ClienteData {
  cliente_id: string;
  nombre_empresa?: string;
  contacto_principal?: string;
  email: string;
  telefono?: string;
}

interface CategoriaData {
  categoria_id: string;
  nombre?: string;
}

interface CaseWebhookPayload {
  action: CaseAction;
  actor: Actor;
  data: {
    update_type?: string;
    case_id?: string;
    canal_origen?: string;
    canal_notificacion?: string;
    asunto?: string;
    descripcion?: string;
    cliente?: ClienteData;
    categoria?: CategoriaData;
    estado?: string;
    comentario?: string;
    agent_id?: string; // Para reasignación de agente
    // Campos para case.edit y case.update según documentación
    cliente_id?: string;
    cliente_nombre?: string;
    email_cliente?: string;
    telefono_cliente?: string;
    patch?: any; // Mantener para compatibilidad con otros usos
    [key: string]: any; // Para campos adicionales que pueda retornar el webhook
  };
}

interface CaseWebhookResponse {
  success?: boolean;
  error?: boolean;
  message?: string;
  case?: any;
  cases?: any[];
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
    const numericId = Number(user.id || user.user_id || 0);
    
    return {
      user_id: Number.isNaN(numericId) ? 0 : numericId,
      email: email,
      role: user.role || 'AGENTE'
    };
  } catch (error) {
    return null;
  }
};

/**
 * Obtiene el rol del usuario autenticado
 */
const getUserRole = (): 'AGENTE' | 'SUPERVISOR' | 'GERENTE' | null => {
  try {
    const userStr = localStorage.getItem('intelfon_user');
    if (!userStr) {
      return null;
    }
    
    const user = JSON.parse(userStr);
    return user.role || null;
  } catch (error) {
    return null;
  }
};

/**
 * Obtiene y normaliza el país del usuario autenticado
 * Retorna 'SV' para El Salvador, 'GT' para Guatemala, o null si no está definido
 */
const getUserCountry = async (): Promise<'SV' | 'GT' | null> => {
  try {
    // Primero intentar desde api.getUser() que puede tener datos más actualizados
    const currentUser = api.getUser();
    let pais = currentUser?.pais || '';
    
    // Si el país es string vacío, tratarlo como undefined
    if (pais && String(pais).trim() !== '') {
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
        console.log('[caseService] ✅ País del supervisor desde api.getUser(): SV');
        return 'SV';
      }
      if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
        console.log('[caseService] ✅ País del supervisor desde api.getUser(): GT');
        return 'GT';
      }
    }
    
    // Fallback: leer desde localStorage directamente
    const userStr = localStorage.getItem('intelfon_user');
    if (!userStr) {
      console.error('[caseService] No se encontró usuario en localStorage');
      return null;
    }
    
    const user = JSON.parse(userStr);
    pais = user.pais || user.country || '';
    
    // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
    if (!pais || String(pais).trim() === '') {
      console.log('[caseService] 🔍 País no encontrado en localStorage, buscando en lista de usuarios...');
      try {
        const usuarios = await api.getUsuarios();
        const usuarioCompleto = usuarios.find((u: any) => 
          u.id === user.id || 
          u.idAgente === user.id || 
          u.id_agente === user.id ||
          u.id_usuario === user.id ||
          u.email === user.email ||
          (u.nombre && u.nombre.toUpperCase() === user.name.toUpperCase())
        );
        
        if (usuarioCompleto) {
          pais = usuarioCompleto.pais || usuarioCompleto.country || usuarioCompleto.país || '';
          console.log('[caseService] ✅ País encontrado en lista de usuarios:', {
            usuarioId: usuarioCompleto.id || usuarioCompleto.idAgente,
            usuarioNombre: usuarioCompleto.nombre || usuarioCompleto.name,
            pais: pais
          });
          
          // Si encontramos el país, actualizar el usuario en localStorage
          if (pais && String(pais).trim() !== '') {
            const updatedUser = { ...user, pais: pais };
            localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
            console.log('[caseService] ✅ País actualizado en localStorage');
          }
        } else {
          console.warn('[caseService] ⚠️ Usuario no encontrado en lista de usuarios');
        }
      } catch (error) {
        console.error('[caseService] Error obteniendo lista de usuarios:', error);
      }
    }
    
    // Validar que el país no sea string vacío
    if (!pais || String(pais).trim() === '') {
      console.error('[caseService] ⚠️ Usuario NO tiene país definido!', user);
      return null;
    }
    
    // Normalizar a códigos de 2 letras
    const paisNormalizado = String(pais).trim().toUpperCase();
    
    // El Salvador: SV, El_Salvador, El Salvador, etc.
    if (paisNormalizado === 'SV' || 
        paisNormalizado === 'EL_SALVADOR' || 
        paisNormalizado === 'EL SALVADOR' ||
        paisNormalizado.includes('SALVADOR')) {
      console.log('[caseService] ✅ País normalizado: SV');
      return 'SV';
    }
    
    // Guatemala: GT, Guatemala, etc.
    if (paisNormalizado === 'GT' || 
        paisNormalizado === 'GUATEMALA' ||
        paisNormalizado.includes('GUATEMALA')) {
      console.log('[caseService] ✅ País normalizado: GT');
      return 'GT';
    }
    
    console.error('[caseService] ⚠️ País no reconocido:', paisNormalizado);
    return null;
  } catch (error) {
    console.error('[caseService] ❌ Error obteniendo país del supervisor:', error);
    return null;
  }
};

/**
 * Normaliza el país de un caso a código de 2 letras (SV o GT)
 */
const normalizeCaseCountry = (pais: string | undefined): 'SV' | 'GT' | null => {
  // Si no hay país o es string vacío, retornar null
  if (!pais || String(pais).trim() === '') {
    return null;
  }
  
  const paisNormalizado = String(pais).trim().toUpperCase();
  
  // El Salvador
  if (paisNormalizado === 'SV' || 
      paisNormalizado === 'EL_SALVADOR' || 
      paisNormalizado === 'EL SALVADOR' ||
      paisNormalizado.includes('SALVADOR')) {
    return 'SV';
  }
  
  // Guatemala
  if (paisNormalizado === 'GT' || 
      paisNormalizado === 'GUATEMALA' ||
      paisNormalizado.includes('GUATEMALA')) {
    return 'GT';
  }
  
  return null;
};

/**
 * Mapea el canal de contacto a formato esperado por el webhook
 */
const mapChannel = (channel: Channel | string): string => {
  const channelMap: Record<string, string> = {
    [Channel.EMAIL]: 'Email',
    [Channel.WHATSAPP]: 'WhatsApp',
    [Channel.TELEFONO]: 'Teléfono',
    [Channel.WEB]: 'Web',
    [Channel.REDES_SOCIALES]: 'Redes Sociales'
  };
  
  return channelMap[channel] || channel.toString();
};

/**
 * Mapea un caso de la UI al formato esperado por el webhook para crear/actualizar
 */
const mapCaseToWebhookData = (caseData: any): CaseWebhookPayload['data'] => {
  const data: CaseWebhookPayload['data'] = {};
  
  if (caseData.case_id || caseData.id) {
    data.case_id = caseData.case_id || caseData.id;
  }
  
  // Canal de origen
  if (caseData.contactChannel || caseData.origin || caseData.canalOrigen) {
    data.canal_origen = mapChannel(caseData.contactChannel || caseData.origin || caseData.canalOrigen);
  }
  
  // Asunto
  if (caseData.subject || caseData.asunto) {
    data.asunto = caseData.subject || caseData.asunto;
  }
  
  // Descripción
  if (caseData.description || caseData.descripcion) {
    data.descripcion = caseData.description || caseData.descripcion;
  }
  
  // Cliente - Incluir todos los campos requeridos
  if (caseData.clienteId || caseData.clientId) {
    data.cliente = {
      cliente_id: caseData.clienteId || caseData.clientId,
      nombre_empresa: caseData.clientName || caseData.nombreEmpresa || caseData.cliente?.nombreEmpresa || 'Por definir',
      contacto_principal: caseData.contactName || caseData.contactoPrincipal || caseData.clientName || caseData.cliente?.contactoPrincipal || 'Por definir',
      email: caseData.clientEmail || caseData.email || caseData.cliente?.email || '',
      telefono: caseData.phone || caseData.telefono || caseData.clientPhone || caseData.cliente?.telefono || '',
      pais: caseData.pais || caseData.country || caseData.cliente?.pais || caseData.client?.pais || undefined
    };
  }
  
  // Categoría - Incluir categoria_id y nombre
  if (caseData.categoriaId || caseData.categoryId) {
    data.categoria = {
      categoria_id: caseData.categoriaId || caseData.categoryId,
      nombre: caseData.categoriaNombre || caseData.categoryName || caseData.categoria?.nombre || ''
    };
  }
  
  // Estado (si existe)
  if (caseData.status || caseData.estado) {
    data.estado = caseData.status || caseData.estado;
  }
  
  // Canal de notificación
  if (caseData.canal_notificacion || caseData.notificationChannel || caseData.canalNotificacion) {
    data.canal_notificacion = mapChannel(caseData.notificationChannel || caseData.canal_notificacion || caseData.canalNotificacion);
  }

  // País del caso
  if (caseData.pais || caseData.country) {
    data.pais = caseData.pais || caseData.country;
  }
  
  // IMPORTANTE: NO enviar información de agente
  // Si el usuario que crea el caso es un AGENTE, el webhook automáticamente asignará el caso a ese agente
  // Si el usuario es SUPERVISOR o GERENTE, el webhook hará Round Robin
  // El webhook detecta esto desde el actor.role
  
  return data;
};

/**
 * Convierte fecha en formato DD/MM/YYYY a ISO string
 */
const parseDate = (dateStr: string | undefined): string => {
  if (!dateStr) return new Date().toISOString();
  
  // Si ya es formato ISO, retornarlo
  if (dateStr.includes('T') || dateStr.includes('-')) {
    return new Date(dateStr).toISOString();
  }
  
  // Intentar parsear formato DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Mes es 0-indexed
    const year = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  
  // Fallback: intentar parsear como fecha estándar
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return new Date().toISOString();
};

/**
 * Mapea la respuesta del webhook a un objeto Case de la UI
 */
const mapWebhookResponseToCase = (webhookData: any): Case | null => {
  if (!webhookData) {
    return null;
  }
  
  // Si el objeto tiene una propiedad "data" que es un array, es un contenedor, no un caso
  if (webhookData.data && Array.isArray(webhookData.data)) {
    return null;
  }
  
  try {
    // El webhook puede retornar el caso en diferentes formatos
    // Intentamos normalizar a la estructura Case
    const caseData = webhookData.case || webhookData;
    
    // Validar que al menos tenga un ID
    const caseId = caseData.case_id || caseData.id || caseData.ticketNumber || caseData.idCaso || '';
    if (!caseId) {
      return null;
    }
    
    // Log detallado de todos los campos relacionados con agente
    const camposAgente = Object.keys(caseData).filter(k => 
      k.toLowerCase().includes('agent') || 
      k.toLowerCase().includes('agente') ||
      k.toLowerCase().includes('user')
    );
    
    // Mapear categoría con valores por defecto
    // Si solo tenemos categoria_id, crear un objeto básico
    const categoriaId = caseData.categoria_id || caseData.categoriaId || null;
    const categoria = caseData.categoria || caseData.category || null;
    const categoriaMapped = categoria ? {
      idCategoria: categoria.categoria_id || categoria.idCategoria || categoria.id || categoriaId || '',
      nombre: categoria.nombre || categoria.name || 'General',
      slaDias: categoria.slaDias || categoria.sla_dias || 5,
      activa: categoria.activa !== undefined ? categoria.activa : true
    } : {
      idCategoria: categoriaId?.toString() || '',
      nombre: 'General',
      slaDias: 5, // Default 5 días
      activa: true
    };
    
    // Mapear cliente con valores por defecto
    const cliente = caseData.cliente || caseData.client || null;
    
    const clienteMapped = cliente ? {
      idCliente: cliente.cliente_id || cliente.idCliente || cliente.id || '',
      nombreEmpresa: cliente.nombre_empresa || cliente.nombreEmpresa || cliente.nombre || '',
      contactoPrincipal: cliente.contacto_principal || cliente.contactoPrincipal || cliente.contacto || '',
      email: cliente.email || '',
      telefono: cliente.telefono || cliente.phone || '',
      pais: cliente.pais || cliente.country || 'El Salvador',
      estado: cliente.estado || cliente.state || 'Activo'
    } : null;
    
    
    // Mapear agente con valores por defecto
    const agente = caseData.agente || caseData.agenteAsignado || caseData.agent || null;
    
    // Si no hay objeto agente pero hay agente_id y agente_name, crear objeto básico
    // El webhook puede enviar agentename (todo junto) desde n8n con round robin
    const agenteId = caseData.agente_user_id || caseData.agente_id || caseData.agentId || '';
    const agenteName = caseData.agentename || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '';
    
    const agenteMapped = agente ? {
      idAgente: agente.id_agente || agente.agente_id || agente.idAgente || agente.id || '',
      nombre: agente.agentename || agente.nombre || agente.name || '', // Incluir agentename del objeto agente
      email: agente.email || '',
      estado: agente.estado || agente.state || 'Activo',
      ordenRoundRobin: agente.orden_round_robin || agente.ordenRoundRobin || 999,
      ultimoCasoAsignado: agente.ultimo_caso_asignado || agente.ultimoCasoAsignado || new Date().toISOString(),
      casosActivos: agente.casos_asignados || agente.casos_activos || agente.casosActivos || 0
    } : (agenteId && agenteName ? {
      idAgente: agenteId,
      nombre: agenteName,
      email: '',
      estado: 'Activo',
      ordenRoundRobin: 999,
      ultimoCasoAsignado: new Date().toISOString(),
      casosActivos: 0
    } : null);
    
    
    // Calcular días hábiles
    const createdAtStr = caseData.fecha_creacion || caseData.createdAt || caseData.fechaCreacion;
    const createdAt = parseDate(createdAtStr);
    const slaDays = categoriaMapped.slaDias;
    let diasAbierto = 0;
    let slaExpired = false;
    
    try {
      diasAbierto = calculateBusinessDaysElapsed(new Date(createdAt));
      const delayDays = calculateSLADelayDays(new Date(createdAt), slaDays);
      slaExpired = delayDays > 0;
    } catch (error) {
      diasAbierto = caseData.dias_abierto || caseData.diasAbierto || 0;
      slaExpired = caseData.sla_vencido || caseData.slaExpired || false;
    }
    
    // Capturar fecha final del SLA del webhook si está disponible
    const slaDeadlineFromWebhook = caseData.fecha_final_sla || 
                                   caseData.fechaFinalSLA || 
                                   caseData.sla_fecha_final || 
                                   caseData.slaDeadline || 
                                   caseData.fecha_limite_sla ||
                                   caseData.fechaLimiteSLA ||
                                   caseData.sla_fecha_limite ||
                                   null;
    
    // Preservar agente_user_id del webhook para comparación
    const agenteUserIdFromWebhook = caseData.agente_user_id || '';
    
    const mappedCase: Case = {
      id: caseId,
      ticketNumber: caseId,
      clientId: clienteMapped?.idCliente || caseData.cliente_id || caseData.clientId || '',
      clientName: clienteMapped?.nombreEmpresa || caseData.cliente_nombre || caseData.clientName || caseData.nombre_cliente || '',
      category: categoriaMapped.nombre,
      origin: caseData.canal_origen || caseData.origin || caseData.contactChannel || Channel.WEB,
      subject: caseData.asunto || caseData.subject || '',
      description: caseData.descripcion || caseData.description || '',
      status: caseData.estado || caseData.status || CaseStatus.NUEVO,
      priority: caseData.prioridad || caseData.priority || 'Media',
      agentId: agenteMapped?.idAgente || String(agenteUserIdFromWebhook || caseData.agente_id || caseData.agentId || ''),
      agentName: agenteMapped?.nombre || caseData.agentename || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '',
      createdAt: createdAt,
      pais: caseData.pais || caseData.country || clienteMapped?.pais || '',
      slaDeadline: slaDeadlineFromWebhook || undefined, // Fecha final del SLA del webhook
      history: caseData.historial || caseData.history || [],
      historial: caseData.historial || caseData.history || [],
      clientEmail: clienteMapped?.email || caseData.email_cliente || caseData.clientEmail || '',
      clientPhone: clienteMapped?.telefono || caseData.telefono_cliente || caseData.telfono_cliente || caseData.clientPhone || '',
      agenteAsignado: agenteMapped as any,
      categoria: categoriaMapped as any,
      cliente: clienteMapped as any,
      diasAbierto: diasAbierto,
      slaExpired: slaExpired
    };
    
    // Preservar agente_user_id del webhook en el objeto Case para comparación
    (mappedCase as any).agente_user_id = agenteUserIdFromWebhook;
    
    return mappedCase;
  } catch (error) {
    return null;
  }
};

/**
 * Mapea un array de casos del webhook a un array de Case
 */
const mapWebhookResponseToCases = (webhookData: any): Case[] => {
  if (!webhookData) {
    return [];
  }
  
  try {
    // Intentar extraer el array de casos
    let cases: any[] = [];
    
    if (Array.isArray(webhookData)) {
      // Si es un array directo (formato de case.agent)
      cases = webhookData.filter(item => {
        // Filtrar solo objetos que parezcan casos (tienen case_id, id, o ticketNumber)
        return item && typeof item === 'object' && (item.case_id || item.id || item.ticketNumber);
      });
      console.log('[caseService] mapWebhookResponseToCases - Array directo, casos válidos:', cases.length);
    } else if (webhookData.cases && Array.isArray(webhookData.cases)) {
      // Si tiene propiedad "cases"
      cases = webhookData.cases;
    } else if (webhookData.casos && Array.isArray(webhookData.casos)) {
      // Si tiene propiedad "casos"
      cases = webhookData.casos;
    } else if (webhookData.data && Array.isArray(webhookData.data)) {
      // Si tiene propiedad "data" que es un array
      cases = webhookData.data;
    } else {
      return [];
    }
    
    if (cases.length > 0) {
    }
    
    const mappedCases = cases
      .map((caseData, index) => {
        const mapped = mapWebhookResponseToCase(caseData);
        if (!mapped) {
        }
        return mapped;
      })
      .filter((c): c is Case => c !== null);
    
    
    return mappedCases;
  } catch (error) {
    return [];
  }
};

/**
 * Llama al webhook de casos con el payload especificado
 */
const callCaseWebhook = async (payload: CaseWebhookPayload): Promise<CaseWebhookResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
  
  try {
    const response = await fetch(WEBHOOK_CASOS_URL, {
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
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    // Intentar parsear JSON
    let result: CaseWebhookResponse;
    let responseText = '';
    try {
      responseText = await response.text();
      
      if (responseText.trim() === '') {
        result = { success: true };
      } else {
        result = JSON.parse(responseText);
      }
      
      
      // VERIFICACIÓN TEMPRANA: Detectar valid: false INMEDIATAMENTE después de parsear
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const validEarly = (result as any).valid;
        
        if (validEarly === "false" || validEarly === false || validEarly === "False" || validEarly === "FALSE" || 
            (typeof validEarly === 'string' && validEarly.toLowerCase().trim() === 'false')) {
        }
      }
      
      if (Array.isArray(result) && result.length > 0) {
        if (result[0] && typeof result[0] === 'object') {
          if ('historial_caso' in result[0]) {
          }
          if ('detalle_caso' in result[0]) {
          }
        }
      }
    } catch (parseError) {
      if (response.ok) {
        result = { success: true };
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }
    
    // Verificar si hay error en la respuesta
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
    
    if (error.message) {
      throw error;
    }
    
    throw new Error('Error de conexión con el servidor.');
  }
};

/**
 * Crea un nuevo caso
 */
export const createCase = async (caseData: {
  clienteId: string;
  categoriaId: string;
  contactChannel: Channel | string;
  subject: string;
  description: string;
  clientEmail?: string;
  [key: string]: any;
}): Promise<Case> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  // Validar campos requeridos (cliente puede ser opcional, se enviará "N/A" y "Por definir")
  if (!caseData.categoriaId || !caseData.subject || !caseData.description) {
    throw new Error('Faltan campos requeridos: categoría, asunto y descripción son obligatorios.');
  }
  
  // Mapear datos al formato del webhook
  const webhookData = mapCaseToWebhookData(caseData);
  
  // Asegurar que cliente siempre esté presente (aunque sea con valores por defecto)
  if (!webhookData.cliente) {
    webhookData.cliente = {
      cliente_id: caseData.clienteId || 'N/A',
      nombre_empresa: caseData.clientName || 'Por definir',
      contacto_principal: caseData.contactName || caseData.clientName || 'Por definir',
      email: caseData.clientEmail || '',
      telefono: caseData.phone || caseData.clientPhone || '',
      pais: caseData.pais || caseData.country || caseData.cliente?.pais || undefined
    };
  }
  
  // Asegurar que categoría siempre tenga nombre si está disponible
  if (webhookData.categoria && !webhookData.categoria.nombre && caseData.categoriaNombre) {
    webhookData.categoria.nombre = caseData.categoriaNombre;
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.create',
    actor,
    data: webhookData
  };
  
  
  const response = await callCaseWebhook(payload);
  
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    Object.keys(response).forEach(key => {
    });
  }
  
  // Si el webhook retorna un caso, mapearlo
  if (response.case) {
    
    const mappedCase = mapWebhookResponseToCase(response.case);
    if (mappedCase) {
      // Asegurar que el historial tenga la entrada de creación
      if (!mappedCase.historial) {
        mappedCase.historial = [];
      }
      if (!mappedCase.history) {
        mappedCase.history = [];
      }
      
      // Verificar si ya hay una entrada de creación
      const tieneEntradaCreacion = mappedCase.historial.some(entry => entry.tipo_evento === 'CREADO');
      
      // Si no hay entrada de creación, agregarla
      if (!tieneEntradaCreacion && mappedCase.createdAt) {
        const entradaCreacion: HistorialEntry = {
          tipo_evento: 'CREADO',
          justificacion: 'Caso creado',
          autor_nombre: 'Sistema',
          autor_rol: 'sistema',
          fecha: mappedCase.createdAt
        };
        // Agregar al final (más antigua) para que aparezca primero cuando se ordena por fecha descendente
        mappedCase.historial.push(entradaCreacion);
        mappedCase.history.push(entradaCreacion);
      }
      
      return mappedCase;
    }
  }
  
  // Si no retorna caso, crear uno básico desde los datos enviados
  // Esto es un fallback en caso de que el webhook no retorne el caso creado
  const fallbackCase: Case = {
    id: `CASO-${Date.now()}`,
    ticketNumber: `CASO-${Date.now()}`,
    clientId: caseData.clienteId,
    clientName: caseData.clientName || '',
    category: caseData.category || '',
    origin: caseData.contactChannel as Channel,
    subject: caseData.subject,
    description: caseData.description,
    status: CaseStatus.NUEVO,
    pais: caseData.pais || caseData.country || caseData.cliente?.pais || '',
    priority: 'Media',
    agentId: '',
    agentName: '',
    createdAt: new Date().toISOString(),
    slaExpired: false,
    history: [],
    clientEmail: caseData.clientEmail || '',
    diasAbierto: 0,
    agenteAsignado: null as any,
    categoria: null as any,
    cliente: null as any
  };
  
  return fallbackCase;
};

/**
 * Obtiene todos los casos
 * Si el usuario es AGENTE, solo retorna los casos asignados a ese agente usando case.agent
 * Si el usuario es SUPERVISOR o GERENTE, retorna todos los casos usando case.read
 */
export const getCases = async (): Promise<Case[]> => {
  const actor = getActor();
  const userRole = getUserRole();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  // Si es AGENTE, usar case.agent para obtener solo sus casos asignados
  if (userRole === 'AGENTE') {
    const payload: CaseWebhookPayload = {
      action: 'case.agent',
      actor,
      data: {
        case_id: '' // Vacío para obtener todos los casos del agente
      }
    };
    
    console.log('[caseService] Enviando case.agent para agente:', {
      actor: actor,
      payload: payload
    });
    
    const response = await callCaseWebhook(payload);
    
    console.log('[caseService] Respuesta de case.agent:', response);
    
    // Procesar la respuesta de la misma manera que case.read
    const casos = processWebhookResponse(response);
    
    console.log('[caseService] Casos procesados para agente:', {
      total: casos.length,
      casos: casos.map(c => ({
        id: c.id,
        ticketNumber: c.ticketNumber,
        agente_user_id: (c as any).agente_user_id,
        agentId: c.agentId,
        agenteAsignado: c.agenteAsignado?.idAgente
      }))
    });
    
    return casos;
  }
  
  // Si es SUPERVISOR o GERENTE, usar case.read para obtener todos los casos
  const payload: CaseWebhookPayload = {
    action: 'case.read',
    actor,
    data: {}
  };
  
  const response = await callCaseWebhook(payload);
  
  let casos = processWebhookResponse(response);
  
  // Si es SUPERVISOR, filtrar casos por país del supervisor
  if (userRole === 'SUPERVISOR') {
    const supervisorCountry = await getUserCountry();
    
    if (supervisorCountry) {
      console.log('[caseService] Filtrando casos por país del supervisor:', supervisorCountry);
      
      casos = casos.filter(caso => {
        // Obtener el país del caso desde diferentes fuentes posibles
        const casoPais = (caso as any).pais || 
                        caso.cliente?.pais || 
                        (caso as any).country ||
                        '';
        
        const casoPaisNormalizado = normalizeCaseCountry(casoPais);
        
        // Si el caso no tiene país definido, no mostrarlo al supervisor
        if (!casoPaisNormalizado) {
          return false;
        }
        
        // Solo mostrar casos del mismo país que el supervisor
        const matches = casoPaisNormalizado === supervisorCountry;
        
        if (!matches) {
          console.log('[caseService] Caso filtrado por país:', {
            casoId: caso.id,
            casoPais: casoPais,
            casoPaisNormalizado: casoPaisNormalizado,
            supervisorCountry: supervisorCountry
          });
        }
        
        return matches;
      });
      
      console.log('[caseService] Casos después de filtrar por país:', {
        total: casos.length,
        supervisorCountry: supervisorCountry
      });
    } else {
      console.warn('[caseService] Supervisor sin país definido, mostrando todos los casos');
    }
  }
  
  return casos;
};

/**
 * Procesa la respuesta del webhook y retorna un array de casos mapeados
 */
const processWebhookResponse = (response: CaseWebhookResponse): Case[] => {
  console.log('[caseService] processWebhookResponse - Formato de respuesta:', {
    isArray: Array.isArray(response),
    type: typeof response,
    hasData: response && typeof response === 'object' && 'data' in response,
    response: response
  });
  
  // Intentar diferentes formatos de respuesta
  // Formato 1: Array directo (formato que retorna case.agent)
  // Ejemplo: [{ case_id: "CASO-0002", agente_user_id: "AG-0002", ... }, ...]
  if (Array.isArray(response)) {
    console.log('[caseService] Respuesta es array directo, longitud:', response.length);
    
    // Si el array contiene objetos con propiedad "data" que es un array, extraerlos
    const allCases: any[] = [];
    for (const item of response) {
      if (item && typeof item === 'object') {
        // Si el item tiene case_id o id, es un caso directo
        if (item.case_id || item.id || item.ticketNumber) {
          allCases.push(item);
        } else if (item.data && Array.isArray(item.data)) {
          // Si tiene data como array, extraer los casos
          allCases.push(...item.data);
        } else if (Array.isArray(item)) {
          // Si el item es un array, agregarlo directamente
          allCases.push(...item);
        } else {
          // Si el item es un caso individual, agregarlo
          allCases.push(item);
        }
      }
    }
    
    console.log('[caseService] Casos extraídos del array:', allCases.length);
    if (allCases.length > 0) {
      const mapped = mapWebhookResponseToCases(allCases);
      console.log('[caseService] Casos mapeados:', mapped.length);
      return mapped;
    } else {
      // Si no se pudo extraer, intentar mapear el array directamente
      console.log('[caseService] Mapeando array directamente');
      return mapWebhookResponseToCases(response);
    }
  }
  
  // Formato 2: { cases: [...] } o { casos: [...] }
  if (response.cases && Array.isArray(response.cases)) {
    return mapWebhookResponseToCases(response.cases);
  }
  
  if (response.casos && Array.isArray(response.casos)) {
    return mapWebhookResponseToCases(response.casos);
  }
  
  // Formato 3: { data: [...] } - ESTE ES EL FORMATO QUE ESTÁ RETORNANDO EL WEBHOOK
  if (response.data) {
    if (Array.isArray(response.data)) {
      const mapped = mapWebhookResponseToCases(response.data);
      return mapped;
    }
    if (response.data.cases && Array.isArray(response.data.cases)) {
      return mapWebhookResponseToCases(response.data.cases);
    }
    if (response.data.casos && Array.isArray(response.data.casos)) {
      return mapWebhookResponseToCases(response.data.casos);
    }
  }
  
  // Formato 4: Un solo caso { case: {...} }
  if (response.case) {
    const mappedCase = mapWebhookResponseToCase(response.case);
    return mappedCase ? [mappedCase] : [];
  }
  
  // Si no se reconoce el formato, loguear y retornar vacío
  
  return [];
};

/**
 * Obtiene un caso por ID usando case.query para obtener el historial completo
 */
export const getCaseById = async (caseId: string): Promise<Case | null> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!caseId) {
    throw new Error('ID de caso requerido.');
  }
  
  // Usar case.query para obtener el caso con historial completo
  const payload: CaseWebhookPayload = {
    action: 'case.query',
    actor,
    data: {
      case_id: caseId
    }
  };
  
  const response = await callCaseWebhook(payload);
  
  // Procesar respuesta del case.query (que viene con historial_caso y detalle_caso)
  if (Array.isArray(response) && response.length > 0) {
    const firstItem = response[0];
    
    // Verificar si es el formato con historial_caso y detalle_caso
    if (firstItem && typeof firstItem === 'object' && 'historial_caso' in firstItem && 'detalle_caso' in firstItem) {
      
      const historialArray = Array.isArray(firstItem.historial_caso) ? firstItem.historial_caso : [];
      const detalleCasoArray = Array.isArray(firstItem.detalle_caso) ? firstItem.detalle_caso : [];
      const agenteArray = Array.isArray(firstItem.agente) ? firstItem.agente : [];
      const transicionesArray = Array.isArray(firstItem.transiciones) ? firstItem.transiciones : [];
      
      
      // Mapear el historial
      const historialMapeado = historialArray.length > 0 
        ? mapWebhookHistorialToFrontend(historialArray as WebhookHistorialEntry[])
        : [];
      
      // Mapear las transiciones permitidas
      const transicionesMapeadas = transicionesArray.map((transicion: any) => ({
        row_number: transicion.row_number,
        estado_origen: transicion.estado_origen || transicion.estadoOrigen || '',
        estado_destino: transicion.estado_destino || transicion.estadoDestino || '',
        ...transicion // Preservar cualquier otro campo adicional
      }));
      
      // Mapear el caso desde detalle_caso y combinar con datos del agente
      if (detalleCasoArray.length > 0) {
        const casoData = detalleCasoArray[0];
        
        // Si hay información del agente en el array agente, combinarla con los datos del caso
        if (agenteArray.length > 0) {
          const agenteData = agenteArray[0];
          
          // Combinar datos del agente con los datos del caso
          casoData.agente = agenteData;
          casoData.agente_nombre = agenteData.nombre || casoData.agente_nombre;
          casoData.agente_name = agenteData.nombre || casoData.agente_name;
          casoData.agentename = agenteData.nombre || casoData.agentename;
          casoData.agente_id = agenteData.id_agente || casoData.agente_id;
          casoData.agente_user_id = agenteData.id_agente || casoData.agente_user_id;
        }
        
        const casoActualizado = mapWebhookResponseToCase(casoData);
        
        if (casoActualizado) {
          // Agregar las transiciones permitidas
          casoActualizado.transiciones = transicionesMapeadas;
          
          // Usar el historial del webhook (historial_caso) si está disponible
          // Este es el historial completo y correcto que viene de n8n
          if (historialMapeado.length > 0) {
            casoActualizado.historial = [...historialMapeado];
            casoActualizado.history = [...historialMapeado];
          } else {
            // Si no hay historial del webhook, usar el que viene del caso mapeado
            // o inicializar si no existe
            if (!casoActualizado.historial || casoActualizado.historial.length === 0) {
              casoActualizado.historial = casoActualizado.history || [];
              casoActualizado.history = casoActualizado.historial;
            }
          }
          
          return casoActualizado;
        }
      }
    }
  }
  
  // Fallback: intentar mapear como caso normal (sin historial)
  if (response.case) {
    return mapWebhookResponseToCase(response.case);
  }
  
  // Si retorna un array, buscar el caso por ID
  if (response.cases || response.casos || Array.isArray(response)) {
    const cases = mapWebhookResponseToCases(response);
    return cases.find(c => c.id === caseId || c.ticketNumber === caseId) || null;
  }
  
  return null;
};

/**
 * Mapea la respuesta del historial del webhook al formato del frontend
 */
interface WebhookHistorialEntry {
  id_historial: string;
  caso_id: string;
  fechayhora: string;
  estado_anterior: string;
  estado_nuevo: string;
  usuario: string;
  detalle: string;
}

const mapWebhookHistorialToFrontend = (webhookHistorial: WebhookHistorialEntry[]): any[] => {
  return webhookHistorial.map(entry => {
    // Log básico para depurar problemas de fecha

    let fechaISO: string;

    try {
      const rawFecha = entry.fechayhora || (entry as any).fecha || (entry as any).fecha_hora || '';

      if (rawFecha) {
        // Caso 1: Formato DD/MM/YYYY HH:mm:ss (ej: "05/01/2026 05:15:11")
        const regexDMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?$/;
        const matchDMY = rawFecha.match(regexDMY);

        if (matchDMY) {
          const dia = matchDMY[1];
          const mes = matchDMY[2];
          const anio = matchDMY[3];
          const horaPart = matchDMY[4] || '00:00:00';
          fechaISO = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}T${horaPart}`;
        } else {
          // Caso 2: Probar si el formato es directamente parseable por Date
          const parsed = new Date(rawFecha);
          if (!isNaN(parsed.getTime())) {
            fechaISO = parsed.toISOString();
          } else {
            fechaISO = new Date().toISOString();
          }
        }
      } else {
        fechaISO = new Date().toISOString();
      }
    } catch (e) {
      fechaISO = new Date().toISOString();
    }

    // Determinar autor_rol basado en el email del usuario
    // Por ahora usamos 'agente' por defecto, pero podríamos buscar el usuario en localStorage
    let autor_rol: 'agente' | 'supervisor' | 'sistema' = 'agente';
    try {
      const userStr = localStorage.getItem('intelfon_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.role === 'SUPERVISOR' || user.role === 'GERENTE') {
          autor_rol = 'supervisor';
        }
      }
    } catch {
      // Si no se puede obtener el usuario, usar 'agente' por defecto
    }

    return {
      tipo_evento: 'CAMBIO_ESTADO' as const,
      estado_anterior: entry.estado_anterior,
      estado_nuevo: entry.estado_nuevo,
      justificacion: entry.detalle,
      autor_nombre: entry.usuario, // Usar el email como nombre por ahora
      autor_rol: autor_rol,
      fecha: fechaISO
    };
  });
};

export const updateCaseStatus = async (
  caseId: string,
  newStatus: string,
  detail?: string,
  clienteId?: string
): Promise<Case> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!caseId || !newStatus) {
    throw new Error('ID de caso y nuevo estado son requeridos.');
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.update',
    actor,
    data: {
      update_type: 'update',
      case_id: caseId,
      estado: newStatus,
      comentario: detail || `Cambio de estado a ${newStatus}`,
      cliente_id: clienteId || undefined
    }
  };
  
  
  // Enviar actualización de estado
  const response = await callCaseWebhook(payload);
  
  // ========== VALIDACIÓN INMEDIATA: Verificar si el webhook rechazó el comentario ==========
  // IMPORTANTE: Esta validación debe ser LO PRIMERO que se haga después de recibir la respuesta
  // El webhook puede retornar 200 OK pero con valid: "false" cuando rechaza
  // O puede retornar un array (historial) cuando acepta
  
  // Función auxiliar para verificar si un valor es "false" en cualquier formato
  const esValorFalse = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    if (value === false) return true;
    if (value === 0) return false; // 0 no es false en este contexto
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      return trimmed === 'false' || trimmed === '"false"' || trimmed === "'false'";
    }
    return false;
  };
  
  // Verificar si el webhook rechazó el comentario (valid: "false" o valid: false)
  // El webhook puede retornar valid como string "false" o booleano false
  let validValue: any = undefined;
  let responseObj: any = null;
  
  // Intentar extraer valid de diferentes estructuras de respuesta
  if (response && typeof response === 'object') {
    if (Array.isArray(response)) {
      // Si es un array, buscar en el primer elemento
      if (response.length > 0 && typeof response[0] === 'object') {
        responseObj = response[0];
        validValue = responseObj.valid;
      }
    } else {
      // Si es un objeto, buscar directamente
      responseObj = response;
      validValue = (response as any).valid;
      
      // También buscar en data si existe
      if (validValue === undefined && (response as any).data) {
        validValue = (response as any).data.valid;
        if (validValue !== undefined) {
          responseObj = (response as any).data;
        }
      }
      
      // También buscar en el nivel raíz si no se encontró
      if (validValue === undefined) {
        // Intentar buscar en cualquier propiedad que contenga "valid"
        for (const key in response) {
          if (key.toLowerCase().includes('valid')) {
            validValue = (response as any)[key];
            break;
          }
        }
      }
    }
  }
  
  // Verificar si el comentario fue rechazado
  const esComentarioInvalido = esValorFalse(validValue);
  
  // DEBUG: Log temporal para verificar la detección (remover después)
  if (validValue !== undefined) {
    console.log('[DEBUG] Valid value detected:', validValue, 'Type:', typeof validValue, 'Is invalid:', esComentarioInvalido);
  }
  
  // VALIDACIÓN CRÍTICA: Si es inválido, lanzar error INMEDIATAMENTE y DETENER ejecución
  // ESTO DEBE SER LO PRIMERO - ANTES de cualquier otro código
  if (esComentarioInvalido) {
    console.log('[DEBUG] Lanzando error de comentario inválido');
    
    // Extraer mensaje de error del campo "comentario" o "message" o "error"
    let mensajeError = 'El comentario no cumple con los requisitos necesarios.';
    
    if (responseObj) {
      const comentarioError = responseObj.comentario || responseObj.message || responseObj.error || responseObj.feedback;
      if (comentarioError) {
        mensajeError = typeof comentarioError === 'string' ? comentarioError : JSON.stringify(comentarioError);
      }
    } else if (response && typeof response === 'object' && !Array.isArray(response)) {
      const comentarioError = (response as any).comentario || (response as any).message || (response as any).error;
      if (comentarioError) {
        mensajeError = typeof comentarioError === 'string' ? comentarioError : JSON.stringify(comentarioError);
      }
    }
    
    // LANZAR ERROR - esto detendrá la ejecución inmediatamente
    // IMPORTANTE: Este throw detendrá TODA la ejecución de updateCaseStatus
    const error = new Error(`Comentario no válido: ${mensajeError}`);
    throw error;
    // NUNCA se ejecutará código después de este throw
  }
  
  // Si llegamos aquí, significa que valid NO es false
  
  // Si llegamos aquí, el comentario NO fue rechazado (valid !== false)
  // IMPORTANTE: Este código SOLO se ejecuta si valid NO es false
  // Verificar si es un array (historial) - significa que fue exitoso
  const esRespuestaExitosa = Array.isArray(response) && response.length > 0;
  
  
  if (esRespuestaExitosa) {
  } else {
    // Si no es array ni tiene valid: false, asumir éxito (compatibilidad con otros formatos)
    // PERO solo si NO tiene valid: false (ya validado arriba)
  }
  
  // Continuar con la obtención del caso actualizado
  // (el código que sigue después del else original)
  
  // El webhook YA actualizó el caso, ahora consultamos para obtener el caso actualizado
  
  const queryPayloadCaseId: CaseWebhookPayload = {
    action: 'case.query',
    actor,
    data: {
      case_id: caseId
    }
  };
  
  const queryPayloadUserId: CaseWebhookPayload = {
    action: 'case.query',
    actor,
    data: {
      user_id: actor.user_id
    }
  };
  
  
  // Hacer ambas peticiones en paralelo
  const [queryResponseCaseId, queryResponseUserId] = await Promise.all([
    callCaseWebhook(queryPayloadCaseId),
    callCaseWebhook(queryPayloadUserId)
  ]);
  
  if (Array.isArray(queryResponseCaseId) && queryResponseCaseId.length > 0) {
  }
  
  if (Array.isArray(queryResponseUserId) && queryResponseUserId.length > 0) {
  }
  
  // Usar la respuesta de case_id para el caso específico
  const queryResponse = queryResponseCaseId;
  
  // Procesar respuesta del case.query (que viene con historial_caso y detalle_caso)
  
  if (Array.isArray(queryResponse) && queryResponse.length > 0) {
    const firstItem = queryResponse[0];
    
    // Verificar si es el nuevo formato con historial_caso y detalle_caso
    if (firstItem && typeof firstItem === 'object' && 'historial_caso' in firstItem && 'detalle_caso' in firstItem) {
      
      const historialArray = Array.isArray(firstItem.historial_caso) ? firstItem.historial_caso : [];
      const detalleCasoArray = Array.isArray(firstItem.detalle_caso) ? firstItem.detalle_caso : [];
      const agenteArray = Array.isArray(firstItem.agente) ? firstItem.agente : [];
      const transicionesArray = Array.isArray(firstItem.transiciones) ? firstItem.transiciones : [];
      
      
      // Mapear el historial
      const historialMapeado = historialArray.length > 0 
        ? mapWebhookHistorialToFrontend(historialArray as WebhookHistorialEntry[])
        : [];
      
      // Mapear las transiciones permitidas
      const transicionesMapeadas = transicionesArray.map((transicion: any) => ({
        row_number: transicion.row_number,
        estado_origen: transicion.estado_origen || transicion.estadoOrigen || '',
        estado_destino: transicion.estado_destino || transicion.estadoDestino || '',
        ...transicion // Preservar cualquier otro campo adicional
      }));
      
      // Mapear el caso desde detalle_caso - SOLO usar datos del webhook
      if (detalleCasoArray.length > 0) {
        const casoData = detalleCasoArray[0];
        
        // Si hay información del agente en el array agente, combinarla con los datos del caso
        if (agenteArray.length > 0) {
          const agenteData = agenteArray[0];
          
          // Combinar datos del agente con los datos del caso
          casoData.agente = agenteData;
          casoData.agente_nombre = agenteData.nombre || casoData.agente_nombre;
          casoData.agente_name = agenteData.nombre || casoData.agente_name;
          casoData.agentename = agenteData.nombre || casoData.agentename;
          casoData.agente_id = agenteData.id_agente || casoData.agente_id;
          casoData.agente_user_id = agenteData.id_agente || casoData.agente_user_id;
        }
        
        const casoActualizado = mapWebhookResponseToCase(casoData);
        
        if (casoActualizado) {
          // Agregar las transiciones permitidas
          casoActualizado.transiciones = transicionesMapeadas;
          
          // Usar el historial del webhook (historial_caso) si está disponible
          // Este es el historial completo y correcto que viene de n8n
          if (historialMapeado.length > 0) {
            casoActualizado.historial = [...historialMapeado];
            casoActualizado.history = [...historialMapeado];
          } else {
            // Si no hay historial del webhook, usar el que viene del caso mapeado
            // o inicializar si no existe
            if (!casoActualizado.historial || casoActualizado.historial.length === 0) {
              casoActualizado.historial = casoActualizado.history || [];
              casoActualizado.history = casoActualizado.historial;
            }
          }
          
          // USAR SOLO EL ESTADO QUE RETORNA EL WEBHOOK - NO USAR newStatus COMO FALLBACK
          
          // 1. Intentar obtener el estado del historial (última entrada)
          let estadoDelWebhook: string | undefined = undefined;
          if (historialMapeado.length > 0) {
            const ultimaEntrada = historialMapeado[0];
            estadoDelWebhook = ultimaEntrada.estado_nuevo;
          }
          
          // 2. Si no hay estado en historial, usar el estado del caso mapeado del webhook
          if (!estadoDelWebhook) {
            estadoDelWebhook = casoActualizado.status || (casoActualizado as any).estado;
          }
          
          // 3. Si aún no hay estado, buscar en casoData original del webhook
          if (!estadoDelWebhook) {
            estadoDelWebhook = casoData.estado || casoData.status || casoData.estado_caso;
          }
          
          // 4. SOLO usar el estado del webhook, NO usar newStatus como fallback
          if (estadoDelWebhook) {
            casoActualizado.status = estadoDelWebhook;
            (casoActualizado as any).estado = estadoDelWebhook;
          } else {
            throw new Error('El webhook no retornó el estado del caso. No se puede determinar el estado actual.');
          }
          
          return casoActualizado;
        } else {
        }
      } else {
      }
      
      // Si no se pudo mapear el caso desde detalle_caso, lanzar error
      throw new Error('El webhook no retornó el detalle del caso actualizado');
    }
    
    // Verificar si es un array de historial directo (formato anterior)
    // NOTA: Este formato ya no se usa, pero mantenemos compatibilidad
    if (firstItem && typeof firstItem === 'object' && 'id_historial' in firstItem && 'caso_id' in firstItem) {
      
      const historialMapeado = mapWebhookHistorialToFrontend(queryResponse as WebhookHistorialEntry[]);
      
      // Obtener el caso actualizado desde el webhook (NO usar datos locales)
      const casoActualizado = await getCaseById(caseId);
      if (casoActualizado) {
        // Usar SOLO el historial del webhook, no combinar
        casoActualizado.historial = [...historialMapeado];
        casoActualizado.history = [...historialMapeado];
        
        // Actualizar el estado del caso con el estado_nuevo de la última entrada
        if (historialMapeado.length > 0) {
          const ultimaEntrada = historialMapeado[0];
          casoActualizado.status = ultimaEntrada.estado_nuevo || newStatus;
          (casoActualizado as any).estado = ultimaEntrada.estado_nuevo || newStatus;
        }
        
        return casoActualizado;
      } else {
        throw new Error('No se pudo obtener el caso actualizado desde el webhook');
      }
    }
  }
  
  // Si llegamos aquí, no se procesó el formato con historial_caso y detalle_caso
  // Intentar otros formatos como fallback
  
  // Si la respuesta es directamente un objeto de caso (tiene case_id o id)
  if (!Array.isArray(queryResponse) && queryResponse && typeof queryResponse === 'object') {
    const hasCaseId = 'case_id' in queryResponse || 'id' in queryResponse || 'ticketNumber' in queryResponse;
    if (hasCaseId) {
      const mappedCase = mapWebhookResponseToCase(queryResponse);
      if (mappedCase) {
        return mappedCase;
      }
    }
  }
  
  // Si retorna un objeto con data que es un array
  if (queryResponse && typeof queryResponse === 'object' && queryResponse.data && Array.isArray(queryResponse.data)) {
    const cases = mapWebhookResponseToCases(queryResponse.data);
    const foundCase = cases.find(c => {
      const cId = (c.id || c.ticketNumber || '').toString();
      const searchId = caseId.toString();
      return cId === searchId || cId === caseId || c.ticketNumber === caseId ||
             cId.replace(/^CASO-?/, '') === searchId.replace(/^CASO-?/, '');
    });
    if (foundCase) {
      return foundCase;
    }
  }
  
  // Si el webhook retorna el caso directamente
  if (queryResponse && typeof queryResponse === 'object' && queryResponse.case && !Array.isArray(queryResponse.case)) {
    const mappedCase = mapWebhookResponseToCase(queryResponse.case);
    if (mappedCase) {
      return mappedCase;
    }
  }
  
  // Si retorna cases o casos como array
  if (queryResponse && typeof queryResponse === 'object' && (queryResponse.cases || queryResponse.casos)) {
    const casesArray = queryResponse.cases || queryResponse.casos;
    if (Array.isArray(casesArray)) {
      const cases = mapWebhookResponseToCases(casesArray);
      const foundCase = cases.find(c => {
        const cId = c.id || c.ticketNumber || '';
        const searchId = caseId.toString();
        return cId === searchId || cId === caseId || c.ticketNumber === caseId;
      });
      if (foundCase) {
        return foundCase;
      }
    }
  }
  
  // Si no se pudo procesar la respuesta del case.query, intentar obtener el caso directamente
  // como último recurso
  try {
    const casoFallback = await getCaseById(caseId);
    if (casoFallback) {
      // Actualizar el estado con el nuevo estado que se envió
      casoFallback.status = newStatus;
      (casoFallback as any).estado = newStatus;
      return casoFallback;
    }
  } catch (fallbackError) {
    // Si también falla, continuar sin error - el frontend recargará el caso
  }
  
  // Si no se pudo obtener el caso de ninguna manera, el frontend lo recargará
  // No lanzar error para no interrumpir el flujo - el cambio de estado ya se procesó en el webhook
  // El frontend recargará el caso después de updateCaseStatus
  // Retornar un caso básico con el estado actualizado para que el frontend pueda continuar
  const casoBasico: Case = {
    id: caseId,
    ticketNumber: caseId,
    clientId: '',
    clientName: '',
    category: '',
    origin: Channel.WEB,
    subject: '',
    description: '',
    status: newStatus,
    priority: 'Media',
    agentId: '',
    agentName: '',
    createdAt: new Date().toISOString(),
    slaExpired: false,
    history: [],
    historial: [],
    clientEmail: '',
    diasAbierto: 0,
    agenteAsignado: null as any,
    categoria: null as any,
    cliente: null as any
  };
  
  return casoBasico;
};

/**
 * Reasigna un agente a un caso
 * Según documentación: update_type: "reassign", case_id, agent_id
 * Retorna void - el frontend debe recargar el caso después de la reasignación
 */
export const reassignCase = async (
  caseId: string,
  agentId: string
): Promise<void> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!caseId || !agentId) {
    throw new Error('ID de caso y ID de agente son requeridos.');
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.update',
    actor,
    data: {
      update_type: 'reassign',
      case_id: caseId,
      agent_id: agentId
    }
  };
  
  // Enviar reasignación al webhook de casos
  const response = await callCaseWebhook(payload);
  
  // Verificar respuesta exitosa
  if (response && typeof response === 'object' && response.success === false) {
    const errorMsg = typeof response.error === 'string' ? response.error : 'Error al reasignar el caso';
    throw new Error(errorMsg);
  }
  
  // Si el webhook no retornó error, la reasignación fue exitosa
  // El frontend se encargará de recargar el caso para mostrar los cambios
  return;
};

/**
 * Elimina un caso
 */
export const deleteCase = async (caseId: string): Promise<boolean> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!caseId) {
    throw new Error('ID de caso requerido.');
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.delete',
    actor,
    data: {
      case_id: caseId
    }
  };
  
  const response = await callCaseWebhook(payload);
  
  return response.success !== false && !response.error;
};

/**
 * Actualiza los datos del caso (cliente, asunto, descripción, etc.)
 * Según documentación: action: "case.edit" con cliente_id, cliente_nombre, email_cliente, telefono_cliente, asunto, descripcion
 */
export const updateCaseData = async (
  caseId: string,
  updates: {
    cliente_id?: string;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    asunto?: string;
    descripcion?: string;
    [key: string]: any;
  }
): Promise<Case | null> => {
  const actor = getActor();
  if (!actor) {
    throw new Error('Usuario no autenticado');
  }

  // Obtener el caso actual para usar sus valores como base si no se proporcionan en updates
  const currentCase = await getCaseById(caseId);
  
  // Mapear los campos según la documentación de case.edit
  // Usar valores de updates si están presentes, sino usar valores del caso actual
  // Asegurar que todos los campos sean strings (incluso si están vacíos, enviar "")
  // IMPORTANTE: Si un campo no está en updates, usar el valor del caso actual
  // Obtener el nombre del cliente desde diferentes fuentes posibles
  const currentClientName = currentCase?.clientName || currentCase?.cliente?.nombreEmpresa || '';
  const currentClientEmail = currentCase?.clientEmail || currentCase?.cliente?.email || '';
  const currentClientPhone = currentCase?.clientPhone || currentCase?.cliente?.telefono || '';
  
  const payload: CaseWebhookPayload = {
    action: 'case.edit',
    actor,
    data: {
      case_id: caseId,
      asunto: (updates.asunto !== undefined ? updates.asunto : (currentCase?.subject || '')) || '',
      descripcion: (updates.descripcion !== undefined ? updates.descripcion : (currentCase?.description || '')) || '',
      cliente_id: (updates.cliente_id !== undefined ? updates.cliente_id : (currentCase?.clientId || '')) || '',
      // Para cliente_nombre: si está en updates, usar ese valor; si no, usar el del caso actual
      cliente_nombre: updates.client_name !== undefined 
        ? (updates.client_name || '') 
        : (currentClientName || ''),
      email_cliente: (updates.client_email !== undefined ? String(updates.client_email || '') : String(currentClientEmail || '')) || '',
      telefono_cliente: (updates.client_phone !== undefined ? String(updates.client_phone || '') : String(currentClientPhone || '')) || ''
    }
  };

  const response = await callCaseWebhook(payload);
  
  // Verificar si el webhook retornó un error explícito
  if (response && typeof response === 'object') {
    if (response.success === false || response.error === true) {
      const errorMsg = response.message || 'Error al actualizar el caso';
      throw new Error(errorMsg);
    }
  }

  // Si el webhook fue exitoso, intentar obtener el caso actualizado
  // Pero no lanzar error si no se puede obtener inmediatamente
  // El frontend se encargará de recargar el caso
  try {
    const updatedCase = await getCaseById(caseId);
    return updatedCase;
  } catch (error) {
    // Si no se puede obtener el caso actualizado, no es crítico
    // El webhook ya procesó el cambio, el frontend recargará el caso
    console.warn('No se pudo obtener el caso actualizado inmediatamente, pero el webhook procesó el cambio:', error);
    return null; // Retornar null en lugar de lanzar error
  }
};