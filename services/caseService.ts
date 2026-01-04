import { API_CONFIG } from '../config';
import { Case, CaseStatus, Channel } from '../types';
import { calculateBusinessDaysElapsed, calculateSLADelayDays } from '../utils/slaUtils';

// URL del webhook de n8n para gestión de casos
// En desarrollo usa ruta relativa que pasa por el proxy de Vite (/api/casos)
// En producción puede usar URL completa si se configura en variables de entorno
const WEBHOOK_CASOS_URL = API_CONFIG.WEBHOOK_CASOS_URL || '/api/casos';

// Tipos para las acciones del webhook
type CaseAction = 'case.create' | 'case.update' | 'case.read' | 'case.delete' | 'case.query';

interface Actor {
  user_id: string;
  email: string;
}

interface ClienteData {
  cliente_id: string;
  email: string;
  telefono?: string;
}

interface CategoriaData {
  categoria_id: string;
}

interface CaseWebhookPayload {
  action: CaseAction;
  actor: Actor;
  data: {
    case_id?: string;
    canal_origen?: string;
    canal_notificacion?: string;
    asunto?: string;
    descripcion?: string;
    cliente?: ClienteData;
    categoria?: CategoriaData;
    estado?: string;
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
    
    return {
      user_id: user.id || 'unknown',
      email: email
    };
  } catch (error) {
    console.error('Error obteniendo actor:', error);
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
    console.error('Error obteniendo rol del usuario:', error);
    return null;
  }
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
  
  if (caseData.contactChannel || caseData.origin) {
    data.canal_origen = mapChannel(caseData.contactChannel || caseData.origin);
  }
  
  if (caseData.subject || caseData.asunto) {
    data.asunto = caseData.subject || caseData.asunto;
  }
  
  if (caseData.description || caseData.descripcion) {
    data.descripcion = caseData.description || caseData.descripcion;
  }
  
  if (caseData.clienteId || caseData.clientId) {
    data.cliente = {
      cliente_id: caseData.clienteId || caseData.clientId,
      email: caseData.clientEmail || caseData.email || '',
      telefono: caseData.phone || caseData.telefono || caseData.clientPhone || ''
    };
  }
  
  if (caseData.categoriaId || caseData.categoryId) {
    data.categoria = {
      categoria_id: caseData.categoriaId || caseData.categoryId
    };
  }
  
  if (caseData.status || caseData.estado) {
    data.estado = caseData.status || caseData.estado;
  }
  
  if (caseData.canal_notificacion || caseData.notificationChannel) {
    data.canal_notificacion = mapChannel(caseData.notificationChannel || caseData.canal_notificacion);
  }
  
