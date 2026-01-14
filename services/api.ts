
import { Case, CaseStatus, KPI, User, Role, Cliente, Categoria } from '../types';
import { MOCK_CASOS, MOCK_AGENTES, MOCK_USERS, MOCK_CLIENTES, MOCK_CATEGORIAS } from './mockData';
import { API_CONFIG, CASES_WEBHOOK_URL, CLIENTS_WEBHOOK_URL } from '../config';
import { emailService } from './emailService';
import * as caseService from './caseService';

// Sistema de caché simple para evitar llamadas redundantes
interface CacheEntry {
  data: any;
  timestamp: number;
  promise?: Promise<any>;
}

const CACHE_DURATION = 0; // Sin caché para agentes (siempre recalcular round robin)
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
  
  // Guardar el email usado para login en sessionStorage (se limpia al cerrar sesión)
  sessionStorage.setItem('intelfon_user_email', email.trim().toLowerCase());
  
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
  'admin@intelfon.com': { role: 'ADMIN', name: 'Admin Demo' },
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
    role: demoAccount.role as Role,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(demoAccount.name)}&background=0f172a&color=fff`
  };

  // Generar un token demo simple
  const demoToken = `demo-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Guardar el email usado para login en sessionStorage (se limpia al cerrar sesión)
  sessionStorage.setItem('intelfon_user_email', emailLower);
  
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
      sessionStorage.removeItem('intelfon_user_email');
      
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

    // Actualizar usando caseService (conecta con n8n)
    // NO usar fallback local, si falla debe lanzar error
    await caseService.updateCaseStatus(id, status, detail || `Cambio de estado a ${status}`);
    console.log('✅ Caso actualizado exitosamente usando caseService');
    
    // Limpiar caché de casos para forzar actualización
    clearCache('cases');
    
    return true;
  },

  async createCase(caseData: any): Promise<boolean> {
    const user = this.getUser();

    console.log('🔵 ========== [api.createCase] INICIANDO ==========');
    console.log('📦 Datos recibidos del formulario:', JSON.stringify(caseData, null, 2));
    console.log('👤 Usuario:', JSON.stringify(user, null, 2));

    // Inicializar agenteAsignado para que esté disponible en todo el scope
    let agenteAsignado: any = null;

    // 1) Intentar crear el caso usando el nuevo caseService (conecta con n8n)
    try {
      console.log('🌐 ========== INICIANDO CREACIÓN DE CASO ==========');
      console.log('📤 Datos que se enviarán al webhook:');
      const dataToSend = {
        clienteId: caseData.clienteId || '',
        categoriaId: caseData.categoriaId || '7',
        categoriaNombre: caseData.categoriaNombre || caseData.categoria?.nombre || caseData.categoryName || '',
        contactChannel: caseData.contactChannel || caseData.canalOrigen || 'Web',
        subject: caseData.subject,
        description: caseData.description,
        clientEmail: caseData.clientEmail || '',
        clientName: caseData.clientName || caseData.nombreEmpresa || 'Por definir',
        contactName: caseData.contactName || caseData.contactoPrincipal || caseData.clientName || 'Por definir',
        phone: caseData.phone || caseData.clientPhone || caseData.telefono || '',
        notificationChannel: caseData.notificationChannel || caseData.contactChannel || caseData.canalNotificacion || 'Email',
        ...caseData
      };
      console.log(JSON.stringify(dataToSend, null, 2));
      console.log('🌐 Llamando a caseService.createCase...');
      console.log('🌐 Usuario que crea el caso:', user?.role);
      console.log('🌐 Si el usuario es AGENTE, el webhook asignará el caso a ese agente automáticamente');
      console.log('🌐 Si el usuario es SUPERVISOR o GERENTE, el webhook hará Round Robin');
      
      const newCase = await caseService.createCase(dataToSend);
      
      console.log('✅ ========== CASO CREADO EXITOSAMENTE ==========');
      console.log('📥 ========== RESPUESTA COMPLETA DEL WEBHOOK ==========');
      console.log('📥 Tipo de respuesta:', typeof newCase);
      console.log('📥 Es array?:', Array.isArray(newCase));
      console.log('📥 Tiene propiedades?:', newCase && typeof newCase === 'object' ? Object.keys(newCase) : 'N/A');
      console.log('📥 OBJETO COMPLETO (JSON):');
      console.log(JSON.stringify(newCase, null, 2));
      console.log('📥 OBJETO COMPLETO (RAW):');
      console.log(newCase);
      console.log('📥 ================================================');
      
      console.log('🔍 ========== DESGLOSE DE CAMPOS DEL CASO ==========');
      console.log('🔍 ID del caso:', newCase.id || newCase.ticketNumber);
      console.log('🔍 CLIENTE:');
      console.log('  - clientId:', newCase.clientId);
      console.log('  - clientName:', newCase.clientName);
      console.log('  - clientEmail:', newCase.clientEmail);
      console.log('  - clientPhone:', newCase.clientPhone);
      console.log('  - Objeto cliente completo:', newCase.cliente);
      console.log('🔍 AGENTE:');
      console.log('  - agentId:', newCase.agentId);
      console.log('  - agentName:', newCase.agentName);
      console.log('  - Objeto agenteAsignado:', newCase.agenteAsignado);
      console.log('🔍 OTROS DATOS:');
      console.log('  - status:', newCase.status);
      console.log('  - subject:', newCase.subject);
      console.log('  - description:', newCase.description);
      console.log('  - category:', newCase.category);
      console.log('  - origin:', newCase.origin);
      console.log('  - createdAt:', newCase.createdAt);
      console.log('  - historial:', newCase.historial);
      console.log('🔍 ================================================');
      
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

    // Obtener agentes para la asignación
    console.log('👤 ========== ASIGNACIÓN DE AGENTE ==========');
    console.log('Usuario actual:', user);
    console.log('Rol del usuario:', user?.role);
    
    const agentes = await this.getAgentes();
    console.log('📋 Agentes disponibles:', agentes.map(a => ({ id: a.idAgente, nombre: a.nombre, email: a.email, estado: a.estado })));
    
    // Determinar agente asignado según el rol del usuario que crea el caso
    if (user?.role === 'AGENTE') {
      // Si es un agente, asignar el caso a él mismo
      console.log('🔍 Buscando agente con email:', user.email, 'o ID:', user.id);
      
      agenteAsignado = agentes.find(a => 
        a.email?.toLowerCase() === user.email?.toLowerCase() || 
        a.idAgente === user.id
      );
      
      if (!agenteAsignado) {
        console.warn('⚠️ No se encontró el agente actual en la lista, usando primer agente disponible');
        agenteAsignado = agentes.find(a => a.estado === 'Activo') || agentes[0];
      } else {
        console.log('✅ Agente creó su propio caso. Asignado a:', agenteAsignado.nombre, '(ID:', agenteAsignado.idAgente, ')');
      }
    } else {
      // Si es supervisor o gerente, usar round robin (primer agente activo con menos casos)
      const agentesActivos = agentes.filter(a => a.estado === 'Activo');
      agenteAsignado = agentesActivos.length > 0 ? agentesActivos[0] : agentes[0];
      console.log('✅ Supervisor/Gerente creó caso. Usando round robin. Asignado a:', agenteAsignado?.nombre, '(ID:', agenteAsignado?.idAgente, ')');
    }
    
    console.log('📌 Agente final asignado:', agenteAsignado);
    console.log('==========================================');

    // Construir el payload completo para n8n
    const actorPayload = buildActorPayload(user);
    
    // Construir objeto cliente solo si hay clienteId, sino enviar valores por defecto
    const clienteData = {
      cliente_id: caseData.clienteId || 'N/A', // No generar ID aleatorio
      nombre_empresa: caseData.clientName || 'Por definir',
      contacto_principal: caseData.contactName || caseData.clientName || 'Por definir',
      email: caseData.clientEmail || '',
      telefono: caseData.phone || '',
    };
    
    const n8nPayload = {
      action: 'case.create',
      actor: actorPayload,
      data: {
        cliente: clienteData,
        categoria: {
          categoria_id: categoriaId,
          nombre: categoriaNombre,
        },
        canal_origen: caseData.contactChannel || caseData.canalOrigen || 'Web',
        canal_notificacion: caseData.notificationChannel || caseData.contactChannel || 'Email',
        asunto: caseData.subject,
        descripcion: caseData.description,
        // El backend procesa el correo del agente para asignar, usar email si está disponible
        // Si el actor es un AGENTE, el webhook automáticamente asignará el caso a ese agente (sin round robin)
        // Si el actor es SUPERVISOR o GERENTE, el webhook hará Round Robin automáticamente
        agente_email: caseData.agentEmail || caseData.agenteEmail || actorPayload.email || '',
        agente_id: agenteAsignado?.idAgente || agenteAsignado?.id || '',
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
      // NO asignar agente localmente - el Round Robin de n8n lo asignará
      agentId: '',
      agentName: 'Sin asignar',
      categoria: { nombre: 'General', slaDias: 2 },
      category: 'General',
      canalOrigen: caseData.contactChannel || caseData.canalOrigen || 'Web',
      origin: caseData.contactChannel || caseData.canalOrigen || 'Web',
      diasAbierto: 0,
      createdAt: new Date().toISOString(),
      historial: [{
        tipo_evento: "CREADO",
        justificacion: "Caso creado",
        autor_nombre: "Sistema",
        autor_rol: "sistema",
        fecha: new Date().toISOString()
      }],
      history: [{
        tipo_evento: "CREADO",
        justificacion: "Caso creado",
        autor_nombre: "Sistema",
        autor_rol: "sistema",
        fecha: new Date().toISOString()
      }]
    };
    cases.unshift(newEntry);
    localStorage.setItem('intelfon_cases', JSON.stringify(cases));
    
    // Limpiar caché para que el dashboard actualice
    clearCache('cases');
    console.log('✅ Caso creado exitosamente:', newId);
    
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
    
    // Si no hay casos con SLA, no puede ser 100%, debe ser null o 0
    const slaCompliance = casosConSLA.length > 0 
      ? Math.round((casosCumplenSLA.length / casosConSLA.length) * 100)
      : null;
    
    // Calcular CSAT promedio si está disponible en los casos
    const casosConCSAT = cases.filter(c => {
      const csat = (c as any).csat_rating || (c as any).csatRating || (c as any).csat;
      return csat && !isNaN(parseFloat(csat)) && parseFloat(csat) > 0;
    });
    
    // Si no hay datos de CSAT, retornar null en lugar de un valor mock
    const csatScore = casosConCSAT.length > 0
      ? casosConCSAT.reduce((sum, c) => {
          const csat = parseFloat((c as any).csat_rating || (c as any).csatRating || (c as any).csat || '0');
          return sum + csat;
        }, 0) / casosConCSAT.length
      : null; // No usar fallback, retornar null si no hay datos
    
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
      const currentUser = this.getUser();
      
      if (!currentUser) {
        // Si no hay usuario, usar datos locales
    initStorage();
    const data = localStorage.getItem('intelfon_agents');
    return data ? JSON.parse(data) : MOCK_AGENTES;
      }

      const actor = buildActorPayload(currentUser);

      // Construir el payload según el formato del webhook de agentes
      const payload = {
        action: 'agent.read',
        actor: {
          user_id: Number(actor.user_id) || 0,
          email: actor.email,
          role: actor.role
        },
        data: {
          agent_id: 'all'
        }
      };

      console.log('📤 Consultando agentes con payload:', JSON.stringify(payload, null, 2));

      // Llamar al webhook de agentes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      try {
        const response = await fetch(API_CONFIG.WEBHOOK_AGENTES_URL, {
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
        console.log('📥 Respuesta del webhook de agentes (agent.read):', result);

        // Verificar si hay error en la respuesta
        if (result.error === true) {
          throw new Error(result.message || 'Error al obtener los agentes');
        }

        // Mapear la respuesta a un array de agentes
        // El webhook puede retornar diferentes formatos:
        // 1. { agents: [...] } o { agentes: [...] }
        // 2. Array directo de agentes
        // 3. [{ data: [...] }] - estructura anidada
        // 4. { data: [...] } - estructura con data
        let agents: any[] = [];
        
        if (result.agents) {
          agents = result.agents;
        } else if (result.agentes) {
          agents = result.agentes;
        } else if (result.data && Array.isArray(result.data)) {
          agents = result.data;
        } else if (Array.isArray(result)) {
          // Si es un array, puede ser directamente agentes o [{ data: [...] }]
          if (result.length > 0 && result[0]?.data && Array.isArray(result[0].data)) {
            // Formato: [{ data: [...] }]
            agents = result[0].data;
          } else {
            // Formato: [agente1, agente2, ...]
            agents = result;
          }
        }
        
        console.log('📋 Agentes extraídos:', agents);
        
        if (Array.isArray(agents) && agents.length > 0) {
          // Mapear los agentes al formato esperado por el frontend
          let mappedAgents = agents.map((agente: any) => {
            // Determinar el estado: el webhook puede retornar "ACTIVO", "INACTIVO", "VACACIONES"
            let estado: 'Activo' | 'Inactivo' | 'Vacaciones' = 'Inactivo';
            const estadoRaw = agente.estado || agente.state || '';
            if (estadoRaw.toUpperCase() === 'ACTIVO' || estadoRaw === 'Activo') {
              estado = 'Activo';
            } else if (estadoRaw.toUpperCase() === 'VACACIONES' || estadoRaw === 'Vacaciones') {
              estado = 'Vacaciones';
            } else {
              estado = 'Inactivo';
            }
            
            // Parsear fecha del último caso asignado (puede venir en formato DD/MM/YYYY)
            let ultimoCasoAsignado = agente.ultimo_caso_asignado || agente.ultimoCasoAsignado || new Date().toISOString();
            if (ultimoCasoAsignado && typeof ultimoCasoAsignado === 'string' && ultimoCasoAsignado.includes('/')) {
              // Formato DD/MM/YYYY
              const [day, month, year] = ultimoCasoAsignado.split('/');
              if (day && month && year) {
                ultimoCasoAsignado = new Date(`${year}-${month}-${day}`).toISOString();
              }
            }
            
            // Mapear campos del webhook al formato Agente
            return {
              idAgente: agente.id_agente || agente.idAgente || agente.id || '',
              nombre: agente.nombre || agente.name || '',
              email: agente.email || '',
              estado: estado,
              ordenRoundRobin: 999, // Se calculará después
              ultimoCasoAsignado: ultimoCasoAsignado,
              casosActivos: agente.casos_activos !== undefined ? agente.casos_activos : (agente.casosActivos || agente.casos_asignados || 0)
            };
          }).filter((agente: any) => agente.idAgente); // Filtrar agentes sin ID
          
          // Calcular el orden Round Robin en el frontend
          // Lógica: 1. Menor cantidad de casos activos = mayor prioridad
          //         2. Si hay empate, el que tenga el caso más antiguo (fecha más antigua) = mayor prioridad
          try {
            const casos = await this.getCases();
            
            // Contar casos activos por agente y obtener fecha del último caso
            const agentesConCasos = mappedAgents.map(agente => {
              const casosAgente = casos.filter(c => 
                (c.agenteAsignado?.idAgente === agente.idAgente || c.agentId === agente.idAgente) &&
                c.status !== CaseStatus.RESUELTO && c.status !== CaseStatus.CERRADO
              );
              
              const casosActivos = casosAgente.length;
              
              // Obtener la fecha del caso más antiguo (último caso asignado)
              let fechaUltimoCaso = new Date(agente.ultimoCasoAsignado);
              if (casosAgente.length > 0) {
                const fechasCasos = casosAgente
                  .map(c => new Date(c.createdAt))
                  .filter(d => !isNaN(d.getTime()));
                
                if (fechasCasos.length > 0) {
                  // La fecha más antigua (menor timestamp)
                  fechaUltimoCaso = new Date(Math.min(...fechasCasos.map(d => d.getTime())));
                }
              }
              
              return {
                ...agente,
                casosActivos: casosActivos, // Usar casos reales del sistema
                ultimoCasoAsignado: fechaUltimoCaso.toISOString(),
                _fechaUltimoCaso: fechaUltimoCaso.getTime() // Para ordenamiento
              };
            });
            
            // Separar agentes activos de inactivos
            const agentesActivos = agentesConCasos.filter(a => a.estado === 'Activo');
            const agentesInactivos = agentesConCasos.filter(a => a.estado !== 'Activo');
            
            // Ordenar solo los agentes activos por casos activos (menor primero), luego por fecha más antigua
            agentesActivos.sort((a, b) => {
              // Ordenar por casos activos (menor cantidad primero)
              if (a.casosActivos !== b.casosActivos) {
                return a.casosActivos - b.casosActivos; // Menor cantidad = mayor prioridad
              }
              
              // Si tienen la misma cantidad de casos, ordenar por fecha más antigua primero
              return a._fechaUltimoCaso - b._fechaUltimoCaso;
            });
            
            // Asignar orden round robin (1, 2, 3, ...) solo a agentes activos
            const agentesActivosConOrden = agentesActivos.map((agente, index) => ({
              ...agente,
              ordenRoundRobin: index + 1
            }));
            
            // Asignar orden 999 a agentes inactivos
            const agentesInactivosConOrden = agentesInactivos.map(agente => ({
              ...agente,
              ordenRoundRobin: 999
            }));
            
            // Combinar: primero activos ordenados, luego inactivos
            mappedAgents = [...agentesActivosConOrden, ...agentesInactivosConOrden];
            
            console.log('✅ Orden Round Robin calculado:', mappedAgents.map(a => ({
              nombre: a.nombre,
              orden: a.ordenRoundRobin,
              casosActivos: a.casosActivos,
              ultimoCaso: a.ultimoCasoAsignado
            })));
          } catch (error) {
            console.warn('⚠️ Error calculando orden Round Robin, usando valores del webhook:', error);
            // Si falla, mantener los valores originales
          }
          
          console.log('✅ Agentes mapeados:', mappedAgents);
          
          // Guardar en localStorage como cache
          localStorage.setItem('intelfon_agents', JSON.stringify(mappedAgents));
          return mappedAgents;
        }

        // Si no hay agentes, usar fallback local
        console.warn('⚠️ No se recibieron agentes del webhook, usando fallback local');
        initStorage();
        const data = localStorage.getItem('intelfon_agents');
        return data ? JSON.parse(data) : MOCK_AGENTES;
      } catch (err: any) {
        console.warn('⚠️ Error al obtener agentes desde webhook, usando fallback local:', err.message || err);
        // Fallback: usar datos locales
        initStorage();
        const data = localStorage.getItem('intelfon_agents');
        return data ? JSON.parse(data) : MOCK_AGENTES;
      }
    });
  },

  // Obtener lista de usuarios desde el webhook de crear usuario
  // Este webhook retorna TODOS los usuarios creados desde ese flujo
  async getUsuarios(): Promise<any[]> {
    return getCachedOrFetch('usuarios', async () => {
      const currentUser = this.getUser();
      
      if (!currentUser) {
        console.warn('⚠️ No hay usuario autenticado, retornando array vacío');
        return [];
      }

      const actor = buildActorPayload(currentUser);

      // Construir el payload para listar usuarios
      const payload = {
        action: 'user.read',
        actor: {
          user_id: Number(actor.user_id) || 0,
          email: actor.email,
          role: actor.role
        },
        data: {
          id: "all"
        }
      };

      console.log('📤 Consultando usuarios con payload:', JSON.stringify(payload, null, 2));

      // Llamar al webhook de crear usuario (que también lista usuarios)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      try {
        const response = await fetch(API_CONFIG.WEBHOOK_CREAR_USUARIO_URL, {
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
        console.log('📥 Respuesta del webhook de usuarios:', JSON.stringify(result, null, 2));

        // Verificar si hay error en la respuesta
        if (result.error === true) {
          throw new Error(result.message || 'Error al obtener los usuarios');
        }

        // El webhook puede retornar diferentes formatos:
        // 1. { users: [...] } o { usuarios: [...] }
        // 2. Array directo de usuarios
        // 3. { data: [...] } - estructura con data
        // 4. [{ data: [...] }] - array con objeto que contiene data
        let usuarios: any[] = [];
        
        if (Array.isArray(result)) {
          console.log('📋 Resultado es un array, verificando estructura...');
          // Si es un array, verificar si el primer elemento tiene una propiedad "data"
          if (result.length > 0 && result[0] && typeof result[0] === 'object' && 'data' in result[0]) {
            console.log('📋 Array contiene objeto con propiedad "data", extrayendo...');
            // Es un array como [{ data: [...] }], extraer el array interno
            if (Array.isArray(result[0].data)) {
              usuarios = result[0].data;
              console.log('✅ Usuarios extraídos de result[0].data:', usuarios.length);
            } else {
              console.warn('⚠️ result[0].data no es un array');
              usuarios = result;
            }
          } else {
            console.log('📋 Array directo de usuarios');
            usuarios = result;
          }
        } else if (result.users && Array.isArray(result.users)) {
          console.log('📋 Usuarios en result.users');
          usuarios = result.users;
        } else if (result.usuarios && Array.isArray(result.usuarios)) {
          console.log('📋 Usuarios en result.usuarios');
          usuarios = result.usuarios;
        } else if (result.data && Array.isArray(result.data)) {
          console.log('📋 Usuarios en result.data');
          usuarios = result.data;
        } else if (result.data && result.data.users && Array.isArray(result.data.users)) {
          console.log('📋 Usuarios en result.data.users');
          usuarios = result.data.users;
        } else if (result.data && result.data.usuarios && Array.isArray(result.data.usuarios)) {
          console.log('📋 Usuarios en result.data.usuarios');
          usuarios = result.data.usuarios;
        } else {
          console.warn('⚠️ No se pudo identificar la estructura de usuarios en la respuesta');
        }

        console.log('✅ Usuarios obtenidos:', usuarios.length);
        console.log('📋 Lista de usuarios:', JSON.stringify(usuarios, null, 2));

        return usuarios;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Timeout: El servidor no respondió a tiempo. Verifica tu conexión.');
        }
        
        console.error('❌ Error al obtener usuarios desde webhook:', error.message || error);
        throw error;
      }
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
        contactoPrincipal: c.contacto_principal || c.contactoPrincipal || c.contacto || 'N/A',
        email: c.email || c.correo || 'sin-email@cliente.com',
        telefono: c.telefono || c.phone || c.tel || 'N/A',
        pais: c.pais || c.country || 'El Salvador',
        estado: c.estado || c.state || c.status || 'ACTIVO',
      });

      // Intentar diferentes formatos de respuesta de n8n
      let clientesArray: any[] = [];

      if (Array.isArray(response)) {
        // Verificar si el primer elemento tiene una propiedad 'data'
        if (response.length > 0 && response[0]?.data && Array.isArray(response[0].data)) {
          clientesArray = response[0].data;
        } else {
        // Si la respuesta es directamente un array
        clientesArray = response;
        }
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
    console.log('🔵 [updateAgente] Actualizando agente:', id);
    console.log('📝 [updateAgente] Datos a actualizar:', data);
    
    // Obtener el usuario actual (actor)
    const currentUser = this.getUser();
    if (!currentUser) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor
    const actor = buildActorPayload(currentUser);

    // Construir el payload para el webhook de agentes
    // Solo enviar agent_id y estado (uno de: Activo/Inactivo/Vacaciones)
    const payload = {
      action: 'agent.update',
      actor: {
        user_id: Number(actor.user_id) || 0,
        email: actor.email,
        role: actor.role
      },
      data: {
        agent_id: id,
        estado: data.estado // Puede ser: "Activo", "Inactivo" o "Vacaciones"
      }
    };

    console.log('📤 [updateAgente] Payload enviado al webhook:', JSON.stringify(payload, null, 2));

    try {
      // Enviar actualización al webhook de agentes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

      const response = await fetch(API_CONFIG.WEBHOOK_AGENTES_URL, {
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
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📥 [updateAgente] Respuesta del webhook:', result);

      // Limpiar caché para forzar recarga
      clearCache('agents');
      
      return true;
    } catch (error: any) {
      console.error('❌ [updateAgente] Error al actualizar agente en webhook:', error);
      
      // Fallback: actualizar en localStorage
      console.warn('⚠️ [updateAgente] Actualizando solo en localStorage como fallback');
      const agentes = await this.getAgentes();
      const idx = agentes.findIndex(a => a.idAgente === id);
      if (idx !== -1) {
        agentes[idx] = { ...agentes[idx], ...data };
        localStorage.setItem('intelfon_agents', JSON.stringify(agentes));
        return true;
      }
      
      throw error;
    }
  },

  logout() {
    localStorage.removeItem('intelfon_user');
    localStorage.removeItem('intelfon_token');
    sessionStorage.removeItem('intelfon_user_email');
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

  // Crear nueva cuenta de usuario con webhook de crear usuario
  // El usuario se almacena directamente en el sistema a través del webhook
  async createAccount(email: string, password: string, name: string, additionalData?: any): Promise<User> {
    console.log('🔵 [API] createAccount iniciada');
    console.log('📧 [API] Email:', email);
    console.log('👤 [API] Nombre:', name);
    console.log('📦 [API] Datos adicionales:', additionalData);

    // Validaciones previas
    if (!email || !email.trim()) {
      throw new Error('El correo electrónico es requerido');
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

    // Generar contraseña aleatoria si no se proporciona
    // Formato: red + 4 dígitos + 4 letras (igual que cuando se crea un agente en Register)
    const generarPasswordAleatoria = () => {
      const randomNumber = Math.floor(Math.random() * 9000) + 1000; // Número de 4 dígitos (1000-9999)
      const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let randomLetters = '';
      for (let i = 0; i < 4; i++) {
        randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      return `red${randomNumber}${randomLetters}`; // Ejemplo: red7453aBcD
    };

    const passwordFinal = password && password.trim() ? password.trim() : generarPasswordAleatoria();
    console.log('🔐 [API] Contraseña generada:', passwordFinal);

    // Determinar si es un agente o un usuario administrativo
    const rolUsuario = additionalData?.rol || 'AGENTE';
    const esAgente = rolUsuario === 'AGENTE';
    
    // Construir el payload según el tipo de usuario
    let payload: any;
    let webhookUrl: string;
    
    if (esAgente) {
      // Para AGENTES: usar agent.create y webhook de agentes
      console.log('👤 [API] Creando AGENTE con agent.create');
      payload = {
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
          rol: 'AGENTE',
          estado: additionalData?.estado || 'ACTIVO',
          password: passwordFinal
        }
      };
      webhookUrl = API_CONFIG.WEBHOOK_AGENTES_URL;
      console.log('🔗 [API] Usando webhook de agentes:', webhookUrl);
    } else {
      // Para usuarios administrativos (SUPERVISOR, GERENTE, ADMINISTRADOR): usar user.create
      console.log('👤 [API] Creando usuario administrativo con user.create');
      payload = {
        action: 'user.create',
        actor: {
          user_id: Number(actor.user_id) || 0,
          email: actor.email,
          role: actor.role
        },
        data: {
          nombre: name.trim(),
          email: email.trim().toLowerCase(),
          password: passwordFinal,
          role: rolUsuario
        }
      };
      webhookUrl = API_CONFIG.WEBHOOK_CREAR_USUARIO_URL;
      console.log('🔗 [API] Usando webhook de crear usuario:', webhookUrl);
    }

    console.log('📤 Creando usuario con payload:', JSON.stringify(payload, null, 2));
    
    // Llamar al webhook correspondiente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      console.log('🌐 [API] Iniciando fetch a:', webhookUrl);
      const response = await fetch(webhookUrl, {
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

      console.log('✅ [API] Response status:', response.status, response.statusText);
      console.log('📋 [API] Response headers:', [...response.headers.entries()]);

      if (!response.ok) {
        if (response.status === 0) {
          throw new Error('Error de CORS: El servidor no está permitiendo peticiones desde este origen.');
        }
        const errorText = await response.text();
        console.log('❌ [API] Error response text:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `Error ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
      }

      // Verificar si la respuesta tiene contenido antes de parsear JSON
      const contentType = response.headers.get('content-type');
      console.log('📄 [API] Content-Type:', contentType);
      
      const responseText = await response.text();
      console.log('📥 [API] Response text:', responseText);

      if (!responseText || responseText.trim() === '') {
        throw new Error('El webhook no devolvió ninguna respuesta. Verifica que el flujo de n8n esté configurado correctamente y devuelva los datos del usuario creado.');
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('📥 Respuesta del webhook de crear usuario:', JSON.stringify(result, null, 2));
      } catch (parseError) {
        console.error('❌ [API] Error al parsear JSON:', parseError);
        console.error('📄 [API] Texto recibido:', responseText);
        throw new Error(`El webhook devolvió una respuesta inválida. Respuesta: ${responseText.substring(0, 200)}`);
      }

      // Verificar si hay error en la respuesta
      if (result.error === true) {
        throw new Error(result.message || 'Error al crear el usuario');
    }

      // El webhook puede retornar:
      // 1. Un solo usuario creado: result.user, result.agent o result.data
      // 2. Una lista de usuarios: result.users o result.data (array)
      let userData = result.user || result.agent || result.data || result;
      
      // Si el webhook retorna un array de usuarios
      if (Array.isArray(userData)) {
        console.log('📋 El webhook retornó una lista de usuarios:', userData.length);
        console.log('👥 Todos los usuarios del flujo:', JSON.stringify(userData, null, 2));
        
        // Buscar el usuario recién creado (el último o el que coincida con el email)
        const emailLower = email.trim().toLowerCase();
        userData = userData.find((u: any) => 
          (u.email || '').toLowerCase() === emailLower
        ) || userData[userData.length - 1] || userData[0];
        
        console.log('✅ Usuario recién creado extraído:', userData);
      }
      
      // Crear un objeto User desde los datos del usuario
    const user: User = {
        id: userData.user_id || userData.agent_id || userData.id || userData.idAgente || userData.id_agente || `user-${Date.now()}`,
        name: userData.nombre || userData.name || name.trim(),
        role: (userData.role || userData.rol || 'AGENTE') as Role,
        avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0f172a&color=fff`
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
  },

  async reassignCase(caseId: string, newAgentId: string, justification: string): Promise<boolean> {
    const user = this.getUser();
    const cases = await this.getCases();
    const idx = cases.findIndex((c: any) => (c.id === caseId || c.idCaso === caseId || c.ticketNumber === caseId));
    
    if (idx === -1) {
      throw new Error('Caso no encontrado');
    }

    const caso = cases[idx];
    const agentes = await this.getAgentes();
    const nuevoAgente = agentes.find((a: any) => a.idAgente === newAgentId || a.id === newAgentId);
    
    if (!nuevoAgente) {
      throw new Error('Agente no encontrado');
    }

    const agenteAnterior = caso.agenteAsignado?.nombre || caso.agentName || 'Sin asignar';
    const agenteNuevo = nuevoAgente.nombre;

    // Actualizar agente asignado
    cases[idx].agenteAsignado = nuevoAgente;
    cases[idx].agentId = nuevoAgente.idAgente;
    cases[idx].agentName = nuevoAgente.nombre;

    // Registrar en historial
    if (!cases[idx].historial) cases[idx].historial = [];
    const detalleCompleto = justification || `Reasignación de "${agenteAnterior}" a "${agenteNuevo}"`;
    cases[idx].historial.unshift({
      fechaHora: new Date().toISOString(),
      detalle: detalleCompleto,
      usuario: this.getUser()?.name || 'Sistema'
    });

    // Intentar actualizar en el backend
    try {
      await callCasesWebhook('POST', {
        action: 'case.update',
        actor: buildActorPayload(user),
        data: {
          case_id: caseId,
          patch: {
            agente_id: newAgentId,
            descripcion: detalleCompleto
          }
        }
      });
    } catch (err) {
      console.warn('Error al actualizar reasignación en n8n, aplicando cambio solo en local.', err);
    }

    localStorage.setItem('intelfon_cases', JSON.stringify(cases));
    clearCache('cases');
    return true;
  },

  async addCaseComment(caseId: string, comment: string): Promise<boolean> {
    const user = this.getUser();
    const cases = await this.getCases();
    const idx = cases.findIndex((c: any) => (c.id === caseId || c.idCaso === caseId || c.ticketNumber === caseId));
    
    if (idx === -1) {
      throw new Error('Caso no encontrado');
    }

    if (!comment || !comment.trim()) {
      throw new Error('El comentario no puede estar vacío');
    }

    // Registrar comentario en historial
    if (!cases[idx].historial) cases[idx].historial = [];
    cases[idx].historial.unshift({
      fechaHora: new Date().toISOString(),
      detalle: comment.trim(),
      usuario: this.getUser()?.name || 'Sistema'
    });

    // Intentar actualizar en el backend
    try {
      await callCasesWebhook('POST', {
        action: 'case.update',
        actor: buildActorPayload(user),
        data: {
          case_id: caseId,
          patch: {
            comentario: comment.trim()
          }
        }
      });
    } catch (err) {
      console.warn('Error al actualizar comentario en n8n, aplicando cambio solo en local.', err);
    }

    localStorage.setItem('intelfon_cases', JSON.stringify(cases));
    clearCache('cases');
    return true;
  }
};
