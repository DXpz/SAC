import { API_CONFIG } from '../config';
import { Case, CaseStatus, Channel, HistorialEntry, CaseTransition } from '../types';
import { calculateBusinessDaysElapsed, calculateSLADelayDays } from '../utils/slaUtils';
import { api } from './api';

// URL del backend directo para gestión de casos
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
  pais?: string;
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

// Caché de agentes para resolver nombres de agentes por ID
interface AgenteInfo {
  id: string; // ID numérico que viene de agentes table (id колонка)
  id_agente: string;
  nombre: string;
  email: string;
  estado: string;
}

let agentesCache: AgenteInfo[] | null = null;
let agentesCacheTime: number = 0;
const AGENTES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la lista de agentes desde el backend directo
 */
const getAgentesInfo = async (): Promise<AgenteInfo[]> => {
  const now = Date.now();
  if (agentesCache && (now - agentesCacheTime) < AGENTES_CACHE_DURATION) {
    return agentesCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(API_CONFIG.WEBHOOK_AGENTES_URL, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return agentesCache || [];
    }

    const result = await response.json();
    let agents: any[] = Array.isArray(result) ? result : result.agentes || result.data || [];

    agentesCache = agents
      .filter(a => a.estado === 'ACTIVO' || a.estado === 'Activo')
      .map(a => ({
        id: a.id_agente || a.idAgente || a.id || '',
        id_agente: a.id_agente || a.idAgente || a.id || '',
        nombre: a.nombre || a.name || '',
        email: a.email || '',
        estado: a.estado || a.state || 'ACTIVO'
      }))
      .filter(a => a.nombre);

    agentesCacheTime = now;
    return agentesCache || [];
  } catch {
    return agentesCache || [];
  }
};

/**
 * Busca el nombre de un agente por su ID (agente_user_id de casos)
 * El agente_user_id corresponde a la columna 'id' en la tabla agentes
 * Si no encuentra el nombre, retorna "Agente #ID"
 */