  // El Round Robin se maneja en n8n, no enviamos información de agente
  
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
    console.warn('⚠️ mapWebhookResponseToCase: webhookData es null o undefined');
    return null;
  }
  
  // Si el objeto tiene una propiedad "data" que es un array, es un contenedor, no un caso
  if (webhookData.data && Array.isArray(webhookData.data)) {
    console.warn('⚠️ mapWebhookResponseToCase: Se recibió un contenedor con data array, no un caso individual');
    return null;
  }
  
  try {
    // El webhook puede retornar el caso en diferentes formatos
    // Intentamos normalizar a la estructura Case
    const caseData = webhookData.case || webhookData;
    
    // Validar que al menos tenga un ID
    const caseId = caseData.case_id || caseData.id || caseData.ticketNumber || caseData.idCaso || '';
    if (!caseId) {
      console.warn('⚠️ Caso sin ID, omitiendo:', caseData);
      return null;
    }
    
    console.log('🔍 Caso raw del webhook:', {
      caseId,
      cliente_id: caseData.cliente_id,
      clientId: caseData.clientId,
      agente_id: caseData.agente_id,
      agentId: caseData.agentId,
      agente_nombre: caseData.agente_nombre,
      agentName: caseData.agentName,
      tieneObjetoCliente: !!caseData.cliente,
      tieneObjetoAgente: !!caseData.agente
    });
    
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
    
    console.log('🔍 Cliente raw del webhook:', {
      caseId,
      cliente,
      tieneCliente: !!cliente,
      campos: cliente ? Object.keys(cliente) : []
    });
    
    const clienteMapped = cliente ? {
      idCliente: cliente.cliente_id || cliente.idCliente || cliente.id || '',
      nombreEmpresa: cliente.nombre_empresa || cliente.nombreEmpresa || cliente.nombre || '',
      contactoPrincipal: cliente.contacto_principal || cliente.contactoPrincipal || cliente.contacto || '',
      email: cliente.email || '',
      telefono: cliente.telefono || cliente.phone || '',
      pais: cliente.pais || cliente.country || 'El Salvador',
      estado: cliente.estado || cliente.state || 'Activo'
    } : null;
    
    console.log('✅ Cliente mapeado:', clienteMapped);
    
    // Mapear agente con valores por defecto
    const agente = caseData.agente || caseData.agenteAsignado || caseData.agent || null;
    
    // Si no hay objeto agente pero hay agente_id y agente_name, crear objeto básico
    const agenteId = caseData.agente_id || caseData.agentId || '';
    const agenteName = caseData.agente_name || caseData.agente_nombre || caseData.agentName || '';
    
    console.log('🔍 Agente raw del webhook:', {
      caseId,
      agente,
      tieneAgente: !!agente,
      agenteId,
      agenteName,
      campos: agente ? Object.keys(agente) : []
    });
    
    const agenteMapped = agente ? {
      idAgente: agente.agente_id || agente.idAgente || agente.id || '',
      nombre: agente.nombre || agente.name || '',
      email: agente.email || '',
      estado: agente.estado || agente.state || 'Activo',
      ordenRoundRobin: agente.orden_round_robin || agente.ordenRoundRobin || 999,
      ultimoCasoAsignado: agente.ultimo_caso_asignado || agente.ultimoCasoAsignado || new Date().toISOString(),
      casosActivos: agente.casos_activos || agente.casosActivos || 0
    } : (agenteId && agenteName ? {
      idAgente: agenteId,
      nombre: agenteName,
      email: '',
      estado: 'Activo',
      ordenRoundRobin: 999,
      ultimoCasoAsignado: new Date().toISOString(),
      casosActivos: 0
    } : null);
    
    console.log('✅ Agente mapeado:', agenteMapped);
    
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
      console.warn('Error calculando días hábiles, usando valores del webhook:', error);
      diasAbierto = caseData.dias_abierto || caseData.diasAbierto || 0;
      slaExpired = caseData.sla_vencido || caseData.slaExpired || false;
    }
    
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
      agentId: agenteMapped?.idAgente || caseData.agente_user_id?.toString() || caseData.agente_id || caseData.agentId || '',
      agentName: agenteMapped?.nombre || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '',
      createdAt: createdAt,
      history: caseData.historial || caseData.history || [],
      clientEmail: clienteMapped?.email || caseData.email_cliente || caseData.clientEmail || '',
      clientPhone: clienteMapped?.telefono || caseData.telefono_cliente || caseData.telfono_cliente || caseData.clientPhone || '',
      agenteAsignado: agenteMapped as any,
      categoria: categoriaMapped as any,
      cliente: clienteMapped as any,
      diasAbierto: diasAbierto,
      slaExpired: slaExpired
    };
    
    return mappedCase;
  } catch (error) {
    console.error('❌ Error mapeando respuesta del webhook:', error);
    console.error('❌ Datos recibidos:', webhookData);
    return null;
  }
};

/**
 * Mapea un array de casos del webhook a un array de Case
 */
