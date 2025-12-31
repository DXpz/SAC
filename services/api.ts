
import { Case, CaseStatus, KPI, User, Role, Cliente, Categoria } from '../types';
import { MOCK_CASOS, MOCK_AGENTES, MOCK_USERS, MOCK_CLIENTES, MOCK_CATEGORIAS } from './mockData';
import { API_CONFIG, CASES_WEBHOOK_URL, CLIENTS_WEBHOOK_URL } from '../config';
import { emailService } from './emailService';
import * as caseService from './caseService';
import * as roundRobinService from './roundRobinService';

// Sistema de caché simple para evitar llamadas redundantes
interface CacheEntry {
  data: any;
  timestamp: number;
  promise?: Promise<any>;
}

const CACHE_DURATION = 5000; // 5 segundos de caché
const cache: {
  cases?: CacheEntry;
  clientes?: CacheEntry;
  agentes?: CacheEntry;
} = {};

// Helper para obtener datos del caché o hacer la llamada
const getCachedOrFetch = async <T>(
  key: 'cases' | 'clientes' | 'agentes',
  fetchFn: () => Promise<T>,
  maxAge: number = CACHE_DURATION
): Promise<T> => {
  const now = Date.now();
  const cached = cache[key];
  
  // Si hay datos en caché y no han expirado, retornarlos
  if (cached && cached.data && (now - cached.timestamp) < maxAge) {
    console.log(`📦 [CACHE] Retornando ${key} desde caché (${Math.round((now - cached.timestamp) / 1000)}s)`);
    return cached.data as T;
  }
  
  // Si ya hay una petición en curso, esperar a que termine
  if (cached?.promise) {
    console.log(`⏳ [CACHE] Esperando petición en curso para ${key}...`);
    return await cached.promise as T;
  }
  
  // Hacer nueva petición
  console.log(`🌐 [CACHE] Haciendo nueva petición para ${key}...`);
  const promise = fetchFn();
  cache[key] = {
    data: null,
    timestamp: now,
    promise
  };
  
  try {
    const data = await promise;
    if (cache[key]) {
      cache[key] = {
        data,
        timestamp: now
      };
    }
    return data;
  } catch (error) {
    // Si falla, limpiar el caché para permitir reintentos
    delete cache[key];
    throw error;
  }
};

// Limpiar caché manualmente
const clearCache = (key?: 'cases' | 'clientes' | 'agentes') => {
  if (key) {
    delete cache[key];
    console.log(`🗑️ [CACHE] Caché de ${key} limpiado`);
  } else {
    Object.keys(cache).forEach(k => delete cache[k as keyof typeof cache]);
    console.log('🗑️ [CACHE] Todo el caché limpiado');
  }
};

// Inicializar datos en localStorage si no existen
const initStorage = () => {
  if (!localStorage.getItem('intelfon_cases')) {
    localStorage.setItem('intelfon_cases', JSON.stringify(MOCK_CASOS));
  }
  if (!localStorage.getItem('intelfon_agents')) {
    localStorage.setItem('intelfon_agents', JSON.stringify(MOCK_AGENTES));
  }
};

// Helper genérico para llamadas a webhooks de n8n
// Usa el JWT almacenado (cuando exista) y respeta el timeout global
const callWebhookGeneric = async <T = any>(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  const token = localStorage.getItem('intelfon_token');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    console.log(`🌐 [callWebhookGeneric] Iniciando ${method} a ${url}`);
    console.log(`📋 [callWebhookGeneric] Headers:`, headers);
    if (body) {
      const bodyString = JSON.stringify(body);
      console.log(`📤 [callWebhookGeneric] Body (primeros 500 chars):`, bodyString.substring(0, 500));
      console.log(`📏 [callWebhookGeneric] Tamaño del body:`, bodyString.length, 'bytes');
    }
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method,
      mode: 'cors',
      credentials: 'omit',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    console.log(`📥 [callWebhookGeneric] Respuesta recibida (${duration}ms):`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      // Intentar extraer mensaje de error del backend
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      let errorBody = null;
      try {
        const text = await response.text();
        console.error('❌ [callWebhookGeneric] Cuerpo de error (texto):', text);
        try {
          errorBody = JSON.parse(text);
          console.error('❌ [callWebhookGeneric] Cuerpo de error (JSON):', errorBody);
          if (errorBody?.message) {
            errorMessage = errorBody.message;
          }
        } catch {
          // No es JSON, usar el texto
          errorMessage = text || errorMessage;
        }
      } catch {
        // ignorar error de parseo
      }
      throw new Error(errorMessage);
    }

    // Algunos flujos podrían responder 204 sin cuerpo
    if (response.status === 204) {
      console.log('ℹ️ [callWebhookGeneric] Respuesta 204 (sin contenido)');
      return undefined as unknown as T;
    }

    const text = await response.text();
    console.log('📄 [callWebhookGeneric] Respuesta (texto, primeros 1000 chars):', text.substring(0, 1000));
    
    let data: T;
    try {
      data = JSON.parse(text) as T;
      console.log('✅ [callWebhookGeneric] Respuesta parseada (JSON):', JSON.stringify(data, null, 2).substring(0, 1000));
    } catch (parseError) {
      console.warn('⚠️ [callWebhookGeneric] No se pudo parsear como JSON, retornando texto');
      console.warn('⚠️ [callWebhookGeneric] Error de parseo:', parseError);
      data = text as unknown as T;
    }
    
    return data;
  } catch (error: any) {
    console.error('❌ [callWebhookGeneric] Error capturado:', error);
    console.error('❌ [callWebhookGeneric] Tipo:', typeof error);
    console.error('❌ [callWebhookGeneric] Nombre:', error?.name);
    if (error.name === 'AbortError') {
      throw new Error('Timeout al comunicarse con el backend (n8n).');
    }
    // Re-lanzamos para que la capa superior pueda hacer fallback a mock/localStorage
    throw error;
  }
};