const getAgenteNombreByUserId = (agenteUserId: string, agentesList?: AgenteInfo[]): string => {
  if (!agenteUserId) return '';

  const agentes = agentesList || agentesCache || [];
  // Buscar por 'id' que es el ID numérico de la tabla agentes
  const agente = agentes.find(a => String(a.id) === String(agenteUserId));
  if (agente?.nombre) {
    return agente.nombre;
  }
  // Fallback: mostrar "Agente #ID" si no se encontró el nombre
  return `Agente #${agenteUserId}`;
};

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
export const getUserCountry = async (): Promise<'SV' | 'GT' | null> => {
  try {
    // Primero intentar desde api.getUser() que puede tener datos más actualizados
    const currentUser = api.getUser();
    let pais = currentUser?.pais || '';
    
    // Si el país es string vacío, tratarlo como undefined
    if (pais && String(pais).trim() !== '') {
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
        return 'SV';
      }
      if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
        return 'GT';
      }
    }
    
    // Fallback: leer desde localStorage directamente
    const userStr = localStorage.getItem('intelfon_user');
    if (!userStr) {
      return null;
    }
    
    const user = JSON.parse(userStr);
    pais = user.pais || user.country || '';
    
    // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
    if (!pais || String(pais).trim() === '') {
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
          if (pais && String(pais).trim() !== '') {
            const updatedUser = { ...user, pais: pais };
            localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
          }
        }
      } catch (error) {
      }
    }
    
    // Validar que el país no sea string vacío - si no se encuentra, default a 'SV' para admins
    if (!pais || String(pais).trim() === '') {
      return 'SV';
    }
    
    // Normalizar a códigos de 2 letras
    const paisNormalizado = String(pais).trim().toUpperCase();
    
    // El Salvador: SV, El_Salvador, El Salvador, etc.
    if (paisNormalizado === 'SV' || 
        paisNormalizado === 'EL_SALVADOR' || 
        paisNormalizado === 'EL SALVADOR' ||
        paisNormalizado.includes('SALVADOR')) {
      return 'SV';
    }
    if (paisNormalizado === 'GT' || 
        paisNormalizado === 'GUATEMALA' ||
        paisNormalizado.includes('GUATEMALA')) {
      return 'GT';
    }
    return 'SV'; // Default a SV si no matchea GT
  } catch (error) {
    return 'SV'; // Default a SV en caso de error
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
    const caseData = webhookData.case || webhookData.caso || webhookData;
    
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
    
    const categoriaId = caseData.categoria_id || caseData.categoriaId || null;
    const categoria = caseData.categoria || caseData.category || null;
    const valorSlaHours = categoria?.valor_sla || 24;
    const categoriaMapped = categoria ? {
      idCategoria: categoria.categoria_id || categoria.idCategoria || categoria.id || categoriaId || '',
      nombre: categoria.nombre || categoria.name || 'General',
      slaDias: Math.ceil(valorSlaHours / 24),
      valorSla: valorSlaHours,
      activa: categoria.activa !== undefined ? categoria.activa : true
    } : {
      idCategoria: categoriaId?.toString() || '',
      nombre: 'General',
      slaDias: 1,
      valorSla: 24,
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
    let agenteName = caseData.agentename || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '';
    // Si no hay nombre directo, buscar en cache de agentes usando agente_user_id
    if (!agenteName && agenteId && agentesCache) {
      agenteName = getAgenteNombreByUserId(agenteId, agentesCache);
    }
    
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
    
    
    const createdAtStr = caseData.fecha_creacion || caseData.createdAt || caseData.fechaCreacion;
    const createdAt = parseDate(createdAtStr);
    const slaDays = categoriaMapped.slaDias;
    let diasAbierto = caseData.diasAbierto;
    let slaExpired = caseData.slaExpired;

    if (diasAbierto === undefined || diasAbierto === null) {
      try {
        diasAbierto = calculateBusinessDaysElapsed(new Date(createdAt));
      } catch (error) {
        diasAbierto = caseData.dias_abierto || 0;
      }
    }

    if (slaExpired === undefined || slaExpired === null) {
      try {
        const delayDays = calculateSLADelayDays(new Date(createdAt), slaDays);
        slaExpired = delayDays > 0;
      } catch (error) {
        slaExpired = caseData.sla_vencido || caseData.slaExpired || false;
      }
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
      agentId: agenteUserIdFromWebhook
        ? String(agenteUserIdFromWebhook)
        : (agenteMapped?.idAgente || String(caseData.agente_id || caseData.agentId || '')),
      agentName: agenteMapped?.nombre || agenteName || getAgenteNombreByUserId(agenteUserIdFromWebhook, agentesCache || undefined),
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
        'ngrok-skip-browser-warning': 'true',
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
    
    // Leer cuerpo y parsear JSON de forma robusta
    const responseText = await response.text();
    let result: CaseWebhookResponse;

    if (responseText.trim() === '') {
      result = { success: true };
    } else {
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('La respuesta del servidor no es JSON válido. Verifica que el webhook retorne JSON.');
      }
    }

    // VERIFICACIÓN TEMPRANA: Detectar valid: false
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const validEarly = (result as any).valid;
      if (validEarly === 'false' || validEarly === false || (typeof validEarly === 'string' && validEarly.toLowerCase().trim() === 'false')) {
        // Se maneja después según el flujo
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
      throw new Error('Error de CORS: El servidor backend necesita permitir peticiones desde este dominio. Contacta al administrador.');
    }
    
    if (error.message) {
      throw error;
    }
    
    throw new Error('Error de conexión con el servidor.');
  }
};

/**
 * Crea un nuevo caso según la documentación del API
 */
