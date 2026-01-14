import { API_CONFIG } from '../config';
import { Case, CaseStatus, Channel } from '../types';
import { calculateBusinessDaysElapsed, calculateSLADelayDays } from '../utils/slaUtils';

// URL del webhook de n8n para gestión de casos
// En desarrollo usa ruta relativa que pasa por el proxy de Vite (/api/casos)
// En producción puede usar URL completa si se configura en variables de entorno
const WEBHOOK_CASOS_URL = API_CONFIG.WEBHOOK_CASOS_URL || '/api/casos';

// Tipos para las acciones del webhook
type CaseAction = 'case.create' | 'case.update' | 'case.read' | 'case.delete' | 'case.query' | 'case.agent';

interface Actor {
  user_id: number;
  email: string;
  role: string;
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
      telefono: caseData.phone || caseData.telefono || caseData.clientPhone || caseData.cliente?.telefono || ''
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
    
    // Log detallado de todos los campos relacionados con agente
    const camposAgente = Object.keys(caseData).filter(k => 
      k.toLowerCase().includes('agent') || 
      k.toLowerCase().includes('agente') ||
      k.toLowerCase().includes('user')
    );
    
    console.log('🔍 Caso raw del webhook:', {
      caseId,
      cliente_id: caseData.cliente_id,
      clientId: caseData.clientId,
      agente_id: caseData.agente_id,
      agentId: caseData.agentId,
      agente_user_id: caseData.agente_user_id,
      agente_nombre: caseData.agente_nombre,
      agentName: caseData.agentName,
      agentename: caseData.agentename, // Campo específico de n8n round robin
      tieneObjetoCliente: !!caseData.cliente,
      tieneObjetoAgente: !!caseData.agente,
      todosLosCamposAgente: camposAgente.reduce((acc, key) => {
        acc[key] = caseData[key];
        return acc;
      }, {} as any)
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
    // El webhook puede enviar agentename (todo junto) desde n8n con round robin
    const agenteId = caseData.agente_user_id || caseData.agente_id || caseData.agentId || '';
    const agenteName = caseData.agentename || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '';
    
    console.log('🔍 Agente raw del webhook:', {
      caseId,
      agente,
      tieneAgente: !!agente,
      agenteId,
      agenteName,
      agentename: caseData.agentename, // Campo específico de n8n round robin
      campos: agente ? Object.keys(agente) : [],
      todosLosCampos: Object.keys(caseData).filter(k => k.toLowerCase().includes('agent'))
    });
    
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
      agentName: agenteMapped?.nombre || caseData.agentename || caseData.agente_name || caseData.agente_nombre || caseData.agentName || caseData.nombre_agente || '',
      createdAt: createdAt,
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
    let responseText = '';
    try {
      responseText = await response.text();
      console.log('📥 ========== RESPUESTA CRUDA DEL WEBHOOK ==========');
      console.log('📥 URL:', WEBHOOK_CASOS_URL);
      console.log('📥 Action:', payload.action);
      console.log('📥 Status:', response.status);
      console.log('📥 Status Text:', response.statusText);
      console.log('📥 Headers:', Object.fromEntries(response.headers.entries()));
      console.log('📥 Respuesta texto (primeros 2000 chars):', responseText.substring(0, 2000));
      console.log('📥 Respuesta texto (completa):', responseText);
      
      if (responseText.trim() === '') {
        result = { success: true };
      } else {
        result = JSON.parse(responseText);
      }
      
      console.log('📥 Respuesta parseada (tipo):', typeof result);
      console.log('📥 Respuesta parseada (es array?):', Array.isArray(result));
      console.log('📥 Respuesta parseada (JSON):', JSON.stringify(result, null, 2));
      console.log('📥 Respuesta parseada (objeto):', result);
      
      // VERIFICACIÓN TEMPRANA: Detectar valid: false INMEDIATAMENTE después de parsear
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        const validEarly = (result as any).valid;
        console.log('🔍 [TEMPRANO] Verificando valid inmediatamente después de parsear...');
        console.log('🔍 [TEMPRANO] Valor de valid:', validEarly);
        console.log('🔍 [TEMPRANO] Tipo de valid:', typeof validEarly);
        
        if (validEarly === "false" || validEarly === false || validEarly === "False" || validEarly === "FALSE" || 
            (typeof validEarly === 'string' && validEarly.toLowerCase().trim() === 'false')) {
          console.error('❌ [TEMPRANO] ⚠️⚠️⚠️ DETECTADO valid: false INMEDIATAMENTE DESPUÉS DE PARSEAR ⚠️⚠️⚠️');
          console.error('❌ [TEMPRANO] Esta respuesta será rechazada cuando se valide en updateCaseStatus');
        }
      }
      
      if (Array.isArray(result) && result.length > 0) {
        console.log('📥 Longitud del array:', result.length);
        console.log('📥 Primer elemento:', result[0]);
        if (result[0] && typeof result[0] === 'object') {
          console.log('📥 Claves del primer elemento:', Object.keys(result[0]));
          if ('historial_caso' in result[0]) {
            console.log('📥 historial_caso existe, tipo:', typeof result[0].historial_caso, 'es array?:', Array.isArray(result[0].historial_caso));
          }
          if ('detalle_caso' in result[0]) {
            console.log('📥 detalle_caso existe, tipo:', typeof result[0].detalle_caso, 'es array?:', Array.isArray(result[0].detalle_caso));
          }
        }
      }
      console.log('📥 ================================================');
    } catch (parseError) {
      console.error('❌ Error parseando respuesta del webhook:', parseError);
      console.error('❌ Texto que causó el error:', responseText);
      if (response.ok) {
        console.log('Respuesta no-JSON recibida, considerando como éxito');
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
      telefono: caseData.phone || caseData.clientPhone || ''
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
  
  console.log('📤 ========== JSON ENVIADO AL WEBHOOK (case.create) ==========');
  console.log('📤 Actor (usuario que crea el caso):', JSON.stringify(actor, null, 2));
  console.log('📤 Si el actor.role es "AGENTE", el webhook asignará el caso a ese agente automáticamente');
  console.log('5 Si el actor.role es "SUPERVISOR" o "GERENTE", el webhook hará Round Robin');
  console.log('📤 Payload completo:', JSON.stringify(payload, null, 2));
  
  const response = await callCaseWebhook(payload);
  
  console.log('📥 ========== RESPUESTA COMPLETA DEL WEBHOOK (createCase) ==========');
  console.log('📥 RESPUESTA RAW (objeto):');
  console.log(response);
  console.log('📥 RESPUESTA JSON (stringified):');
  console.log(JSON.stringify(response, null, 2));
  console.log('📥 ================================================');
  console.log('📥 ANÁLISIS DE LA ESTRUCTURA:');
  console.log('📥 - Tipo de respuesta:', typeof response);
  console.log('📥 - Es array?:', Array.isArray(response));
  console.log('📥 - Es null?:', response === null);
  console.log('📥 - Es undefined?:', response === undefined);
  console.log('📥 - Tiene case?:', !!(response as any)?.case);
  console.log('📥 - Tiene cases?:', !!(response as any)?.cases);
  console.log('📥 - Tiene data?:', !!(response as any)?.data);
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    console.log('📥 - Propiedades (keys):', Object.keys(response));
    console.log('📥 - Valores de cada propiedad:');
    Object.keys(response).forEach(key => {
      console.log(`📥   * ${key}:`, (response as any)[key]);
    });
  }
  console.log('📥 ================================================');
  
  // Si el webhook retorna un caso, mapearlo
  if (response.case) {
    console.log('📋 ========== CASO RETORNADO POR WEBHOOK ==========');
    console.log('📋 CASO RAW (objeto):');
    console.log(response.case);
    console.log('📋 CASO JSON (stringified):');
    console.log(JSON.stringify(response.case, null, 2));
    console.log('📋 ================================================');
    console.log('📋 DESGLOSE DE CAMPOS DEL CASO:');
    console.log('📋 - case_id:', (response.case as any).case_id);
    console.log('📋 - id:', (response.case as any).id);
    console.log('📋 - ticketNumber:', (response.case as any).ticketNumber);
    console.log('📋 CLIENTE:');
    console.log('📋 - cliente_id:', (response.case as any).cliente_id);
    console.log('📋 - clientId:', (response.case as any).clientId);
    console.log('📋 - cliente_nombre:', (response.case as any).cliente_nombre);
    console.log('📋 - clientName:', (response.case as any).clientName);
    console.log('📋 - Objeto cliente:', (response.case as any).cliente);
    console.log('📋 AGENTE:');
    console.log('📋 - agente_id:', (response.case as any).agente_id);
    console.log('📋 - agente_user_id:', (response.case as any).agente_user_id);
    console.log('📋 - agentId:', (response.case as any).agentId);
    console.log('📋 - agente_nombre:', (response.case as any).agente_nombre);
    console.log('📋 - agente_name:', (response.case as any).agente_name);
    console.log('📋 - agentename:', (response.case as any).agentename);
    console.log('📋 - agentName:', (response.case as any).agentName);
    console.log('📋 - Objeto agente:', (response.case as any).agente);
    console.log('📋 - Objeto agenteAsignado:', (response.case as any).agenteAsignado);
    console.log('📋 OTROS:');
    console.log('📋 - estado:', (response.case as any).estado);
    console.log('📋 - status:', (response.case as any).status);
    console.log('📋 - asunto:', (response.case as any).asunto);
    console.log('📋 - subject:', (response.case as any).subject);
    console.log('📋 - descripcion:', (response.case as any).descripcion);
    console.log('📋 - description:', (response.case as any).description);
    console.log('📋 - fecha_creacion:', (response.case as any).fecha_creacion);
    console.log('📋 - createdAt:', (response.case as any).createdAt);
    console.log('📋 ================================================');
    
    const mappedCase = mapWebhookResponseToCase(response.case);
    if (mappedCase) {
      console.log('✅ Caso mapeado:', {
        id: mappedCase.id,
        agentId: mappedCase.agentId,
        agentName: mappedCase.agentName,
        tieneAgenteAsignado: !!mappedCase.agenteAsignado,
        agenteAsignado: mappedCase.agenteAsignado
      });
      
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
        console.log('✅ Entrada de creación agregada al caso recién creado');
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
        user_id: actor.user_id
      }
    };
    
    console.log('🔍 [AGENTE] Consultando casos asignados al usuario usando case.agent:', actor.user_id);
    console.log('📤 JSON completo enviado al webhook (case.agent):', JSON.stringify(payload, null, 2));
    const response = await callCaseWebhook(payload);
    
    console.log('📥 Respuesta completa del webhook getCases (case.agent):', JSON.stringify(response, null, 2));
    
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
  
  console.log('🔄 [getCaseById] Consultando caso con case.query:', caseId);
  const response = await callCaseWebhook(payload);
  
  console.log('📥 [getCaseById] Respuesta recibida:', {
    tipo: typeof response,
    esArray: Array.isArray(response),
    tieneData: !!(response as any)?.data
  });
  
  // Procesar respuesta del case.query (que viene con historial_caso y detalle_caso)
  if (Array.isArray(response) && response.length > 0) {
    const firstItem = response[0];
    
    // Verificar si es el formato con historial_caso y detalle_caso
    if (firstItem && typeof firstItem === 'object' && 'historial_caso' in firstItem && 'detalle_caso' in firstItem) {
      console.log('✅ [getCaseById] Respuesta es formato con historial_caso y detalle_caso');
      
      const historialArray = Array.isArray(firstItem.historial_caso) ? firstItem.historial_caso : [];
      const detalleCasoArray = Array.isArray(firstItem.detalle_caso) ? firstItem.detalle_caso : [];
      const agenteArray = Array.isArray(firstItem.agente) ? firstItem.agente : [];
      
      console.log('✅ [getCaseById] Historial recibido:', historialArray.length, 'entradas');
      console.log('✅ [getCaseById] Detalle caso recibido:', detalleCasoArray.length, 'entradas');
      console.log('✅ [getCaseById] Agente recibido:', agenteArray.length, 'entradas');
      
      // Mapear el historial
      const historialMapeado = historialArray.length > 0 
        ? mapWebhookHistorialToFrontend(historialArray as WebhookHistorialEntry[])
        : [];
      
      // Mapear el caso desde detalle_caso y combinar con datos del agente
      if (detalleCasoArray.length > 0) {
        const casoData = detalleCasoArray[0];
        
        // Si hay información del agente en el array agente, combinarla con los datos del caso
        if (agenteArray.length > 0) {
          const agenteData = agenteArray[0];
          console.log('✅ [getCaseById] Combinando datos del agente con datos del caso:', agenteData);
          
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
          // Inicializar historial si no existe
          if (!casoActualizado.historial) {
            casoActualizado.historial = [];
          }
          if (!casoActualizado.history) {
            casoActualizado.history = [];
          }
          
          // Agregar el historial del webhook preservando la entrada de creación
          if (historialMapeado.length > 0) {
            // Verificar si hay una entrada de creación en el historial del webhook
            const tieneEntradaCreacion = historialMapeado.some(entry => entry.tipo_evento === 'CREADO');
            
            // Si no hay entrada de creación, agregarla al final (más antigua)
            if (!tieneEntradaCreacion && casoActualizado.createdAt) {
              const entradaCreacion: HistorialEntry = {
                tipo_evento: 'CREADO',
                justificacion: 'Caso creado',
                autor_nombre: 'Sistema',
                autor_rol: 'sistema',
                fecha: casoActualizado.createdAt
              };
              historialMapeado.push(entradaCreacion);
              console.log('✅ [getCaseById] Entrada de creación agregada al historial');
            }
            
            casoActualizado.historial = [...historialMapeado];
            casoActualizado.history = [...historialMapeado];
            console.log('✅ [getCaseById] Historial agregado al caso:', historialMapeado.length, 'entradas');
          } else {
            // Si no hay historial del webhook, crear entrada de creación
            if (casoActualizado.createdAt) {
              const entradaCreacion: HistorialEntry = {
                tipo_evento: 'CREADO',
                justificacion: 'Caso creado',
                autor_nombre: 'Sistema',
                autor_rol: 'sistema',
                fecha: casoActualizado.createdAt
              };
              casoActualizado.historial = [entradaCreacion];
              casoActualizado.history = [entradaCreacion];
              console.log('✅ [getCaseById] Historial inicializado con entrada de creación');
            } else {
              console.warn('⚠️ [getCaseById] No hay historial y no hay fecha de creación');
            }
          }
          
          return casoActualizado;
        }
      }
    }
  }
  
  // Fallback: intentar mapear como caso normal (sin historial)
  console.warn('⚠️ [getCaseById] No se encontró formato con historial_caso, intentando formato normal...');
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
    console.log('🕒 [mapWebhookHistorialToFrontend] Entrada de historial recibida desde webhook:', entry);

    let fechaISO: string;

    try {
      const rawFecha = entry.fechayhora || (entry as any).fecha || (entry as any).fecha_hora || '';
      console.log('🕒 [mapWebhookHistorialToFrontend] Valor bruto de fecha/hora recibido:', rawFecha);

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
          console.log('🕒 [mapWebhookHistorialToFrontend] Fecha interpretada como DMY:', fechaISO);
        } else {
          // Caso 2: Probar si el formato es directamente parseable por Date
          const parsed = new Date(rawFecha);
          if (!isNaN(parsed.getTime())) {
            fechaISO = parsed.toISOString();
            console.log('🕒 [mapWebhookHistorialToFrontend] Fecha parseada directamente por Date:', fechaISO);
          } else {
            console.warn('⚠️ [mapWebhookHistorialToFrontend] Formato de fecha no reconocido, usando fecha actual. Valor recibido:', rawFecha);
            fechaISO = new Date().toISOString();
          }
        }
      } else {
        console.warn('⚠️ [mapWebhookHistorialToFrontend] No se recibió fechayhora, usando fecha actual.');
        fechaISO = new Date().toISOString();
      }
    } catch (e) {
      console.error('❌ [mapWebhookHistorialToFrontend] Error al parsear la fecha del historial, usando fecha actual.', e);
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
      update_type: 'update',
      case_id: caseId,
      estado: newStatus,
      comentario: detail || `Cambio de estado a ${newStatus}`
    }
  };
  
  console.log('================== INICIO updateCaseStatus ==================');
  console.log('📤 [1] PAYLOAD ENVIADO AL WEBHOOK:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('📤 [1] Case ID:', caseId);
  console.log('📤 [1] Nuevo Estado:', newStatus);
  console.log('📤 [1] Comentario:', detail);
  
  // Enviar actualización de estado
  console.log('📤 [2] Llamando al webhook...');
  const response = await callCaseWebhook(payload);
  console.log('📥 [3] RESPUESTA RECIBIDA DEL WEBHOOK:');
  
  console.log('📥 [3] ========== RESPUESTA DEL WEBHOOK ==========');
  console.log('📥 [3] Tipo:', typeof response);
  console.log('📥 [3] Es Array?:', Array.isArray(response));
  console.log('📥 [3] Es null:', response === null);
  console.log('📥 [3] Es undefined:', response === undefined);
  
  if (response && typeof response === 'object') {
    console.log('📥 [3] Propiedades (keys):', Object.keys(response));
    console.log('📥 [3] Valores por propiedad:');
    for (const key of Object.keys(response)) {
      console.log(`📥 [3]   - ${key}:`, response[key]);
      console.log(`📥 [3]     Tipo de ${key}:`, typeof response[key]);
    }
  }
  
  console.log('📥 [3] Respuesta COMPLETA (JSON stringified):');
  console.log(JSON.stringify(response, null, 2));
  console.log('📥 [3] Respuesta COMPLETA (objeto raw):');
  console.log(response);
  console.log('📥 [3] ================================================');
  
  // ========== VALIDACIÓN INMEDIATA: Verificar si el webhook rechazó el comentario ==========
  // IMPORTANTE: Esta validación debe ser LO PRIMERO que se haga después de recibir la respuesta
  // El webhook puede retornar 200 OK pero con valid: "false" cuando rechaza
  // O puede retornar un array (historial) cuando acepta
  
  console.log('🔍 [4] ========== VALIDACIÓN INMEDIATA DEL WEBHOOK ==========');
  console.log('🔍 [4] Tipo de respuesta:', typeof response);
  console.log('🔍 [4] Es Array?:', Array.isArray(response));
  console.log('🔍 [4] Es objeto?:', response && typeof response === 'object' && !Array.isArray(response));
  
  // Verificar si el webhook rechazó el comentario (valid: "false" o valid: false)
  // El webhook puede retornar valid como string "false" o booleano false
  let validValue: any = undefined;
  
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    validValue = (response as any).valid;
    console.log('🔍 [4] Respuesta es objeto, buscando campo "valid"...');
    console.log('🔍 [4] ¿Tiene propiedad "valid"?:', 'valid' in response);
    console.log('🔍 [4] Valor de valid encontrado:', validValue);
    console.log('🔍 [4] Tipo de valid:', typeof validValue);
  } else if (Array.isArray(response)) {
    console.log('🔍 [4] Respuesta es array, NO tiene campo "valid" (es exitosa)');
  } else {
    console.log('🔍 [4] Respuesta no es objeto ni array, tipo:', typeof response);
  }
  
  // Verificar todas las posibles formas de valid: false
  const esComentarioInvalido = validValue === "false" || 
                                validValue === false || 
                                validValue === "False" || 
                                validValue === "FALSE" ||
                                validValue === 0 ||
                                (typeof validValue === 'string' && validValue.toLowerCase().trim() === 'false');
  
  console.log('🔍 [4] ========== RESULTADO DE VALIDACIÓN ==========');
  console.log('🔍 [4] Valor de valid del webhook:', validValue);
  console.log('🔍 [4] Tipo de valid:', typeof validValue);
  console.log('🔍 [4] ¿Es comentario inválido?:', esComentarioInvalido);
  console.log('🔍 [4] ===========================================');
  
  // VALIDACIÓN CRÍTICA: Si es inválido, lanzar error INMEDIATAMENTE y DETENER ejecución
  // ESTO DEBE SER LO PRIMERO - ANTES de cualquier otro código
  if (esComentarioInvalido) {
    console.error('❌ [5] ========== COMENTARIO RECHAZADO POR WEBHOOK ==========');
    console.error('❌ [5] El webhook retornó valid: "false" o valid: false');
    console.error('❌ [5] Respuesta completa:', JSON.stringify(response, null, 2));
    console.error('❌ [5] NO se guardará ningún cambio en el caso');
    console.error('❌ [5] NO se agregará nada al historial');
    console.error('❌ [5] NO se actualizará el estado del caso');
    console.error('❌ [5] NO se retornará ningún caso');
    console.error('❌ [5] La función updateCaseStatus terminará aquí con un ERROR');
    
    // Extraer mensaje de error del campo "comentario"
    let mensajeError = 'El comentario no cumple con los requisitos necesarios.';
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const comentarioError = (response as any).comentario;
      console.error('❌ [5] Campo comentario en respuesta:', comentarioError);
      if (comentarioError) {
        mensajeError = typeof comentarioError === 'string' ? comentarioError : JSON.stringify(comentarioError);
        console.error('❌ [5] Mensaje de validación del webhook extraído:', mensajeError);
      } else {
        console.error('❌ [5] El webhook rechazó pero no proporcionó mensaje en campo "comentario"');
      }
    }
    
    console.error('❌ [5] ===========================================');
    console.error('❌ [5] LANZANDO ERROR AHORA - El código NO continuará después de esto');
    console.error('❌ [5] Mensaje de error que se lanzará:', `Comentario no válido: ${mensajeError}`);
    console.error('❌ [5] ===========================================');
    
    // LANZAR ERROR - esto detendrá la ejecución inmediatamente
    // IMPORTANTE: Este throw detendrá TODA la ejecución de updateCaseStatus
    const error = new Error(`Comentario no válido: ${mensajeError}`);
    console.error('❌ [5] Error creado, lanzando ahora...');
    console.error('❌ [5] Después de este throw, NO se ejecutará ningún código más en updateCaseStatus');
    throw error;
    // NUNCA se ejecutará código después de este throw
  }
  
  // Si llegamos aquí, significa que valid NO es false
  console.log('✅ [4] Validación pasada - valid NO es false, continuando...');
  
  // Si llegamos aquí, el comentario NO fue rechazado (valid !== false)
  // IMPORTANTE: Este código SOLO se ejecuta si valid NO es false
  console.log('✅ [4] El comentario NO fue rechazado, continuando con flujo de éxito...');
  // Verificar si es un array (historial) - significa que fue exitoso
  const esRespuestaExitosa = Array.isArray(response) && response.length > 0;
  
  console.log('🔍 [4] Verificando si la respuesta es exitosa...');
  console.log('🔍 [4] ¿Es array?:', Array.isArray(response));
  console.log('🔍 [4] ¿Tiene longitud > 0?:', Array.isArray(response) ? response.length > 0 : false);
  
  if (esRespuestaExitosa) {
    console.log('✅ [5] ========== COMENTARIO ACEPTADO POR WEBHOOK ==========');
    console.log('✅ [5] El webhook retornó un array (historial), lo que indica éxito');
    console.log('✅ [5] Cantidad de entradas en historial:', response.length);
    console.log('✅ [5] El cambio se guardó correctamente en la base de datos');
    console.log('✅ [5] Procediendo a obtener el caso actualizado con case.query...');
    console.log('✅ [5] ===========================================');
  } else {
    // Si no es array ni tiene valid: false, asumir éxito (compatibilidad con otros formatos)
    // PERO solo si NO tiene valid: false (ya validado arriba)
    console.log('✅ [5] ========== CAMBIO ACEPTADO POR WEBHOOK ==========');
    console.log('✅ [5] El webhook retornó 200 OK sin valid: "false"');
    console.log('✅ [5] NO es un array, pero tampoco tiene valid: false');
    console.log('✅ [5] Asumiendo que el cambio se guardó correctamente');
    console.log('✅ [5] Procediendo a obtener el caso actualizado con case.query...');
    console.log('✅ [5] ===========================================');
  }
  
  // Continuar con la obtención del caso actualizado
  // (el código que sigue después del else original)
  
  // El webhook YA actualizó el caso, ahora consultamos para obtener el caso actualizado
  console.log('🔄 [6] Consultando caso actualizado con case.query...');
  console.log('🔄 [6] Haciendo dos consultas en paralelo:');
  console.log('🔄 [6]   1. Con case_id para obtener el caso específico actualizado');
  console.log('🔄 [6]   2. Con user_id para actualizar caché de casos del usuario');
  
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
  
  console.log('📤 Payload enviado a case.query (case_id):', JSON.stringify(queryPayloadCaseId, null, 2));
  console.log('📤 Payload enviado a case.query (user_id):', JSON.stringify(queryPayloadUserId, null, 2));
  
  // Hacer ambas peticiones en paralelo
  const [queryResponseCaseId, queryResponseUserId] = await Promise.all([
    callCaseWebhook(queryPayloadCaseId),
    callCaseWebhook(queryPayloadUserId)
  ]);
  
  console.log('📥 ========== RESPUESTA DEL WEBHOOK case.query (case_id) ==========');
  console.log('📥 Tipo:', typeof queryResponseCaseId);
  console.log('📥 Es array?:', Array.isArray(queryResponseCaseId));
  console.log('📥 Respuesta completa (JSON):', JSON.stringify(queryResponseCaseId, null, 2));
  console.log('📥 Respuesta completa (objeto):', queryResponseCaseId);
  if (Array.isArray(queryResponseCaseId) && queryResponseCaseId.length > 0) {
    console.log('📥 Primer elemento del array:', queryResponseCaseId[0]);
    console.log('📥 Claves del primer elemento:', Object.keys(queryResponseCaseId[0] || {}));
  }
  console.log('📥 ================================================================');
  
  console.log('📥 ========== RESPUESTA DEL WEBHOOK case.query (user_id) ==========');
  console.log('📥 Tipo:', typeof queryResponseUserId);
  console.log('📥 Es array?:', Array.isArray(queryResponseUserId));
  console.log('📥 Respuesta completa (JSON):', JSON.stringify(queryResponseUserId, null, 2));
  console.log('📥 Respuesta completa (objeto):', queryResponseUserId);
  if (Array.isArray(queryResponseUserId) && queryResponseUserId.length > 0) {
    console.log('📥 Primer elemento del array:', queryResponseUserId[0]);
    console.log('📥 Claves del primer elemento:', Object.keys(queryResponseUserId[0] || {}));
  }
  console.log('📥 ================================================================');
  
  // Usar la respuesta de case_id para el caso específico
  const queryResponse = queryResponseCaseId;
  
  // Procesar respuesta del case.query (que viene con historial_caso y detalle_caso)
  console.log('🔍 Procesando respuesta del case.query...');
  console.log('🔍 queryResponse es array?:', Array.isArray(queryResponse));
  console.log('🔍 queryResponse length:', Array.isArray(queryResponse) ? queryResponse.length : 'N/A');
  
  if (Array.isArray(queryResponse) && queryResponse.length > 0) {
    const firstItem = queryResponse[0];
    console.log('🔍 Primer elemento del array:', firstItem);
    console.log('🔍 Tipo del primer elemento:', typeof firstItem);
    console.log('🔍 Claves del primer elemento:', firstItem && typeof firstItem === 'object' ? Object.keys(firstItem) : 'N/A');
    console.log('🔍 Tiene historial_caso?:', firstItem && typeof firstItem === 'object' ? 'historial_caso' in firstItem : false);
    console.log('🔍 Tiene detalle_caso?:', firstItem && typeof firstItem === 'object' ? 'detalle_caso' in firstItem : false);
    
    // Verificar si es el nuevo formato con historial_caso y detalle_caso
    if (firstItem && typeof firstItem === 'object' && 'historial_caso' in firstItem && 'detalle_caso' in firstItem) {
      console.log('✅ Respuesta es formato nuevo con historial_caso y detalle_caso');
      
      const historialArray = Array.isArray(firstItem.historial_caso) ? firstItem.historial_caso : [];
      const detalleCasoArray = Array.isArray(firstItem.detalle_caso) ? firstItem.detalle_caso : [];
      const agenteArray = Array.isArray(firstItem.agente) ? firstItem.agente : [];
      
      console.log('✅ Historial recibido:', historialArray.length, 'entradas');
      console.log('✅ Detalle caso recibido:', detalleCasoArray.length, 'entradas');
      console.log('✅ Agente recibido:', agenteArray.length, 'entradas');
      
      // Mapear el historial
      const historialMapeado = historialArray.length > 0 
        ? mapWebhookHistorialToFrontend(historialArray as WebhookHistorialEntry[])
        : [];
      
      // Mapear el caso desde detalle_caso - SOLO usar datos del webhook
      if (detalleCasoArray.length > 0) {
        const casoData = detalleCasoArray[0];
        
        // Si hay información del agente en el array agente, combinarla con los datos del caso
        if (agenteArray.length > 0) {
          const agenteData = agenteArray[0];
          console.log('✅ Combinando datos del agente con datos del caso:', agenteData);
          
          // Combinar datos del agente con los datos del caso
          casoData.agente = agenteData;
          casoData.agente_nombre = agenteData.nombre || casoData.agente_nombre;
          casoData.agente_name = agenteData.nombre || casoData.agente_name;
          casoData.agentename = agenteData.nombre || casoData.agentename;
          casoData.agente_id = agenteData.id_agente || casoData.agente_id;
          casoData.agente_user_id = agenteData.id_agente || casoData.agente_user_id;
        }
        
        console.log('📋 Datos del caso a mapear desde detalle_caso (con agente combinado):', casoData);
        console.log('📋 Estado en casoData del webhook:', casoData.estado || casoData.status || casoData.estado_caso);
        const casoActualizado = mapWebhookResponseToCase(casoData);
        
        if (casoActualizado) {
          console.log('✅ Caso mapeado exitosamente:', casoActualizado.id);
          console.log('📋 Estado después de mapear:', casoActualizado.status || casoActualizado.estado);
          
          // Inicializar historial si no existe
          if (!casoActualizado.historial) {
            casoActualizado.historial = [];
          }
          if (!casoActualizado.history) {
            casoActualizado.history = [];
          }
          
          // Agregar el historial del webhook preservando la entrada de creación
          if (historialMapeado.length > 0) {
            console.log('✅ Agregando historial mapeado al caso:', historialMapeado.length, 'entradas');
            
            // Verificar si hay una entrada de creación en el historial del webhook
            const tieneEntradaCreacion = historialMapeado.some(entry => entry.tipo_evento === 'CREADO');
            
            // Si no hay entrada de creación, agregarla al final (más antigua)
            if (!tieneEntradaCreacion && casoActualizado.createdAt) {
              const entradaCreacion: HistorialEntry = {
                tipo_evento: 'CREADO',
                justificacion: 'Caso creado',
                autor_nombre: 'Sistema',
                autor_rol: 'sistema',
                fecha: casoActualizado.createdAt
              };
              // Agregar al final (más antigua) para que la creación aparezca primero cuando se ordena por fecha descendente
              historialMapeado.push(entradaCreacion);
              console.log('✅ Entrada de creación agregada al historial');
            }
            
            // Usar el historial del webhook (con entrada de creación si no existía)
            casoActualizado.historial = [...historialMapeado];
            casoActualizado.history = [...historialMapeado];
          } else {
            // Si no hay historial del webhook, crear entrada de creación
            if (casoActualizado.createdAt) {
              const entradaCreacion: HistorialEntry = {
                tipo_evento: 'CREADO',
                justificacion: 'Caso creado',
                autor_nombre: 'Sistema',
                autor_rol: 'sistema',
                fecha: casoActualizado.createdAt
              };
              casoActualizado.historial = [entradaCreacion];
              casoActualizado.history = [entradaCreacion];
              console.log('✅ Historial inicializado con entrada de creación');
            } else {
              console.warn('⚠️ No hay historial mapeado y no hay fecha de creación');
            }
          }
          
          // USAR SOLO EL ESTADO QUE RETORNA EL WEBHOOK - NO USAR newStatus COMO FALLBACK
          console.log('🔍 ========== DETERMINANDO ESTADO DESDE WEBHOOK ==========');
          
          // 1. Intentar obtener el estado del historial (última entrada)
          let estadoDelWebhook: string | undefined = undefined;
          if (historialMapeado.length > 0) {
            const ultimaEntrada = historialMapeado[0];
            estadoDelWebhook = ultimaEntrada.estado_nuevo;
            console.log('🔍 Estado desde historial (estado_nuevo):', estadoDelWebhook);
          }
          
          // 2. Si no hay estado en historial, usar el estado del caso mapeado del webhook
          if (!estadoDelWebhook) {
            estadoDelWebhook = casoActualizado.status || casoActualizado.estado;
            console.log('🔍 Estado desde caso mapeado:', estadoDelWebhook);
          }
          
          // 3. Si aún no hay estado, buscar en casoData original del webhook
          if (!estadoDelWebhook) {
            estadoDelWebhook = casoData.estado || casoData.status || casoData.estado_caso;
            console.log('🔍 Estado desde casoData original del webhook:', estadoDelWebhook);
          }
          
          // 4. SOLO usar el estado del webhook, NO usar newStatus como fallback
          if (estadoDelWebhook) {
            casoActualizado.status = estadoDelWebhook;
            casoActualizado.estado = estadoDelWebhook;
            console.log('✅ Estado FINAL asignado desde webhook:', estadoDelWebhook);
            console.log('⚠️ NO se usó newStatus como fallback - usando SOLO lo que retorna el webhook');
          } else {
            console.error('❌ ERROR: El webhook NO retornó ningún estado');
            console.error('❌ casoData original:', casoData);
            console.error('❌ casoActualizado después de mapear:', casoActualizado);
            console.error('❌ historialMapeado:', historialMapeado);
            throw new Error('El webhook no retornó el estado del caso. No se puede determinar el estado actual.');
          }
          
          console.log('🔍 ================================================');
          
          console.log('✅ [FINAL] Retornando caso actualizado con historial:', {
            id: casoActualizado.id,
            status: casoActualizado.status,
            historialLength: casoActualizado.historial?.length || 0
          });
          console.log('================== FIN updateCaseStatus (ÉXITO) ==================');
          
          return casoActualizado;
        } else {
          console.error('❌ No se pudo mapear el caso desde detalle_caso');
        }
      } else {
        console.error('❌ detalle_caso está vacío');
      }
      
      // Si no se pudo mapear el caso desde detalle_caso, lanzar error
      throw new Error('El webhook no retornó el detalle del caso actualizado');
    }
    
    // Verificar si es un array de historial directo (formato anterior)
    // NOTA: Este formato ya no se usa, pero mantenemos compatibilidad
    if (firstItem && typeof firstItem === 'object' && 'id_historial' in firstItem && 'caso_id' in firstItem) {
      console.log('✅ Respuesta es un array de historial directo con', queryResponse.length, 'entradas');
      
      const historialMapeado = mapWebhookHistorialToFrontend(queryResponse as WebhookHistorialEntry[]);
      console.log('✅ Historial mapeado:', historialMapeado);
      
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
          casoActualizado.estado = ultimaEntrada.estado_nuevo || newStatus;
        }
        
        return casoActualizado;
      } else {
        throw new Error('No se pudo obtener el caso actualizado desde el webhook');
      }
    }
  } else {
    console.warn('⚠️ queryResponse no es un array o está vacío');
    console.warn('⚠️ queryResponse:', queryResponse);
  }
  
  // Si llegamos aquí, no se procesó el formato con historial_caso y detalle_caso
  // Intentar otros formatos como fallback
  console.log('⚠️ No se encontró formato con historial_caso y detalle_caso, intentando otros formatos...');
  console.log('📥 Tipo de respuesta queryResponse:', typeof queryResponse);
  console.log('📥 Es array?:', Array.isArray(queryResponse));
  console.log('📥 Tiene data?:', !!(queryResponse as any)?.data);
  
  // Si la respuesta es directamente un objeto de caso (tiene case_id o id)
  if (!Array.isArray(queryResponse) && queryResponse && typeof queryResponse === 'object') {
    const hasCaseId = 'case_id' in queryResponse || 'id' in queryResponse || 'ticketNumber' in queryResponse;
    if (hasCaseId) {
      console.log('✅ Respuesta es directamente un objeto de caso');
      const mappedCase = mapWebhookResponseToCase(queryResponse);
      if (mappedCase) {
        console.log('✅ Caso mapeado exitosamente:', mappedCase.id);
        return mappedCase;
      }
    }
  }
  
  // Si retorna un objeto con data que es un array
  if (queryResponse && typeof queryResponse === 'object' && queryResponse.data && Array.isArray(queryResponse.data)) {
    console.log(`✅ Respuesta tiene data array con ${queryResponse.data.length} casos, buscando caso ${caseId}...`);
    const cases = mapWebhookResponseToCases(queryResponse.data);
    const foundCase = cases.find(c => {
      const cId = (c.id || c.ticketNumber || '').toString();
      const searchId = caseId.toString();
      return cId === searchId || cId === caseId || c.ticketNumber === caseId ||
             cId.replace(/^CASO-?/, '') === searchId.replace(/^CASO-?/, '');
    });
    if (foundCase) {
      console.log('✅ Caso encontrado en el array:', foundCase.id);
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
  
  // Si no se pudo procesar la respuesta del case.query, lanzar error
  // NO usar fallback local, todo debe venir del webhook
  console.error('❌ No se pudo procesar la respuesta del webhook case.query');
  console.error('❌ Respuesta recibida:', queryResponse);
  throw new Error('No se pudo procesar la respuesta del webhook case.query para obtener el caso actualizado');
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

  console.log('📝 [updateCaseData] Actualizando caso con:', { caseId, updates });

  const payload: CaseWebhookPayload = {
    action: 'case.update',
    actor,
    data: {
      case_id: caseId,
      patch: updates
    }
  };

  const response = await callCaseWebhook(payload);
  
  console.log('📥 [updateCaseData] Respuesta del webhook:', response);

  // Obtener el caso actualizado
  if (response.success !== false && !response.error) {
    // Recargar el caso actualizado
    const updatedCase = await getCaseById(caseId);
    console.log('✅ [updateCaseData] Caso actualizado exitosamente');
    return updatedCase;
  }

  throw new Error('Error al actualizar el caso');
};