// Helper para llamadas al webhook de casos en n8n
const callCasesWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  console.log(`🌐 [callCasesWebhook] ${method} ${CASES_WEBHOOK_URL}`);
  if (body) {
    console.log('📤 [callCasesWebhook] Body a enviar:', JSON.stringify(body, null, 2));
    console.log('📏 [callCasesWebhook] Tamaño del body:', JSON.stringify(body).length, 'bytes');
  }
  
  try {
    const result = await callWebhookGeneric<T>(CASES_WEBHOOK_URL, method, body);
    console.log('✅ [callCasesWebhook] Respuesta recibida exitosamente');
    console.log('📥 [callCasesWebhook] Datos de respuesta:', result);
    return result;
  } catch (error: any) {
    console.error('❌ [callCasesWebhook] Error en la petición:', error);
    console.error('❌ [callCasesWebhook] Mensaje:', error?.message);
    console.error('❌ [callCasesWebhook] Stack:', error?.stack);
    if (error?.response) {
      console.error('❌ [callCasesWebhook] Response del error:', error.response);
    }
    throw error;
  }
};

// Helper para llamadas al webhook de clientes en n8n
const callClientsWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  return callWebhookGeneric<T>(CLIENTS_WEBHOOK_URL, method, body);
};

// Helpers para construir el payload estándar esperado por n8n
const buildActorPayload = (user: User | null) => {
  if (!user) {
    return {
      user_id: 0,
      email: 'demo@intelfon.com',
      role: 'AGENTE',
    };
  }

  const numericId = Number((user as any).user_id ?? user.id);

  return {
    user_id: Number.isNaN(numericId) ? 0 : numericId,
    email: (user as any).email || 'demo@intelfon.com',
    role: user.role,
  };
};

const DEFAULT_CATEGORY = {
  categoria_id: 7, // "Otros" - categoría por defecto para casos sin categoría específica
  nombre: 'Otros',
};