export const createCase = async (caseData: {
  clienteId: string;
  categoriaId: string;
  contactChannel: Channel | string;
  subject: string;
  description: string;
  clientEmail?: string;
  pais?: string;
  phone?: string;
  clientPhone?: string;
  [key: string]: any;
}): Promise<Case> => {
  const actor = getActor();

  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  // Validar campos requeridos
  if (!caseData.categoriaId || !caseData.subject || !caseData.description) {
    throw new Error('Faltan campos requeridos: categoría, asunto y descripción son obligatorios.');
  }

  // Obtener país del usuario o usar default
  const userCountry = await getUserCountry();
  const paisMap: Record<string, string> = {
    'SV': 'ElSalvador',
    'GT': 'Guatemala',
    'El Salvador': 'ElSalvador',
    'Guatemala': 'Guatemala'
  };
  const rawPais = caseData.pais || caseData.country || (userCountry === 'SV' ? 'ElSalvador' : 'Guatemala');
  const pais = paisMap[rawPais] || rawPais;

  // Enviar al backend con el formato que espera
  const payload = {
    pais: pais,
    cliente: {
      cliente_id: caseData.clienteId || 'N/A',
      email: caseData.clientEmail || '',
      telefono: caseData.clientPhone || caseData.phone || ''
    },
    categoria: {
      id: parseInt(caseData.categoriaId) || 1
    },
    canal_origen: mapChannel(caseData.contactChannel),
    canal_notificacion: mapChannel(caseData.contactChannel) || 'Email',
    asunto: caseData.subject,
    descripcion: caseData.description,
    actor: {
      email: actor.email
    }
  };

  const response = await fetch(API_CONFIG.WEBHOOK_CASOS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al crear caso');
  }

  const result = await response.json();
  
  // Mapear respuesta del backend
  if (result && result.caso && result.caso.case_id) {
    return mapWebhookResponseToCase(result.caso);
  }
  if (result && result.case_id) {
    return mapWebhookResponseToCase(result);
  }

  return result as Case;
};

/**
 * Obtiene todos los casos
 * El backend tiene GET /api/casos que lista casos
 * Incluye agentes, categorías y clientes relacionados
 */
export const getCases = async (): Promise<Case[]> => {
  const actor = getActor();
  const userRole = getUserRole();

  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  await getAgentesInfo();

  const pais = await getUserCountry();
  const paisValue = pais === 'GT' ? 'Guatemala' : 'El Salvador';

  // Si es AGENTE, obtener solo sus casos asignados
  if (userRole === 'AGENTE') {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/agente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        agente_id: actor.email,
        pais: paisValue
      })
    });

    if (!response.ok) {
      throw new Error('Error al obtener casos');
    }

    const result = await response.json();
    return mapWebhookResponseToCases(result);
  }

  // Si es SUPERVISOR o GERENTE, obtener todos los casos del país
  const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}?pais=${encodeURIComponent(paisValue)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
  });

  if (!response.ok) {
    throw new Error('Error al obtener casos');
  }

  const result = await response.json();

  // El backend retorna { casos: [...], transiciones: [...] }
  // Extraer solo el array de casos
  const casos = result.casos || result.cases || result;

  return mapWebhookResponseToCases(casos);
};

/**
 * Procesa la respuesta del webhook y retorna un array de casos mapeados
 */