const mapWebhookResponseToCases = (webhookData: any): Case[] => {
  if (!webhookData) {
    console.warn('⚠️ mapWebhookResponseToCases: webhookData es null o undefined');
    return [];
  }
  
  console.log('🔵 mapWebhookResponseToCases recibió:', {
    tipo: typeof webhookData,
    esArray: Array.isArray(webhookData),
    tieneData: !!(webhookData.data && Array.isArray(webhookData.data)),
    claves: !Array.isArray(webhookData) ? Object.keys(webhookData) : 'N/A'
  });
  
  try {
    // Intentar extraer el array de casos
    let cases: any[] = [];
    
    if (Array.isArray(webhookData)) {
      // Si es un array directo
      console.log('✅ webhookData es un array directo');
      cases = webhookData;
    } else if (webhookData.cases && Array.isArray(webhookData.cases)) {
      // Si tiene propiedad "cases"
      console.log('✅ webhookData tiene propiedad "cases"');
      cases = webhookData.cases;
    } else if (webhookData.casos && Array.isArray(webhookData.casos)) {
      // Si tiene propiedad "casos"
      console.log('✅ webhookData tiene propiedad "casos"');
      cases = webhookData.casos;
    } else if (webhookData.data && Array.isArray(webhookData.data)) {
      // Si tiene propiedad "data" que es un array
      console.log('✅ webhookData tiene propiedad "data" como array');
      cases = webhookData.data;
    } else {
      console.warn('⚠️ No se pudo extraer array de casos de:', webhookData);
      console.warn('⚠️ Tipo:', typeof webhookData);
      console.warn('⚠️ Es array:', Array.isArray(webhookData));
      console.warn('⚠️ Claves disponibles:', Object.keys(webhookData));
      return [];
    }
    
    console.log(`📋 Mapeando ${cases.length} casos del webhook...`);
    if (cases.length > 0) {
      console.log('📋 Primer caso a mapear:', cases[0]);
    }
    
    const mappedCases = cases
      .map((caseData, index) => {
        console.log(`  📝 Mapeando caso ${index + 1}/${cases.length}:`, {
          case_id: caseData.case_id || caseData.id,
          tipo: typeof caseData,
          esArray: Array.isArray(caseData),
          claves: !Array.isArray(caseData) ? Object.keys(caseData) : 'N/A'
        });
        const mapped = mapWebhookResponseToCase(caseData);
        if (!mapped) {
          console.warn(`  ⚠️ No se pudo mapear el caso ${index + 1}:`, caseData);
        }
        return mapped;
      })
      .filter((c): c is Case => c !== null);
    
    console.log(`✅ ${mappedCases.length} casos mapeados exitosamente de ${cases.length} casos recibidos`);
    
    return mappedCases;
  } catch (error) {
    console.error('❌ Error mapeando array de casos del webhook:', error);
    console.error('❌ Datos recibidos:', webhookData);
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
    console.log('📤 Enviando petición al webhook de casos:', {
      url: WEBHOOK_CASOS_URL,
      action: payload.action,
      payload
    });
    
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
    try {
      const text = await response.text();
      if (text.trim() === '') {
        result = { success: true };
      } else {
        result = JSON.parse(text);
      }
    } catch (parseError) {
      if (response.ok) {
        console.log('Respuesta no-JSON recibida, considerando como éxito');
        result = { success: true };
      } else {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
    }
    
    console.log('📥 Respuesta del webhook de casos:', result);
    
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
  
  if (!caseData.clienteId || !caseData.categoriaId || !caseData.subject || !caseData.description) {
    throw new Error('Faltan campos requeridos: cliente, categoría, asunto y descripción son obligatorios.');
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.create',
    actor,
    data: mapCaseToWebhookData(caseData)
  };
  
  console.log('📤 ========== JSON ENVIADO AL WEBHOOK ==========');
  console.log(JSON.stringify(payload, null, 2));
  
  const response = await callCaseWebhook(payload);
  
  console.log('📥 ========== RESPUESTA COMPLETA DEL WEBHOOK ==========');
  console.log(JSON.stringify(response, null, 2));
  console.log('📥 Tipo de respuesta:', typeof response);
  console.log('📥 Es array?:', Array.isArray(response));
  console.log('📥 Tiene case?:', !!(response as any)?.case);
  console.log('📥 Tiene cases?:', !!(response as any)?.cases);
  console.log('📥 Tiene data?:', !!(response as any)?.data);
  
  // Si el webhook retorna un caso, mapearlo
  if (response.case) {
    console.log('📋 Caso retornado por webhook:', JSON.stringify(response.case, null, 2));
    console.log('🔍 Agente en el caso retornado:', {
      tieneAgente: !!(response.case as any).agente,
      agente: (response.case as any).agente,
      tieneAgenteAsignado: !!(response.case as any).agenteAsignado,
      agenteAsignado: (response.case as any).agenteAsignado,
      tieneAgentId: !!(response.case as any).agent_id,
      agentId: (response.case as any).agent_id,
      tieneAgentName: !!(response.case as any).agent_name,
      agentName: (response.case as any).agent_name
    });
    
    const mappedCase = mapWebhookResponseToCase(response.case);
    if (mappedCase) {
      console.log('✅ Caso mapeado:', {
        id: mappedCase.id,
        agentId: mappedCase.agentId,
        agentName: mappedCase.agentName,
        tieneAgenteAsignado: !!mappedCase.agenteAsignado,
        agenteAsignado: mappedCase.agenteAsignado
      });
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
 * Si el usuario es AGENTE, solo retorna los casos asignados a ese agente usando case.query
 * Si el usuario es SUPERVISOR o GERENTE, retorna todos los casos usando case.read
 */
export const getCases = async (): Promise<Case[]> => {
  const actor = getActor();
  const userRole = getUserRole();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  // Si es AGENTE, usar case.query para obtener solo sus casos asignados
  if (userRole === 'AGENTE') {
    const payload: CaseWebhookPayload = {
      action: 'case.query',
      actor,
      data: {
        user_id: actor.user_id
      }
    };
    
    console.log('🔍 [AGENTE] Consultando casos asignados al usuario:', actor.user_id);
    console.log('📤 JSON completo enviado al webhook (case.query):', JSON.stringify(payload, null, 2));
    const response = await callCaseWebhook(payload);
    
    console.log('📥 Respuesta completa del webhook getCases (case.query):', JSON.stringify(response, null, 2));
    
    // Procesar la respuesta de la misma manera que case.read
    return processWebhookResponse(response);
  }
  
  // Si es SUPERVISOR o GERENTE, usar case.read para obtener todos los casos
  const payload: CaseWebhookPayload = {
    action: 'case.read',
    actor,
    data: {}
  };
  
  console.log('📋 [SUPERVISOR/GERENTE] Consultando todos los casos');
  const response = await callCaseWebhook(payload);
  
  console.log('📥 Respuesta completa del webhook getCases (case.read):', JSON.stringify(response, null, 2));
  
  return processWebhookResponse(response);
};

/**
 * Procesa la respuesta del webhook y retorna un array de casos mapeados
 */
const processWebhookResponse = (response: CaseWebhookResponse): Case[] => {
  
  // Intentar diferentes formatos de respuesta
  // Formato 1: Array directo o array que contiene objetos con data
  if (Array.isArray(response)) {
    console.log(`✅ Respuesta es un array con ${response.length} elementos`);
    
    // Si el array contiene objetos con propiedad "data" que es un array, extraerlos
    const allCases: any[] = [];
    for (const item of response) {
      if (item && typeof item === 'object') {
        if (item.data && Array.isArray(item.data)) {
          console.log(`✅ Elemento del array tiene propiedad "data" con ${item.data.length} casos, extrayendo...`);
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
      console.log(`✅ Extraídos ${allCases.length} casos del array, mapeando...`);
      return mapWebhookResponseToCases(allCases);
    } else {
      // Si no se pudo extraer, intentar mapear el array directamente
      console.log('⚠️ No se pudo extraer casos del array, intentando mapear directamente...');
      return mapWebhookResponseToCases(response);
    }
  }
  
  // Formato 2: { cases: [...] } o { casos: [...] }
  if (response.cases && Array.isArray(response.cases)) {
    console.log(`✅ Respuesta tiene propiedad "cases" con ${response.cases.length} casos, mapeando casos...`);
    return mapWebhookResponseToCases(response.cases);
  }
  
  if (response.casos && Array.isArray(response.casos)) {
    console.log(`✅ Respuesta tiene propiedad "casos" con ${response.casos.length} casos, mapeando casos...`);
    return mapWebhookResponseToCases(response.casos);
  }
  
  // Formato 3: { data: [...] } - ESTE ES EL FORMATO QUE ESTÁ RETORNANDO EL WEBHOOK
  if (response.data) {
    if (Array.isArray(response.data)) {
      console.log(`✅ Respuesta tiene propiedad "data" como array con ${response.data.length} casos, mapeando casos...`);
      console.log('📋 Primer caso del array:', response.data[0]);
      const mapped = mapWebhookResponseToCases(response.data);
      console.log(`✅ Mapeados ${mapped.length} casos desde response.data`);
      return mapped;
    }
    if (response.data.cases && Array.isArray(response.data.cases)) {
      console.log('✅ Respuesta tiene "data.cases", mapeando casos...');
      return mapWebhookResponseToCases(response.data.cases);
    }
    if (response.data.casos && Array.isArray(response.data.casos)) {
      console.log('✅ Respuesta tiene "data.casos", mapeando casos...');
      return mapWebhookResponseToCases(response.data.casos);
    }
  }
  
  // Formato 4: Un solo caso { case: {...} }
  if (response.case) {
    console.log('✅ Respuesta tiene un solo caso, convirtiendo a array...');
    const mappedCase = mapWebhookResponseToCase(response.case);
    return mappedCase ? [mappedCase] : [];
  }
  
  // Si no se reconoce el formato, loguear y retornar vacío
  console.warn('⚠️ No se pudo identificar el formato de la respuesta del webhook:', response);
  console.warn('⚠️ Estructura recibida:', Object.keys(response || {}));
  
  return [];
};

/**
 * Obtiene un caso por ID
 */
export const getCaseById = async (caseId: string): Promise<Case | null> => {
  const actor = getActor();
  
  if (!actor) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }
  
  if (!caseId) {
    throw new Error('ID de caso requerido.');
  }
  
  const payload: CaseWebhookPayload = {
    action: 'case.read',
    actor,
    data: {
      case_id: caseId
    }
  };
  
  const response = await callCaseWebhook(payload);
  
  // Mapear la respuesta a un Case
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
 * Actualiza el estado de un caso
 */
export const updateCaseStatus = async (
  caseId: string,
  newStatus: string,
  detail?: string
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
      case_id: caseId,
      patch: {
        estado: newStatus,
        descripcion: detail || `Cambio de estado a ${newStatus}`
      }
    }
  };
  
  console.log('📤 Payload enviado a updateCaseStatus:', JSON.stringify(payload, null, 2));
  
  const response = await callCaseWebhook(payload);
  
  console.log('📥 Respuesta completa del webhook updateCaseStatus:', JSON.stringify(response, null, 2));
  console.log('📥 Tipo de respuesta:', typeof response);
  console.log('📥 Es array?:', Array.isArray(response));
  console.log('📥 Tiene data?:', !!(response as any)?.data);
  console.log('📥 Data es array?:', Array.isArray((response as any)?.data));
  
  // Si retorna un objeto con data que es un array (formato más común cuando n8n retorna todos los casos)
  if (response.data && Array.isArray(response.data)) {
    console.log(`✅ Respuesta tiene data array con ${response.data.length} casos, buscando caso ${caseId}...`);
    // Mapear todos los casos del array
    const cases = mapWebhookResponseToCases(response.data);
    console.log(`✅ ${cases.length} casos mapeados, buscando caso con ID: ${caseId}`);
    // Buscar el caso por ID (puede venir como "CASO-0002" o como número)
    const foundCase = cases.find(c => {
      const cId = (c.id || c.ticketNumber || '').toString();
      const searchId = caseId.toString();
      // Comparar diferentes formatos de ID
      return cId === searchId || 
             cId === caseId || 
             c.ticketNumber === caseId ||
             c.id === caseId ||
             cId.replace(/^CASO-?/, '') === searchId.replace(/^CASO-?/, '');
    });
    if (foundCase) {
      console.log('✅ Caso encontrado en el array:', foundCase.id);
      return foundCase;
    } else {
      console.warn(`⚠️ Caso ${caseId} no encontrado en el array. IDs disponibles:`, cases.map(c => c.id || c.ticketNumber));
    }
  }
  
  // Si el webhook retorna el caso actualizado directamente
  if (response.case && !Array.isArray(response.case)) {
    const mappedCase = mapWebhookResponseToCase(response.case);
    if (mappedCase) {
      return mappedCase;
    }
  }
  
  // Si retorna un array directamente
  if (Array.isArray(response)) {
    console.log(`✅ Respuesta es un array con ${response.length} elementos`);
    // Si el array contiene objetos con "data", extraer los casos
    const allCases: any[] = [];
    for (const item of response) {
      if (item && typeof item === 'object') {
        if (item.data && Array.isArray(item.data)) {
          allCases.push(...item.data);
        } else if (Array.isArray(item)) {
          allCases.push(...item);
        } else {
          allCases.push(item);
        }
      }
    }
    if (allCases.length > 0) {
      const cases = mapWebhookResponseToCases(allCases);
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
  
  // Si retorna cases o casos como array
  if (response.cases || response.casos) {
    const casesArray = response.cases || response.casos;
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
  
  console.log('⚠️ No se encontró el caso actualizado en la respuesta, usando fallback getCaseById');
  // Fallback: obtener el caso actualizado
  return await getCaseById(caseId) || ({} as Case);
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