// Función auxiliar para llamar al webhook de Make.com
// Solo permite operaciones si el webhook responde correctamente
// type: 'login' | 'forgot_password' | 'register'
const callWebhook = async (scenario: 'login' | 'reset_password' | 'new_account', data: any) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  // Mapear scenario a type para Make.com
  const typeMap: Record<'login' | 'reset_password' | 'new_account', string> = {
    'login': 'login',
    'reset_password': 'forgot_password',
    'new_account': 'register'
  };

  const type = typeMap[scenario];

  try {
    // Intentar la petición con CORS
    let response: Response;
    try {
      response = await fetch(API_CONFIG.WEBHOOK_URL, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          type,
          ...data,
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      // Si hay un error de red o CORS, proporcionar un mensaje más específico
      if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
        throw new Error('Error de conexión: El servidor n8n no está permitiendo peticiones CORS. Contacta al administrador para configurar CORS en el servidor.');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    // Verificar si la respuesta es válida antes de intentar parsear JSON
    if (!response.ok && response.status === 0) {
      throw new Error('Error de CORS: El servidor no está permitiendo peticiones desde este origen.');
    }

    const result = await response.json();
    
    // Verificar si hay error en la respuesta (formato de Make.com)
    if (result.error === true) {
      throw new Error(result.message || 'Error en la operación');
    }

    // Si la respuesta no es ok, también tratar como error
    if (!response.ok) {
      throw new Error(result.message || `Error ${response.status}: ${response.statusText}`);
    }

    // Validaciones según el escenario (formato de Make.com)
    if (scenario === 'login' || scenario === 'new_account') {
      // Para login y register, Make.com retorna: { id, name, role, email }
      // NO retorna token ni user anidado
      if (!result.id || !result.name || !result.role) {
        throw new Error('Respuesta del webhook inválida. Faltan datos del usuario.');
      }
      
      // Validar que el rol sea válido
      if (!['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(result.role)) {
        throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
      }
      
      // Normalizar la respuesta al formato esperado internamente
      return {
        token: `token-${result.id}-${Date.now()}`, // Generar token local basado en el ID
        user: {
          id: result.id,
          name: result.name,
          role: result.role,
          email: result.email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=0f172a&color=fff`
        }
      };
    } else if (scenario === 'reset_password') {
      // Para reset password, validar según la acción
      if (data.action === 'verify_code' && !result.tempToken) {
        throw new Error('Código de verificación inválido o expirado');
      }
      if (result.error === true || result.success === false) {
        throw new Error(result.message || 'Error en la operación de restablecimiento de contraseña');
      }
      return result;
    }
    
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: El servidor no respondió a tiempo. Verifica tu conexión.');
    }
    // Detectar errores específicos de CORS
    if (error.message && (
      error.message.includes('CORS') || 
      error.message.includes('cors') ||
      error.message.includes('fetch') ||
      error.message.includes('NetworkError') ||
      error.name === 'TypeError'
    )) {
      // En desarrollo, sugerir usar el proxy
      const isDevelopment = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isDevelopment) {
        throw new Error('Error de CORS detectado. El proxy de desarrollo debería manejar esto automáticamente. Verifica la configuración de Vite.');
      }
      // En producción, indicar que el servidor necesita configurar CORS
      throw new Error('Error de CORS: El servidor n8n necesita permitir peticiones desde este dominio. Contacta al administrador para configurar los headers CORS en n8n.');
    }
    if (error.message) {
      throw error;
    }
    throw new Error('Error de conexión con el servidor. La cuenta debe estar registrada en el sistema.');
  }
};

// Función auxiliar para autenticación con webhook (escenario: login)
// Solo permite acceso si el webhook de ClickUp valida la cuenta
const authenticateWithWebhook = async (email: string, password: string): Promise<User> => {
  const data = await callWebhook('login', { email, password });
  
  // El webhook debe retornar: { token: string, user: { id, name, role, avatar? } }
  // Si no hay token o usuario, significa que la cuenta no está registrada o las credenciales son inválidas
  if (!data.token || !data.user) {
    throw new Error('Credenciales inválidas o cuenta no registrada en el sistema');
  }

  // Validar que el usuario tenga un ID válido
  if (!data.user.id) {
    throw new Error('La cuenta no está correctamente registrada en el sistema');
  }

  // Validar que el token sea una cadena no vacía
  if (!data.token || typeof data.token !== 'string' || data.token.trim() === '') {
    throw new Error('Token de autenticación inválido. La cuenta no está correctamente registrada.');
  }

  // Validar que el usuario tenga nombre válido
  if (!data.user.name || typeof data.user.name !== 'string' || data.user.name.trim() === '') {
    throw new Error('Información de usuario incompleta. La cuenta no está correctamente registrada.');
  }

  // Validar que el rol sea válido y venga del webhook
  const userRole = data.user.role;
  if (!userRole || !['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(userRole)) {
    throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
  }

  // Almacenar el token JWT para futuras peticiones
  localStorage.setItem('intelfon_token', data.token);
  
  // Almacenar información del usuario EXACTAMENTE como viene del webhook
  // NO se permite sobrescribir con mapeos locales - todo debe venir del webhook
  const user: User = {
    id: data.user.id,
    name: data.user.name.trim(),
    role: userRole,
    avatar: data.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name)}&background=0f172a&color=fff`
  };

  localStorage.setItem('intelfon_user', JSON.stringify(user));
  return user;
};

// Cuentas demo permitidas (solo para desarrollo/pruebas)
// Estas cuentas pueden acceder sin pasar por el webhook
const DEMO_ACCOUNTS: Record<string, { role: Role; name: string }> = {
  'agente@intelfon.com': { role: 'AGENTE', name: 'Agente Demo' },
  'supervisor@intelfon.com': { role: 'SUPERVISOR', name: 'Supervisor Demo' },
  'gerente@intelfon.com': { role: 'GERENTE', name: 'Gerente Demo' },
};

// Función auxiliar para autenticación en modo demo (solo para cuentas demo permitidas)
const authenticateDemo = (email: string): User => {
  initStorage();
  
  const emailLower = (email || '').toLowerCase().trim();
  const demoAccount = DEMO_ACCOUNTS[emailLower];
  
  if (!demoAccount) {
    throw new Error('Cuenta demo no permitida');
  }
  
  const user: User = {
    id: `demo-${demoAccount.role.toLowerCase()}`,
    name: demoAccount.name,
    role: demoAccount.role,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(demoAccount.name)}&background=0f172a&color=fff`
  };

  // Generar un token demo simple
  const demoToken = `demo-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  localStorage.setItem('intelfon_token', demoToken);
  localStorage.setItem('intelfon_user', JSON.stringify(user));
  
  return user;
};

export const api = {
  getUser(): User | null {
    const data = localStorage.getItem('intelfon_user');
    return data ? JSON.parse(data) : null;
  },

  getToken(): string | null {
    return localStorage.getItem('intelfon_token');
  },

  async authenticate(email: string, pass: string): Promise<User> {
    // Validaciones previas
    if (!email || !email.trim()) {
      throw new Error('El correo electrónico es requerido');
    }
    if (!pass || !pass.trim()) {
      throw new Error('La contraseña es requerida');
    }
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Formato de correo electrónico inválido');
    }
    
    const emailLower = email.trim().toLowerCase();
    
    // Verificar si es una cuenta demo permitida
    if (DEMO_ACCOUNTS[emailLower]) {
      // Para cuentas demo, cualquier contraseña es válida
      return authenticateDemo(emailLower);
    }
    
    // Para todas las demás cuentas, DEBEN estar registradas y almacenadas en el sistema
    // El webhook de Make.com verifica si el usuario existe en su base de datos
    // Si el usuario no está almacenado, el webhook retornará un error
    try {
      const user = await authenticateWithWebhook(email.trim(), pass);
      // Si llegamos aquí, el usuario está almacenado en el sistema y las credenciales son correctas
      return user;
    } catch (error: any) {
      // Limpiar cualquier dato previo en caso de error
      localStorage.removeItem('intelfon_user');
      localStorage.removeItem('intelfon_token');
      
      // Mejorar el mensaje de error para indicar claramente si el usuario no está almacenado
      const errorMessage = error.message || 'Error de autenticación';
      if (errorMessage.includes('no registrada') || 
          errorMessage.includes('no encontrado') || 
          errorMessage.includes('no está almacenado') ||
          errorMessage.includes('404')) {
        throw new Error('Usuario no encontrado. El usuario no está almacenado en el sistema. Contacta a tu supervisor para crear una cuenta.');
      }
      throw error;
    }
  },

  async getCases(): Promise<Case[]> {
    return getCachedOrFetch('cases', async () => {
      const user = this.getUser();
      
      // Intentar obtener casos usando el nuevo caseService (conecta con n8n)
      try {
        const cases = await caseService.getCases();
        // Retornar incluso si está vacío, solo si no hay error
        console.log(`✅ Obtenidos ${cases?.length || 0} casos desde caseService (n8n)`);
        return cases || [];
      } catch (err: any) {
        // No usar localStorage como fallback, lanzar el error
        console.error('❌ Error al obtener casos desde caseService:', err);
        throw err;
      }
    });
  },

  async getCasoById(id: string): Promise<Case | undefined> {
    // Intentar obtener caso usando el nuevo caseService
    try {
      const caso = await caseService.getCaseById(id);
      if (caso) {
        return caso;
      }
    } catch (err) {
      console.warn('⚠️ Error al obtener caso desde caseService, usando método legacy:', err);
    }
    
    // Fallback: buscar en la lista de casos
    const cases = await this.getCases();
    return cases.find(c => c.id === id || c.idCaso === id || c.ticketNumber === id);
  },

  async updateCaseStatus(id: string, status: string, detail: string, extra?: any): Promise<boolean> {
    const user = this.getUser();

    // 1) Intentar actualizar usando el nuevo caseService (conecta con n8n)
    try {
      await caseService.updateCaseStatus(id, status, detail || `Cambio de estado a ${status}`);
      console.log('✅ Caso actualizado exitosamente usando caseService');
      // Limpiar caché de casos para forzar actualización
      clearCache('cases');
    } catch (err) {
      console.warn('⚠️ Error al actualizar caso en caseService, intentando método legacy:', err);
      
      // Fallback: Notificar cambio de estado a n8n usando el contrato CRUD.UPDATE
      try {
        await callCasesWebhook('POST', {
          action: 'case.update',
          actor: buildActorPayload(user),
          data: {
            case_id: id,
            patch: {
              estado: status,
              descripcion: detail || `Cambio de estado a ${status}`,
              ...(extra?.resolucion ? { resolucion: extra.resolucion } : {}),
            },
          },
        });
      } catch (err2) {
        console.warn('Error al actualizar caso en n8n, aplicando cambio solo en local.', err2);
      }
    }

    // 2) Actualizar también el estado en localStorage como fallback
    const cases = await this.getCases();
    const idx = cases.findIndex((c: any) => (c.id === id || c.idCaso === id || c.ticketNumber === id));
    
    if (idx !== -1) {
      cases[idx].estado = status;
      cases[idx].status = status;
      if (!cases[idx].historial) cases[idx].historial = [];
      
      cases[idx].historial.unshift({
        fechaHora: new Date().toISOString(),
        detalle: detail || `Cambio de estado a ${status}`,
        usuario: this.getUser()?.name || 'Sistema'
      });

      if (extra?.resolucion) cases[idx].resolucion = extra.resolucion;
      
      localStorage.setItem('intelfon_cases', JSON.stringify(cases));
      return true;
    }
    return false;
  },

  async createCase(caseData: any): Promise<boolean> {
    const user = this.getUser();

    console.log('🔵 ========== [api.createCase] INICIANDO ==========');
    console.log('📦 Datos recibidos del formulario:', JSON.stringify(caseData, null, 2));
    console.log('👤 Usuario:', JSON.stringify(user, null, 2));

    // 1) Intentar crear el caso usando el nuevo caseService (conecta con n8n)
    try {
      console.log('🌐 Intentando crear caso usando caseService...');
      const newCase = await caseService.createCase({
        clienteId: caseData.clienteId || `CL-${Date.now()}`,
        categoriaId: caseData.categoriaId || '7',
        contactChannel: caseData.contactChannel || caseData.canalOrigen || 'Web',
        subject: caseData.subject,
        description: caseData.description,
        clientEmail: caseData.clientEmail,
        clientName: caseData.clientName,
        notificationChannel: caseData.notificationChannel || caseData.contactChannel || 'Email',
        ...caseData
      });
      
      console.log('✅ Caso creado exitosamente usando caseService:', newCase);
      // Limpiar caché de casos para forzar actualización
      clearCache('cases');
      return true;
    } catch (err: any) {
      console.warn('⚠️ Error al crear caso en caseService, intentando método legacy:', err);
      
      // Fallback: Método legacy
      // Buscar la categoría seleccionada
      const categoriaSeleccionada = caseData.categoriaId 
        ? MOCK_CATEGORIAS.find(cat => cat.idCategoria === caseData.categoriaId)
        : null;

      console.log('📂 Categoría seleccionada:', categoriaSeleccionada);

      // Determinar categoria_id y nombre para el JSON
      const categoriaId = categoriaSeleccionada 
        ? (typeof categoriaSeleccionada.idCategoria === 'string' ? parseInt(categoriaSeleccionada.idCategoria) || 1 : categoriaSeleccionada.idCategoria)
        : DEFAULT_CATEGORY.categoria_id;
      const categoriaNombre = categoriaSeleccionada?.nombre || DEFAULT_CATEGORY.nombre;

      console.log('📂 Categoría procesada:', { categoriaId, categoriaNombre });

      // Construir el payload completo para n8n
      const actorPayload = buildActorPayload(user);
      const n8nPayload = {
        action: 'case.create',
        actor: actorPayload,
        data: {
          cliente: {
            cliente_id: caseData.clienteId || `CL-${Date.now()}`,
            nombre_empresa: caseData.clientName,
            contacto_principal: caseData.contactName || caseData.clientName,
            email: caseData.clientEmail,
            telefono: caseData.phone || '',
          },
          categoria: {
            categoria_id: categoriaId,
            nombre: categoriaNombre,
          },
          canal_origen: caseData.contactChannel || caseData.canalOrigen || 'Web',
          canal_notificacion: caseData.notificationChannel || caseData.contactChannel || 'Email',
          asunto: caseData.subject,
          descripcion: caseData.description,
        },
      };

      console.log('📤 ========== PAYLOAD COMPLETO PARA N8N (LEGACY) ==========');
      console.log('URL del webhook:', CASES_WEBHOOK_URL);
      console.log('Payload JSON:', JSON.stringify(n8nPayload, null, 2));
      console.log('Payload tamaño:', JSON.stringify(n8nPayload).length, 'bytes');

      // Intentar crear el caso en el backend n8n usando el contrato CRUD.CREATE (no bloquea la creación local)
      try {
        console.log('🌐 Enviando petición POST a n8n (legacy)...');
        const startTime = Date.now();
        
        const response = await callCasesWebhook('POST', n8nPayload);
        
        const duration = Date.now() - startTime;
        console.log(`✅ ========== RESPUESTA DE N8N (${duration}ms) ==========`);
        console.log('Respuesta recibida:', JSON.stringify(response, null, 2));
        console.log('Tipo de respuesta:', typeof response);
        console.log('Es array:', Array.isArray(response));
        
        if (response && typeof response === 'object') {
          console.log('Propiedades de la respuesta:', Object.keys(response));
        }
        
        console.log('✅ Caso enviado exitosamente a n8n (legacy)');
      } catch (err2: any) {
        console.error('❌ ========== ERROR AL ENVIAR A N8N (LEGACY) ==========');
        console.error('Error completo:', err2);
        console.error('Tipo de error:', typeof err2);
        console.error('Mensaje:', err2?.message);
        console.error('Stack:', err2?.stack);
        if (err2?.response) {
          console.error('Response del error:', err2.response);
        }
        console.warn('⚠️ Error al crear caso en n8n, usando modo local como fallback.');
      }
    }

    // 2) Crear siempre el caso en local (modo demo / sin backend disponible)
    const cases = await this.getCases();
    const newId = `CASO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newEntry = {
      ...caseData,
      idCaso: newId,
      id: newId,
      ticketNumber: newId,
      agenteAsignado: MOCK_AGENTES[0],
      agentId: MOCK_AGENTES[0].idAgente,
      agentName: MOCK_AGENTES[0].nombre,
      categoria: { nombre: 'General', slaDias: 2 },
      category: 'General',
      canalOrigen: caseData.contactChannel || caseData.canalOrigen || 'Web',
      origin: caseData.contactChannel || caseData.canalOrigen || 'Web',
      diasAbierto: 0,
      createdAt: new Date().toISOString(),
      historial: [{
        fechaHora: new Date().toISOString(),
        detalle: 'Caso creado manualmente en sistema (local fallback)',
        usuario: this.getUser()?.name || 'Sistema'
      }]
    };
    cases.unshift(newEntry);
    localStorage.setItem('intelfon_cases', JSON.stringify(cases));
    return true;
  },

  async getKPIs(): Promise<KPI> {
    const cases = await this.getCases();
    
    // Calcular SLA Compliance basado en casos reales
    const casosConSLA = cases.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto !== undefined && slaDias > 0;
    });
    
    const casosCumplenSLA = casosConSLA.filter(c => {
      const slaDias = c.categoria?.slaDias || (c as any).categoria?.sla_dias || 5;
      return c.diasAbierto < slaDias;
    });
    
    const slaCompliance = casosConSLA.length > 0 
      ? Math.round((casosCumplenSLA.length / casosConSLA.length) * 100)
      : 100;
    
    // Calcular CSAT promedio si está disponible en los casos
    const casosConCSAT = cases.filter(c => {
      const csat = (c as any).csat_rating || (c as any).csatRating || (c as any).csat;
      return csat && !isNaN(parseFloat(csat)) && parseFloat(csat) > 0;
    });
    
    const csatScore = casosConCSAT.length > 0
      ? casosConCSAT.reduce((sum, c) => {
          const csat = parseFloat((c as any).csat_rating || (c as any).csatRating || (c as any).csat || '0');
          return sum + csat;
        }, 0) / casosConCSAT.length
      : 4.2; // Fallback si no hay datos de CSAT
    
    return {
      totalCases: cases.length,
      slaCompliance,
      csatScore: Math.round(csatScore * 10) / 10 // Redondear a 1 decimal
    };
  },

  async validateSession(): Promise<boolean> {
    // Validar que exista usuario Y token
    // Si no hay token, la sesión no es válida aunque haya usuario en localStorage
    const user = this.getUser();
    const token = this.getToken();
    
    if (!user || !token) {
      // Limpiar datos inválidos
      localStorage.removeItem('intelfon_user');
      localStorage.removeItem('intelfon_token');
      return false;
    }
    
    // Validar que el usuario tenga estructura válida
    if (!user.id || !user.name || !user.role) {
      localStorage.removeItem('intelfon_user');
      localStorage.removeItem('intelfon_token');
      return false;
    }
    
    // Validar que el rol sea válido
    if (!['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(user.role)) {
      localStorage.removeItem('intelfon_user');
      localStorage.removeItem('intelfon_token');
      return false;
    }
    
    return true;
  },

  async getAgentes(): Promise<any[]> {
    return getCachedOrFetch('agentes', async () => {
      // Intentar obtener agentes usando el nuevo roundRobinService (conecta con n8n)
      try {
        const agents = await roundRobinService.getAgents();
        if (agents && agents.length > 0) {
          console.log(`✅ Obtenidos ${agents.length} agentes desde roundRobinService (n8n)`);
          // Guardar en localStorage como cache
          localStorage.setItem('intelfon_agents', JSON.stringify(agents));
          return agents;
        }
      } catch (err: any) {
        // Si es error 404, CORS o Timeout, usar fallback local directamente
        if (err?.message?.includes('404') || err?.message?.includes('CORS') || err?.message?.includes('Timeout')) {
          console.warn('⚠️ Error de conexión con n8n (404/CORS/Timeout), usando fallback local:', err.message);
        } else {
          console.warn('⚠️ Error al obtener agentes desde roundRobinService, usando fallback local:', err);
        }
      }
      
      // Fallback: usar datos locales
      initStorage();
      const data = localStorage.getItem('intelfon_agents');
      return data ? JSON.parse(data) : MOCK_AGENTES;
    });
  },

  // Obtener lista de clientes desde n8n
  async getClientes(): Promise<Cliente[]> {
    return getCachedOrFetch('clientes', async () => {
      const user = this.getUser();
      
      try {
        const response = await callClientsWebhook<any>('POST', {
          action: 'case.list_client',
          actor: buildActorPayload(user),
          data: {
            client: 'all',
          },
        });

        // Función helper para mapear un cliente al formato Cliente
        const mapCliente = (c: any): Cliente => ({
          idCliente: c.cliente_id || c.idCliente || c.id || '',
          nombreEmpresa: c.nombre_empresa || c.nombreEmpresa || c.nombre || '',
          contactoPrincipal: c.contacto_principal || c.contactoPrincipal || c.contacto || '',
          email: c.email || '',
          telefono: c.telefono || c.phone || '',
          pais: c.pais || c.country || 'El Salvador',
          estado: c.estado || c.state || 'Activo',
        });

        // Intentar diferentes formatos de respuesta de n8n
        let clientesArray: any[] = [];

        if (Array.isArray(response)) {
          // Si la respuesta es directamente un array
          clientesArray = response;
        } else if (response?.clients && Array.isArray(response.clients)) {
          // Si viene dentro de una propiedad 'clients'
          clientesArray = response.clients;
        } else if (response?.data && Array.isArray(response.data)) {
          // Si viene dentro de una propiedad 'data'
          clientesArray = response.data;
        } else if (response?.result && Array.isArray(response.result)) {
          // Si viene dentro de una propiedad 'result'
          clientesArray = response.result;
        }

        if (clientesArray.length > 0) {
          const mapped = clientesArray.map(mapCliente);
          console.log(`✅ Obtenidos ${mapped.length} clientes desde n8n`);
          return mapped;
        }

        // Si la respuesta no tiene el formato esperado, usar fallback
        console.warn('Respuesta de n8n no tiene el formato esperado, usando datos mock', response);
        return MOCK_CLIENTES;
      } catch (err) {
        console.warn('Error al obtener clientes desde n8n, usando datos mock como fallback.', err);
        return MOCK_CLIENTES;
      }
    });
  },

  // Obtener cliente por ID (para autocompletar campos)
  async getClienteById(clienteId: string): Promise<Cliente | undefined> {
    // TODO: Cuando esté listo el flujo de n8n, aquí se hará POST al webhook con action: "client.read" y cliente_id
    // Por ahora buscamos en mock
    return MOCK_CLIENTES.find(c => c.idCliente === clienteId);
  },

  // Obtener lista de categorías (por ahora mock, luego se conectará con n8n)
  async getCategorias(): Promise<Categoria[]> {
    // TODO: Cuando esté listo el flujo de n8n, aquí se hará POST al webhook con action: "category.list"
    // Por ahora retornamos datos mock
    return MOCK_CATEGORIAS.filter(cat => cat.activa);
  },

  async updateAgente(id: string, data: any): Promise<boolean> {
    const agentes = await this.getAgentes();
    const idx = agentes.findIndex(a => a.idAgente === id);
    if (idx !== -1) {
      agentes[idx] = { ...agentes[idx], ...data };
      localStorage.setItem('intelfon_agents', JSON.stringify(agentes));
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem('intelfon_user');
    localStorage.removeItem('intelfon_token');
    window.location.href = '#/login';
  },

  // Recuperación de contraseña con webhook (escenario: reset_password)
  async requestPasswordReset(email: string): Promise<boolean> {
    // Intentar usar emailService primero (para desarrollo/testing)
    try {
      const result = emailService.sendPasswordResetCode(email, false);
      console.log('✅ Código de recuperación generado usando emailService');
      // También intentar enviar al webhook si está disponible
      try {
        await callWebhook('reset_password', { 
          email,
          action: 'request_reset' 
        });
      } catch (webhookErr) {
        console.warn('⚠️ Webhook no disponible, usando solo emailService:', webhookErr);
      }
      return true;
    } catch (err) {
      console.warn('⚠️ Error en emailService, intentando solo webhook:', err);
    }
    
    // Fallback: solo webhook
    const data = await callWebhook('reset_password', { 
      email,
      action: 'request_reset' 
    });
    
    // El webhook puede retornar: { success: boolean, message?: string }
    if (data.success === false) {
      throw new Error(data.message || 'Error al solicitar restablecimiento de contraseña');
    }
    
    return true;
  },

  async verifyResetCode(email: string, code: string): Promise<{ ok: boolean; tempToken?: string }> {
    // Intentar usar emailService primero (para desarrollo/testing)
    try {
      const result = emailService.verifyCode(email, code);
      if (result.valid && result.tempToken) {
        console.log('✅ Código verificado usando emailService');
        // También intentar verificar en el webhook si está disponible
        try {
          const webhookData = await callWebhook('reset_password', {
            email,
            code,
            action: 'verify_code'
          });
          if (webhookData.tempToken) {
            return { 
              ok: true, 
              tempToken: webhookData.tempToken 
            };
          }
        } catch (webhookErr) {
          console.warn('⚠️ Webhook no disponible, usando solo emailService:', webhookErr);
        }
        return { 
          ok: true, 
          tempToken: result.tempToken 
        };
      } else {
        throw new Error(result.message || 'Código inválido');
      }
    } catch (err: any) {
      console.warn('⚠️ Error en emailService, intentando solo webhook:', err);
    }
    
    // Fallback: solo webhook
    const data = await callWebhook('reset_password', {
      email,
      code,
      action: 'verify_code'
    });
    
    // El webhook debe retornar: { success: boolean, tempToken?: string, message?: string }
    if (data.success === false) {
      throw new Error(data.message || 'Código de verificación inválido');
    }
    
    if (!data.tempToken) {
      throw new Error('Token temporal no recibido del servidor');
    }
    
    return { 
      ok: true, 
      tempToken: data.tempToken 
    };
  },

  async finalizePasswordReset(email: string, token: string, password: string): Promise<boolean> {
    const data = await callWebhook('reset_password', {
      email,
      tempToken: token,
      password,
      action: 'finalize_reset'
    });
    
    // El webhook debe retornar: { success: boolean, message?: string }
    if (data.success === false) {
      throw new Error(data.message || 'Error al restablecer la contraseña');
    }
    
    return true;
  },

  // Crear nueva cuenta de agente con webhook de agentes
  // SOLO el supervisor puede crear cuentas, y DEBE pasar por el webhook de n8n
  // El agente se almacena directamente en el sistema a través del webhook
  async createAccount(email: string, password: string, name: string, additionalData?: any): Promise<User> {
    // Validaciones previas
    if (!email || !email.trim()) {
      throw new Error('El correo electrónico es requerido');
    }
    if (!password || !password.trim() || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    if (!name || !name.trim()) {
      throw new Error('El nombre es requerido');
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Formato de correo electrónico inválido');
    }

    // Obtener el usuario actual (actor)
    const currentUser = this.getUser();
    if (!currentUser) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor
    const actor = buildActorPayload(currentUser);

    // Construir el payload según el formato del webhook de agentes
    const payload = {
      action: 'agent.create',
      actor: {
        user_id: Number(actor.user_id) || 0,
        email: actor.email,
        role: actor.role
      },
      data: {
        agent_id: '', // Vacío para crear nuevo agente
        nombre: name.trim(),
        email: email.trim().toLowerCase(),
        pais: additionalData?.pais || 'El Salvador',
        rol: additionalData?.rol || 'AGENTE',
        estado: additionalData?.estado || 'ACTIVO',
        password: password.trim() // Incluir la contraseña para que el webhook la almacene
      }
    };

    console.log('📤 Creando agente con payload:', JSON.stringify(payload, null, 2));

    // Llamar al webhook de Round Robin (que también maneja la creación de agentes)
    // El webhook de agentes no está registrado, así que usamos el de Round Robin
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const response = await fetch(API_CONFIG.WEBHOOK_ROUND_ROBIN_URL, {
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
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📥 Respuesta del webhook de Round Robin (crear agente):', result);

      // Verificar si hay error en la respuesta
      if (result.error === true) {
        throw new Error(result.message || 'Error al crear el agente');
      }

      // El webhook puede retornar el agente creado o un mensaje de éxito
      // Si retorna el agente, usarlo; si no, crear un objeto básico
      const agentData = result.agent || result.data || result;
      
      // Crear un objeto User desde los datos del agente
      const user: User = {
        id: agentData.agent_id || agentData.id || `agent-${Date.now()}`,
        name: agentData.nombre || name.trim(),
        role: (agentData.rol || 'AGENTE') as Role,
        avatar: agentData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0f172a&color=fff`
      };

      // Validar que el rol sea válido
      if (!['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(user.role)) {
        throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
      }

      // No almacenar el token ni el usuario en localStorage porque esto es para crear agentes, no para autenticarse
      // El agente creado aparecerá en la lista de agentes cuando se recargue

      return user;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Timeout: El servidor no respondió a tiempo. Verifica tu conexión.');
      }
      
      if (error.message) {
        throw error;
      }
      
      throw new Error('Error de conexión con el servidor.');
    }
  }
};