const processWebhookResponse = (response: CaseWebhookResponse): Case[] => {
  if (Array.isArray(response)) {
    // Si el array contiene objetos con propiedad "data" que es un array, extraerlos
    const allCases: any[] = [];
    for (const item of response) {
      if (item && typeof item === 'object') {
        // V4 FORMAT: { casos: [...], transiciones: [...] }
        if (item.casos && Array.isArray(item.casos)) {
          allCases.push(...item.casos);
        }
        // Si el item tiene case_id o id, es un caso directo
        else if (item.case_id || item.id || item.ticketNumber) {
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
    if (allCases.length > 0) {
      return mapWebhookResponseToCases(allCases);
    }
    return mapWebhookResponseToCases(response);
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

  // Formato 5: Objeto con datos anidados (ej. { body: { data: [...] } }, { result: { cases: [...] } })
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const nested = (response as any).body || (response as any).result || (response as any).output;
    if (nested && typeof nested === 'object') {
      const arr = nested.data ?? nested.cases ?? nested.casos ?? (Array.isArray(nested) ? nested : null);
      if (Array.isArray(arr) && arr.length > 0) {
        return mapWebhookResponseToCases(arr);
      }
    }
    // Buscar cualquier propiedad que sea un array de objetos tipo caso
    for (const key of Object.keys(response)) {
      const val = (response as any)[key];
      if (Array.isArray(val) && val.length > 0) {
        const first = val[0];
        if (first && typeof first === 'object' && (first.case_id != null || first.id != null || first.ticketNumber != null)) {
          return mapWebhookResponseToCases(val);
        }
      }
    }
  }

  return [];
};

/**
 * Obtiene un caso por ID
 * El backend tiene GET /api/casos/:id que retorna el caso con historial y transiciones
 */
export const getCaseById = async (caseId: string): Promise<Case | null> => {
  const actor = getActor();

  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  if (!caseId) {
    throw new Error('ID de caso requerido.');
  }

  await getAgentesInfo();

  const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/${caseId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
  });

  if (!response.ok) {
    throw new Error('Error al obtener caso');
  }

  const result = await response.json();

  if (!result || typeof result !== 'object') {
    return null;
  }

  // El backend retorna { ...caso, historial, transiciones }
  // Mapear el caso con su historial y transiciones
  const casoMapeado = mapWebhookResponseToCase(result);

  if (casoMapeado) {
    // Incluir historial y transiciones del backend
    if (result.historial && Array.isArray(result.historial)) {
      casoMapeado.historial = mapWebhookHistorialToFrontend(result.historial);
      casoMapeado.history = casoMapeado.historial;
    }
    if (result.transiciones && Array.isArray(result.transiciones)) {
      (casoMapeado as any).transiciones = result.transiciones;
    }
  }

  return casoMapeado;
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

/**
 * Actualiza el estado de un caso
 * El backend tiene PUT /api/casos/:id que acepta { data: { estado, comentario }, actor }
 */
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

  const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/${caseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({
      data: {
        estado: newStatus,
        comentario: detail || `Cambio de estado a ${newStatus}`
      },
      actor: {
        email: actor.email
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al actualizar estado');
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.message || 'Error al actualizar el caso');
  }

  return mapWebhookResponseToCase(result) as Case;
};

/**
 * Reasigna un caso a otro agente (manual)
 * El backend tiene PUT /api/casos/:id con update_type = 'reassign'
 */
export const reassignCase = async (
  caseId: string,
  agentId: string,
  motivo?: string
): Promise<{ success: boolean; message: string }> => {
  const actor = getActor();

  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  if (!caseId || !agentId) {
    throw new Error('ID de caso y ID de agente son requeridos.');
  }

  try {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/${caseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        data: {
          update_type: 'reassign',
          agent_id: agentId,
          comentario: motivo || `Reasignación manual de caso`
        },
        actor: {
          email: actor.email
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.message || 'Error al reasignar' };
    }

    const result = await response.json();

    if (result.error || result.success === false) {
      return { success: false, message: result.message || 'Error al reasignar' };
    }

    agentesCache = null;
    agentesCacheTime = 0;

    return { success: true, message: 'Caso reasignado correctamente' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al reasignar' };
  }
};

/**
 * Elimina un caso
 * El backend tiene DELETE /api/casos/:id
 */
export const deleteCase = async (caseId: string): Promise<boolean> => {
  const actor = getActor();

  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  if (!caseId) {
    throw new Error('ID de caso requerido.');
  }

  const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/${caseId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
  });

  if (!response.ok) {
    return false;
  }

  return true;
};

/**
 * Actualiza los datos del caso (cliente, asunto, descripción, etc.)
 * Según documentación: action: "case.edit" con cliente_id, cliente_nombre, email_cliente, telefono_cliente, asunto, descripcion
 */
/**
 * Respuesta del webhook de cierre de caso
 */
interface CaseCloseWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Envía el webhook de cierre de caso con anexos
 * Webhook específico para cerrar casos con el formato requerido
 * Retorna un objeto con success y message para manejar errores
 */
export const sendCaseCloseWebhook = async (
  caseId: string,
  clienteId: string,
  anexos: string,
  parametros?: Record<string, any>
): Promise<CaseCloseWebhookResponse> => {
  try {
    const userStr = localStorage.getItem('intelfon_user');
    if (!userStr) {
      return { success: false, message: 'Usuario no autenticado' };
    }

    const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/close`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({
        case_id: caseId,
        cliente_id: clienteId,
        anexos: anexos,
        ...(parametros && Object.keys(parametros).length > 0 ? { parametros } : {})
      })
    });

    const responseText = await response.text();

    let parsed: any = null;
    let messageFromBody: string | null = null;
    if (responseText && !responseText.includes('<!DOCTYPE') && !responseText.includes('<html')) {
      try {
        parsed = JSON.parse(responseText);
        if (parsed && typeof parsed === 'object' && typeof parsed.message === 'string') {
          messageFromBody = parsed.message;
        }
      } catch {
      }
    }

    if (!response.ok) {
      let errorMessage = 'Error al procesar la solicitud. Verifique los anexos e intente nuevamente.';
      if (messageFromBody) {
        errorMessage = messageFromBody;
      }
      return { success: false, message: errorMessage };
    }

    if (messageFromBody) {
      const lower = messageFromBody.toLowerCase();
      const isValidAnexos =
        lower.includes('todos los anexos corresponden') ||
        lower.includes('todos los anexos') && lower.includes('corresponden al cliente');

      if (!isValidAnexos) {
        return { success: false, message: messageFromBody };
      }
      return { success: true, message: messageFromBody };
    }

    return { success: true, message: 'Caso cerrado correctamente' };
  } catch (error) {
    return { success: false, message: 'Error de conexión con el servidor' };
  }
};

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

  // Obtener el caso actual para usar sus valores como base
  const currentCase = await getCaseById(caseId);

  const currentClientName = currentCase?.clientName || currentCase?.cliente?.nombreEmpresa || '';
  const currentClientEmail = currentCase?.clientEmail || currentCase?.cliente?.email || '';
  const currentClientPhone = currentCase?.clientPhone || currentCase?.cliente?.telefono || '';

  const response = await fetch(`${API_CONFIG.WEBHOOK_CASOS_URL}/${caseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify({
      case_id: caseId,
      asunto: (updates.asunto !== undefined ? updates.asunto : (currentCase?.subject || '')) || '',
      descripcion: (updates.descripcion !== undefined ? updates.descripcion : (currentCase?.description || '')) || '',
      cliente_id: (updates.cliente_id !== undefined ? updates.cliente_id : (currentCase?.clientId || '')) || '',
      cliente_nombre: updates.client_name !== undefined ? (updates.client_name || '') : (currentClientName || ''),
      email_cliente: (updates.client_email !== undefined ? String(updates.client_email || '') : String(currentClientEmail || '')) || '',
      telefono_cliente: (updates.client_phone !== undefined ? String(updates.client_phone || '') : String(currentClientPhone || '')) || ''
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al actualizar el caso');
  }

  const result = await response.json();

  if (result.error || result.success === false) {
    throw new Error(result.message || 'Error al actualizar el caso');
  }

  try {
    const updatedCase = await getCaseById(caseId);
    return updatedCase;
  } catch (error) {
    return null;
  }
};