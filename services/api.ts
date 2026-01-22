
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
  usuarios?: CacheEntry;
} = {};

// Helper para obtener datos del caché o hacer la llamada
const getCachedOrFetch = async <T>(
  key: 'cases' | 'clientes' | 'agentes' | 'usuarios',
  fetchFn: () => Promise<T>,
  maxAge: number = CACHE_DURATION
): Promise<T> => {
  const now = Date.now();
  const cached = cache[key];
  
  // Si hay datos en caché y no han expirado, retornarlos
  if (cached && cached.data && (now - cached.timestamp) < maxAge) {
    return cached.data as T;
  }
  
  // Si ya hay una petición en curso, esperar a que termine
  if (cached?.promise) {
    return await cached.promise as T;
  }
  
  // Hacer nueva petición
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
const clearCache = (key?: 'cases' | 'clientes' | 'agentes' | 'usuarios') => {
  if (key) {
    delete cache[key];
  } else {
    Object.keys(cache).forEach(k => delete cache[k as keyof typeof cache]);
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
    if (body) {
      const bodyString = JSON.stringify(body);
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

    if (!response.ok) {
      // Intentar extraer mensaje de error del backend
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      let errorBody = null;
      try {
        const text = await response.text();
        try {
          errorBody = JSON.parse(text);
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
      return undefined as unknown as T;
    }

    const text = await response.text();
    
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch (parseError) {
      data = text as unknown as T;
    }
    
    return data;
  } catch (error: any) {
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
  if (body) {
  }
  
  try {
    const result = await callWebhookGeneric<T>(CASES_WEBHOOK_URL, method, body);
    return result;
  } catch (error: any) {
    if (error?.response) {
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

// Helper para llamadas al webhook de categorías en n8n
const callCategoriesWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  // Usar la URL completa del webhook de categorías o la URL relativa en desarrollo
  const CATEGORIES_WEBHOOK_URL = (import.meta.env as any).VITE_WEBHOOK_CATEGORIAS_URL 
    || API_CONFIG.WEBHOOK_CATEGORIAS_URL_FULL 
    || API_CONFIG.WEBHOOK_CATEGORIAS_URL 
    || '/api/categorias';
  return callWebhookGeneric<T>(CATEGORIES_WEBHOOK_URL, method, body);
};

// Helper para llamar al webhook de estados
const callEstadosWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  // URL del webhook de estados
  const ESTADOS_WEBHOOK_URL = 'https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61';
  console.log('[callEstadosWebhook] Llamando webhook:', {
    url: ESTADOS_WEBHOOK_URL,
    method: method,
    body: body
  });
  console.log('[callEstadosWebhook] Body como JSON:', JSON.stringify(body, null, 2));
  
  try {
    const response = await callWebhookGeneric<T>(ESTADOS_WEBHOOK_URL, method, body);
    console.log('[callEstadosWebhook] Respuesta recibida:', response);
    console.log('[callEstadosWebhook] Tipo de respuesta:', typeof response);
    return response;
  } catch (error: any) {
    console.error('[callEstadosWebhook] Error en la llamada:', error);
    console.error('[callEstadosWebhook] Mensaje de error:', error.message);
    throw error;
  }
};

// Helper para llamar al webhook de asuetos
const callAsuetosWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  // URL del webhook de asuetos
  const ASUETOS_WEBHOOK_URL = 'https://n8n.red.com.sv/webhook/d80b6b0a-b647-475e-8795-c8747a9b72d8';
  console.log('[callAsuetosWebhook] Llamando webhook:', {
    url: ASUETOS_WEBHOOK_URL,
    method: method,
    body: body
  });
  console.log('[callAsuetosWebhook] Body como JSON:', JSON.stringify(body, null, 2));
  
  try {
    const response = await callWebhookGeneric<T>(ASUETOS_WEBHOOK_URL, method, body);
    console.log('[callAsuetosWebhook] Respuesta recibida:', response);
    return response;
  } catch (error: any) {
    console.error('[callAsuetosWebhook] Error en la llamada:', error);
    console.error('[callAsuetosWebhook] Mensaje de error:', error.message);
    throw error;
  }
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
        return cases || [];
      } catch (err: any) {
        // No usar localStorage como fallback, lanzar el error
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
    }

    // Fallback: buscar en la lista de casos
    const cases = await this.getCases();
    return cases.find(c => c.id === id || c.idCaso === id || c.ticketNumber === id);
  },

  async updateCaseStatus(id: string, status: string, detail: string, extra?: any): Promise<boolean> {
    const user = this.getUser();

    // Obtener cliente_id del caso si está disponible en extra o del caso actual
    const clienteId = extra?.clienteId || extra?.cliente_id || extra?.clientId || null;

    // Actualizar usando caseService (conecta con n8n)
    // NO usar fallback local, si falla debe lanzar error
    await caseService.updateCaseStatus(id, status, detail || `Cambio de estado a ${status}`, clienteId || undefined);
    
    // Limpiar caché de casos para forzar actualización
    clearCache('cases');
    
    return true;
  },

  async createCase(caseData: any): Promise<boolean> {
    const user = this.getUser();


    // Inicializar agenteAsignado para que esté disponible en todo el scope
    let agenteAsignado: any = null;

    // 1) Intentar crear el caso usando el nuevo caseService (conecta con n8n)
    try {
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
      
      const newCase = await caseService.createCase(dataToSend);
      
      
      
      // Limpiar caché de casos para forzar actualización
      clearCache('cases');
      return true;
    } catch (err: any) {
      
      // Fallback: Método legacy
    // Buscar la categoría seleccionada
    const categoriaSeleccionada = caseData.categoriaId 
      ? MOCK_CATEGORIAS.find(cat => cat.idCategoria === caseData.categoriaId)
      : null;


    // Determinar categoria_id y nombre para el JSON
    const categoriaId = categoriaSeleccionada 
      ? (typeof categoriaSeleccionada.idCategoria === 'string' ? parseInt(categoriaSeleccionada.idCategoria) || 1 : categoriaSeleccionada.idCategoria)
      : DEFAULT_CATEGORY.categoria_id;
    const categoriaNombre = categoriaSeleccionada?.nombre || DEFAULT_CATEGORY.nombre;


    // Obtener agentes para la asignación
    
    const agentes = await this.getAgentes();
    
    // Determinar agente asignado según el rol del usuario que crea el caso
    if (user?.role === 'AGENTE') {
      // Si es un agente, asignar el caso a él mismo
      
      agenteAsignado = agentes.find(a => 
        a.email?.toLowerCase() === user.email?.toLowerCase() || 
        a.idAgente === user.id
      );
      
      if (!agenteAsignado) {
        agenteAsignado = agentes.find(a => a.estado === 'Activo') || agentes[0];
      } else {
      }
    } else {
      // Si es supervisor o gerente, usar round robin (primer agente activo con menos casos)
      const agentesActivos = agentes.filter(a => a.estado === 'Activo');
      agenteAsignado = agentesActivos.length > 0 ? agentesActivos[0] : agentes[0];
    }
    

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


      // Intentar crear el caso en el backend n8n usando el contrato CRUD.CREATE (no bloquea la creación local)
    try {
      const startTime = Date.now();
      
      const response = await callCasesWebhook('POST', n8nPayload);
      
      const duration = Date.now() - startTime;
      
      if (response && typeof response === 'object') {
      }
      
      } catch (err2: any) {
        if (err2?.response) {
      }
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
          } catch (error) {
            // Si falla, mantener los valores originales
          }
          
          
          // Guardar en localStorage como cache
          localStorage.setItem('intelfon_agents', JSON.stringify(mappedAgents));
          return mappedAgents;
        }

        // Si no hay agentes, usar fallback local
        initStorage();
        const data = localStorage.getItem('intelfon_agents');
        return data ? JSON.parse(data) : MOCK_AGENTES;
      } catch (err: any) {
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
          // Si es un array, verificar si el primer elemento tiene una propiedad "data"
          if (result.length > 0 && result[0] && typeof result[0] === 'object' && 'data' in result[0]) {
            // Es un array como [{ data: [...] }], extraer el array interno
            if (Array.isArray(result[0].data)) {
              usuarios = result[0].data;
            } else {
              usuarios = result;
            }
          } else {
            usuarios = result;
          }
        } else if (result.users && Array.isArray(result.users)) {
          usuarios = result.users;
        } else if (result.usuarios && Array.isArray(result.usuarios)) {
          usuarios = result.usuarios;
        } else if (result.data && Array.isArray(result.data)) {
          usuarios = result.data;
        } else if (result.data && result.data.users && Array.isArray(result.data.users)) {
          usuarios = result.data.users;
        } else if (result.data && result.data.usuarios && Array.isArray(result.data.usuarios)) {
          usuarios = result.data.usuarios;
        } else {
        }


        return usuarios;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('Timeout: El servidor no respondió a tiempo. Verifica tu conexión.');
        }
        
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
          return mapped;
      }

      // Si la respuesta no tiene el formato esperado, usar fallback
      return MOCK_CLIENTES;
    } catch (err) {
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

  // Crear nueva categoría mediante webhook
  async createCategory(categoryData: {
    category_name: string;
    description: string;
    sla: number;
  }): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    const payload = {
      action: 'category.create',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: '', // Vacío según el formato especificado
        category_name: categoryData.category_name,
        description: categoryData.description,
        sla: String(categoryData.sla) // Convertir a string según el formato
      }
    };

    try {
      const response = await callCategoriesWebhook('POST', payload);
      return response;
    } catch (error: any) {
      console.error('Error al crear categoría:', error);
      throw new Error(error.message || 'Error al crear la categoría');
    }
  },

  // Actualizar categoría existente mediante webhook
  async updateCategory(categoryData: {
    id: string;
    category_name: string;
    description: string;
    sla: number;
  }): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    const payload = {
      action: 'category.update',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: categoryData.id,
        category_name: categoryData.category_name || '',
        description: categoryData.description || '',
        sla: String(categoryData.sla) // Convertir a string según el formato
      }
    };

    try {
      const response = await callCategoriesWebhook('POST', payload);
      return response;
    } catch (error: any) {
      console.error('Error al actualizar categoría:', error);
      throw new Error(error.message || 'Error al actualizar la categoría');
    }
  },

  // Eliminar categoría mediante webhook
  async deleteCategory(categoryId: string): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    const payload = {
      action: 'category.delete',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: categoryId
      }
    };

    try {
      const response = await callCategoriesWebhook('POST', payload);
      return response;
    } catch (error: any) {
      console.error('Error al eliminar categoría:', error);
      throw new Error(error.message || 'Error al eliminar la categoría');
    }
  },

  // Leer todas las categorías mediante webhook
  async readCategories(): Promise<any[]> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    // Para obtener todas las categorías, el data.id puede estar vacío o ser "all"
    const payload = {
      action: 'category.read',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: '' // Vacío para obtener todas las categorías
      }
    };

    try {
      const response = await callCategoriesWebhook('POST', payload);
      console.log('Respuesta del webhook category.read:', response);
      console.log('Tipo de respuesta:', typeof response);
      console.log('Es array?', Array.isArray(response));
      
      // El webhook retorna un formato específico:
      // [
      //   {
      //     "data": [
      //       {
      //         "id": 2,
      //         "caegoria": "Facturación",  // Nota: typo en "caegoria"
      //         "descripcion": "",
      //         "valor SLA": 5
      //       },
      //       ...
      //     ]
      //   }
      // ]
      let categories: any[] = [];
      
      // Manejar el formato específico del webhook
      if (Array.isArray(response) && response.length > 0) {
        // Si es un array, buscar el objeto que contiene "data"
        const firstItem = response[0];
        if (firstItem && typeof firstItem === 'object' && firstItem.data) {
          categories = Array.isArray(firstItem.data) ? firstItem.data : [];
          console.log('Categorías encontradas en response[0].data:', categories);
        } else if (Array.isArray(firstItem)) {
          // Si el primer elemento es directamente un array
          categories = firstItem;
          console.log('Categorías encontradas directamente en response[0]:', categories);
        } else {
          // Intentar otros formatos comunes
          categories = firstItem.categories || 
                       firstItem.categorias || 
                       firstItem.result ||
                       firstItem.results ||
                       (Array.isArray(firstItem.items) ? firstItem.items : []);
        }
      } else if (response && typeof response === 'object') {
        // Si no es array, buscar propiedades comunes
        categories = response.categories || 
                     response.categorias || 
                     response.data || 
                     response.result ||
                     response.results ||
                     (Array.isArray(response.items) ? response.items : []) ||
                     [];
      }

      console.log('Categorías extraídas:', categories);
      console.log('Número de categorías extraídas:', categories.length);

      // Si no hay categorías, retornar array vacío (no null ni undefined)
      if (!categories || categories.length === 0) {
        console.log('No se encontraron categorías en la respuesta del webhook');
        return [];
      }

      // Mapear las categorías del webhook al formato local
      // El webhook usa: "caegoria" (typo), "descripcion", "valor SLA"
      const mappedCategories = categories.map((cat: any, index: number) => {
        const mapped = {
          id: String(cat.id || cat.idCategoria || cat.category_id || cat.id_categoria || String(index + 1)),
          name: cat.name || 
                cat.nombre || 
                cat.category_name || 
                cat.categoryName || 
                cat.caegoria ||  // Manejar el typo del webhook
                cat.categoria ||
                'Sin nombre',
          slaDays: Number(cat.slaDays || 
                         cat.slaDias || 
                         cat.sla || 
                         cat.sla_dias || 
                         cat['valor SLA'] ||  // Manejar "valor SLA" con espacio
                         cat.valorSLA ||
                         3),
          description: String(cat.description || 
                            cat.descripcion || 
                            cat.desc || 
                            '')
        };
        console.log('Categoría mapeada:', mapped);
        return mapped;
      });

      console.log('Total de categorías mapeadas:', mappedCategories.length);
      return mappedCategories;
    } catch (error: any) {
      console.error('Error al leer categorías:', error);
      console.error('Stack trace:', error.stack);
      // No lanzar error, retornar array vacío para que use las categorías por defecto
      return [];
    }
  },

  // Buscar categoría por ID mediante webhook
  async queryCategory(categoryId: string): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    const payload = {
      action: 'category.query',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: categoryId
      }
    };

    try {
      const response = await callCategoriesWebhook('POST', payload);
      return response;
    } catch (error: any) {
      console.error('Error al buscar categoría:', error);
      throw new Error(error.message || 'Error al buscar la categoría');
    }
  },

  // Crear nuevo estado mediante webhook
  async createState(stateData: {
    id: string;
    nombre: string;
    descripcion: string;
    orden: string;
    orden_final: string;
  }): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.createState] Iniciando creación de estado...');
    console.log('[api.createState] Datos del estado a crear:', stateData);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    console.log('[api.createState] Actor construido:', actor);
    
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;
    console.log('[api.createState] Role mapeado:', { original: actor.role, mapped: mappedRole });

    // Construir el payload según el formato especificado
    const payload = {
      action: 'estado.create',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: stateData.id,
        nombre: stateData.nombre,
        descripcion: stateData.descripcion,
        orden: stateData.orden,
        orden_final: stateData.orden_final
      }
    };

    console.log('[api.createState] Payload completo a enviar:', JSON.stringify(payload, null, 2));
    console.log('[api.createState] URL del webhook: https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61');

    try {
      const response = await callEstadosWebhook('POST', payload);
      console.log('[api.createState] Respuesta del webhook:', response);
      console.log('[api.createState] Respuesta como JSON:', JSON.stringify(response, null, 2));
      return response;
    } catch (error: any) {
      console.error('[api.createState] ❌ Error al crear estado:', error);
      console.error('[api.createState] Mensaje de error:', error.message);
      console.error('[api.createState] Stack trace:', error.stack);
      throw new Error(error.message || 'Error al crear el estado');
    }
  },

  // Actualizar orden de estados mediante webhook
  async updateEstados(estados: Array<{
    id: string;
    nombre: string;
    descripcion: string;
    orden: number;
    es_final: boolean;
  }>): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato especificado
    const payload = {
      action: 'estado.update',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        estados: estados
      }
    };

    try {
      const response = await callEstadosWebhook('POST', payload);
      return response;
    } catch (error: any) {
      console.error('Error al actualizar estados:', error);
      throw new Error(error.message || 'Error al actualizar el orden de los estados');
    }
  },

  // Leer transiciones de estados mediante webhook
  async readTransiciones(): Promise<Record<string, { transiciones: string[] }>> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.readTransiciones] Iniciando lectura de transiciones...');

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    console.log('[api.readTransiciones] Actor construido:', actor);
    
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;
    console.log('[api.readTransiciones] Role mapeado:', { original: actor.role, mapped: mappedRole });

    // Construir el payload según el formato especificado
    const payload = {
      action: 'transicion.read',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {}
    };

    console.log('[api.readTransiciones] Payload completo a enviar:', JSON.stringify(payload, null, 2));
    console.log('[api.readTransiciones] URL del webhook: https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61');

    try {
      const response = await callEstadosWebhook('POST', payload);
      console.log('[api.readTransiciones] Respuesta RAW del webhook:', response);
      console.log('[api.readTransiciones] Respuesta como JSON:', JSON.stringify(response, null, 2));
      console.log('[api.readTransiciones] Tipo de respuesta:', typeof response);
      
      // Procesar la respuesta del webhook
      // El formato esperado es: [{ "data": [{ "estado_origen": "nuevo", "estado_destino": "en_proceso", "permitido": true }, ...] }]
      let transicionesData: Record<string, { transiciones: string[] }> = {};
      
      console.log('[api.readTransiciones] Procesando respuesta del webhook...');
      console.log('[api.readTransiciones] Respuesta es array?', Array.isArray(response));
      console.log('[api.readTransiciones] Respuesta es objeto?', response && typeof response === 'object' && !Array.isArray(response));
      
      if (response && typeof response === 'object') {
        // Si es un array (formato esperado: [{ "data": [...] }])
        if (Array.isArray(response)) {
          console.log('[api.readTransiciones] La respuesta es un array, longitud:', response.length);
          
          if (response.length > 0 && response[0] && typeof response[0] === 'object') {
            console.log('[api.readTransiciones] Primer elemento del array:', response[0]);
            console.log('[api.readTransiciones] Keys del primer elemento:', Object.keys(response[0]));
            
            // Buscar la propiedad "data" en el primer elemento
            if (response[0].data && Array.isArray(response[0].data)) {
              console.log('[api.readTransiciones] ✅ Encontrado response[0].data como array, longitud:', response[0].data.length);
              
              // El formato es: [{ "estado_origen": "nuevo", "estado_destino": "en_proceso", "permitido": true }, ...]
              const transicionesArray = response[0].data;
              
              // Agrupar por estado_origen y construir el formato esperado
              transicionesArray.forEach((transicion: any) => {
                if (transicion && transicion.estado_origen && transicion.estado_destino && transicion.permitido === true) {
                  const estadoOrigen = transicion.estado_origen;
                  const estadoDestino = transicion.estado_destino;
                  
                  // Inicializar el estado origen si no existe
                  if (!transicionesData[estadoOrigen]) {
                    transicionesData[estadoOrigen] = { transiciones: [] };
                  }
                  
                  // Agregar el estado destino a las transiciones permitidas
                  if (!transicionesData[estadoOrigen].transiciones.includes(estadoDestino)) {
                    transicionesData[estadoOrigen].transiciones.push(estadoDestino);
                  }
                  
                  console.log(`[api.readTransiciones] Agregada transición: ${estadoOrigen} -> ${estadoDestino}`);
                }
              });
              
              console.log('[api.readTransiciones] ✅ Transiciones procesadas desde array de objetos');
            } else if (response[0].data && typeof response[0].data === 'object' && !Array.isArray(response[0].data)) {
              // Formato alternativo: { "data": { estado_id: { transiciones: [...] } } }
              console.log('[api.readTransiciones] ✅ Encontrado response[0].data como objeto');
              transicionesData = response[0].data;
            } else {
              console.log('[api.readTransiciones] ⚠️ response[0].data no tiene el formato esperado');
            }
          }
        } 
        // Si es un objeto directo
        else {
          console.log('[api.readTransiciones] La respuesta es un objeto directo');
          console.log('[api.readTransiciones] Keys del objeto:', Object.keys(response));
          
          // Si tiene una propiedad "data"
          if (response.data) {
            if (Array.isArray(response.data)) {
              // Formato: { "data": [{ "estado_origen": "...", "estado_destino": "...", "permitido": true }, ...] }
              console.log('[api.readTransiciones] ✅ Encontrado response.data como array');
              const transicionesArray = response.data;
              
              transicionesArray.forEach((transicion: any) => {
                if (transicion && transicion.estado_origen && transicion.estado_destino && transicion.permitido === true) {
                  const estadoOrigen = transicion.estado_origen;
                  const estadoDestino = transicion.estado_destino;
                  
                  if (!transicionesData[estadoOrigen]) {
                    transicionesData[estadoOrigen] = { transiciones: [] };
                  }
                  
                  if (!transicionesData[estadoOrigen].transiciones.includes(estadoDestino)) {
                    transicionesData[estadoOrigen].transiciones.push(estadoDestino);
                  }
                }
              });
            } else if (typeof response.data === 'object') {
              console.log('[api.readTransiciones] ✅ Encontrado response.data como objeto');
              transicionesData = response.data;
            }
          } else {
            // Si la respuesta es directamente el objeto de transiciones
            console.log('[api.readTransiciones] La respuesta es directamente el objeto de transiciones');
            transicionesData = response as Record<string, { transiciones: string[] }>;
          }
        }
      }
      
      console.log('[api.readTransiciones] Transiciones procesadas:', transicionesData);
      console.log('[api.readTransiciones] Cantidad de estados con transiciones:', Object.keys(transicionesData).length);
      console.log('[api.readTransiciones] Detalle de cada estado:', Object.keys(transicionesData).map(estadoId => ({
        estadoId,
        transiciones: transicionesData[estadoId]?.transiciones || []
      })));
      
      return transicionesData;
    } catch (error: any) {
      console.error('[api.readTransiciones] ❌ Error al leer transiciones:', error);
      console.error('[api.readTransiciones] Mensaje de error:', error.message);
      console.error('[api.readTransiciones] Stack trace:', error.stack);
      throw new Error(error.message || 'Error al leer las transiciones');
    }
  },

  // Actualizar transiciones de estados mediante webhook
  async updateTransiciones(transicionesData: Record<string, { transiciones: string[] }>): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.updateTransiciones] Iniciando actualización de transiciones...');
    console.log('[api.updateTransiciones] Datos de transiciones:', transicionesData);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    console.log('[api.updateTransiciones] Actor construido:', actor);
    
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;
    console.log('[api.updateTransiciones] Role mapeado:', { original: actor.role, mapped: mappedRole });

    // Construir el payload según el formato especificado
    const payload = {
      action: 'transicion.update',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: transicionesData
    };

    console.log('[api.updateTransiciones] Payload completo a enviar:', JSON.stringify(payload, null, 2));
    console.log('[api.updateTransiciones] URL del webhook: https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61');

    try {
      const response = await callEstadosWebhook('POST', payload);
      console.log('[api.updateTransiciones] Respuesta del webhook:', response);
      console.log('[api.updateTransiciones] Respuesta como JSON:', JSON.stringify(response, null, 2));
      return response;
    } catch (error: any) {
      console.error('[api.updateTransiciones] ❌ Error al actualizar transiciones:', error);
      console.error('[api.updateTransiciones] Mensaje de error:', error.message);
      console.error('[api.updateTransiciones] Stack trace:', error.stack);
      throw new Error(error.message || 'Error al actualizar las transiciones');
    }
  },

  // Eliminar estado mediante webhook
  async deleteState(stateId: string): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.deleteState] Iniciando eliminación de estado...');
    console.log('[api.deleteState] ID del estado a eliminar:', stateId);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    console.log('[api.deleteState] Actor construido:', actor);
    
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;
    console.log('[api.deleteState] Role mapeado:', { original: actor.role, mapped: mappedRole });

    // Construir el payload según el formato especificado
    const payload = {
      action: 'estado.delete',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: stateId
      }
    };

    console.log('[api.deleteState] Payload completo a enviar:', JSON.stringify(payload, null, 2));
    console.log('[api.deleteState] URL del webhook: https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61');

    try {
      const response = await callEstadosWebhook('POST', payload);
      console.log('[api.deleteState] Respuesta del webhook:', response);
      console.log('[api.deleteState] Respuesta como JSON:', JSON.stringify(response, null, 2));
      return response;
    } catch (error: any) {
      console.error('[api.deleteState] ❌ Error al eliminar estado:', error);
      console.error('[api.deleteState] Mensaje de error:', error.message);
      console.error('[api.deleteState] Stack trace:', error.stack);
      throw new Error(error.message || 'Error al eliminar el estado');
    }
  },

  // Leer todos los estados mediante webhook
  async readEstados(): Promise<Array<{
    id: string;
    name: string;
    order: number;
    isFinal: boolean;
  }>> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.readEstados] Usuario obtenido:', {
      id: user.id,
      email: (user as any).email,
      role: user.role
    });

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    console.log('[api.readEstados] Actor construido:', actor);
    
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;
    console.log('[api.readEstados] Role mapeado:', { original: actor.role, mapped: mappedRole });

    // Construir el payload según el formato especificado
    const payload = {
      action: 'estado.read',
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: mappedRole
      },
      data: {
        id: 'all'
      }
    };

    console.log('[api.readEstados] Payload completo a enviar:', JSON.stringify(payload, null, 2));
    console.log('[api.readEstados] URL del webhook: https://n8n.red.com.sv/webhook/5009ec05-e3ce-44ef-bd68-ae7ef4e61f61');

    try {
      const response = await callEstadosWebhook('POST', payload);
      console.log('[api.readEstados] Respuesta RAW del webhook:', response);
      console.log('[api.readEstados] Respuesta RAW como JSON:', JSON.stringify(response, null, 2));
      console.log('[api.readEstados] Tipo de respuesta:', typeof response);
      console.log('[api.readEstados] Es array?', Array.isArray(response));
      console.log('[api.readEstados] Es objeto?', response && typeof response === 'object' && !Array.isArray(response));
      console.log('[api.readEstados] Es null o undefined?', response === null || response === undefined);
      
      if (response && typeof response === 'object') {
        console.log('[api.readEstados] Keys del objeto respuesta:', Object.keys(response));
        console.log('[api.readEstados] Valores de cada key:', Object.keys(response).reduce((acc, key) => {
          acc[key] = response[key];
          return acc;
        }, {} as any));
      }
      
      // Procesar la respuesta del webhook
      // El formato esperado es: [{ "data": [...] }]
      let estados: any[] = [];
      
      // Si la respuesta es null o undefined
      if (response === null || response === undefined) {
        console.warn('[api.readEstados] ⚠️ La respuesta es null o undefined');
        return [];
      }
      
      console.log('[api.readEstados] Procesando respuesta del webhook...');
      
      // Si es un array (formato esperado: [{ "data": [...] }])
      if (Array.isArray(response)) {
        console.log('[api.readEstados] La respuesta es un array, longitud:', response.length);
        
        // Buscar la propiedad "data" en el primer elemento del array
        if (response.length > 0 && response[0] && typeof response[0] === 'object') {
          console.log('[api.readEstados] Primer elemento del array:', response[0]);
          console.log('[api.readEstados] Keys del primer elemento:', Object.keys(response[0]));
          
          // El formato es: [{ "data": [...] }]
          if (Array.isArray(response[0].data)) {
            console.log('[api.readEstados] ✅ Encontrado response[0].data con', response[0].data.length, 'estados');
            estados = response[0].data;
          } else {
            // Si no tiene data, puede ser que el array directamente contenga los estados
            console.log('[api.readEstados] response[0] no tiene propiedad data, verificando si el array contiene estados directamente...');
            // Verificar si los elementos del array son estados
            const tieneEstados = response.some(item => 
              item && typeof item === 'object' && (item.id !== undefined || item.nombre !== undefined || item.name !== undefined)
            );
            if (tieneEstados) {
              console.log('[api.readEstados] ✅ El array contiene estados directamente');
              estados = response;
            }
          }
        } else {
          // Si el array contiene directamente los estados
          const tieneEstados = response.some(item => 
            item && typeof item === 'object' && (item.id !== undefined || item.nombre !== undefined || item.name !== undefined)
          );
          if (tieneEstados) {
            console.log('[api.readEstados] ✅ El array contiene estados directamente');
            estados = response;
          }
        }
      } 
      // Si es un objeto, buscar estados en diferentes propiedades
      else if (response && typeof response === 'object') {
        console.log('[api.readEstados] La respuesta es un objeto, buscando estados en diferentes propiedades...');
        
        // Intentar diferentes estructuras comunes
        const posiblesEstados = [
          response.data,
          response.estados,
          response.result,
          response.results,
          response.items,
        ];
        
        // Buscar el primer array válido
        for (const posibleEstado of posiblesEstados) {
          if (Array.isArray(posibleEstado) && posibleEstado.length > 0) {
            console.log('[api.readEstados] ✅ Encontrado array de estados en propiedad del objeto');
            estados = posibleEstado;
            break;
          }
        }
      }

      console.log('[api.readEstados] Estados extraídos:', estados);
      console.log('[api.readEstados] Cantidad de estados extraídos:', estados.length);
      
      // Si no hay estados, retornar array vacío
      if (!estados || estados.length === 0) {
        console.warn('[api.readEstados] ⚠️ No se encontraron estados en la respuesta del webhook');
        console.warn('[api.readEstados] Respuesta completa:', JSON.stringify(response, null, 2));
        return [];
      }

      // Mapear los estados del webhook al formato local
      // El webhook retorna: { id, nombre, descripcion, orden, estado_final }
      // IMPORTANTE: El ID siempre debe ser texto normalizado (ej: "en_proceso"), no números
      const mappedEstados = estados.map((estado: any, index: number) => {
        // El ID puede venir como número o string, pero SIEMPRE debe convertirse a formato normalizado
        let estadoId = estado.id || estado.id_estado || estado.estado_id;
        
        // Si el ID es un número o no está en formato normalizado, generar el ID desde el nombre
        if (estado.nombre || estado.name) {
          const nombreEstado = estado.nombre || estado.name;
          // Convertir nombre a ID normalizado (ej: "En Proceso" -> "en_proceso")
          const nombreNormalizado = nombreEstado
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remover tildes
            .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
            .replace(/[^a-z0-9_]/g, ''); // Remover caracteres especiales
          
          // Siempre usar el ID normalizado basado en el nombre
          estadoId = nombreNormalizado;
          
          if (estado.id && !isNaN(Number(estado.id))) {
            console.log(`[api.readEstados] ID numérico detectado (${estado.id}), convirtiendo a formato normalizado: ${estadoId}`);
          } else if (estado.id && estado.id !== nombreNormalizado) {
            console.log(`[api.readEstados] ID no normalizado detectado (${estado.id}), usando formato normalizado: ${estadoId}`);
          } else {
            console.log(`[api.readEstados] ID generado desde nombre: ${estadoId}`);
          }
        } else {
          // Si no hay nombre, usar el ID original como string
          estadoId = String(estadoId || `estado_${index + 1}`);
          console.warn(`[api.readEstados] ⚠️ Estado sin nombre, usando ID: ${estadoId}`);
        }
        
        const mapped = {
          id: String(estadoId),
          name: estado.nombre || estado.name || 'Sin nombre',
          order: Number(estado.orden || estado.order || index + 1),
          // El webhook usa "estado_final", no "es_final"
          isFinal: estado.estado_final === true || estado.estado_final === 'true' || 
                   estado.es_final === true || estado.es_final === 'true' || 
                   estado.isFinal === true || estado.is_final === true || false
        };
        console.log(`[api.readEstados] Estado ${index} mapeado:`, {
          original: estado,
          mapped: mapped
        });
        return mapped;
      });

      // Ordenar por orden
      mappedEstados.sort((a, b) => a.order - b.order);

      console.log('[api.readEstados] Estados mapeados y ordenados:', mappedEstados);
      console.log('[api.readEstados] Cantidad final de estados:', mappedEstados.length);
      return mappedEstados;
    } catch (error: any) {
      console.error('[api.readEstados] Error al leer estados:', error);
      console.error('[api.readEstados] Mensaje de error:', error.message);
      console.error('[api.readEstados] Stack trace:', error.stack);
      throw new Error(error.message || 'Error al leer los estados');
    }
  },

  async updateAgente(id: string, data: any): Promise<boolean> {
    
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

      // Limpiar caché para forzar recarga
      clearCache('agentes');
      
      return true;
    } catch (error: any) {
      
      // Fallback: actualizar en localStorage
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
      // También intentar enviar al webhook si está disponible
      try {
        await callWebhook('reset_password', { 
          email,
          action: 'request_reset' 
        });
      } catch (webhookErr) {
      }
      return true;
    } catch (err) {
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
        }
        return { 
          ok: true, 
          tempToken: result.tempToken 
        };
      } else {
        throw new Error(result.message || 'Código inválido');
      }
    } catch (err: any) {
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

    // Determinar el rol del usuario
    const rolUsuario = additionalData?.rol || 'AGENTE';
    
    // Construir el payload - SIEMPRE usar user.create para crear usuarios desde el panel admin
    // Esto incluye agentes, supervisores, gerentes, etc.
    const payload: any = {
      action: 'user.create',
      actor: {
        user_id: Number(actor.user_id) || 0,
        email: actor.email,
        role: actor.role
      },
      data: {
        nombre: name.trim(),
        email: email.trim().toLowerCase(),
        password: passwordFinal, // IMPORTANTE: incluir la contraseña generada
        role: rolUsuario, // IMPORTANTE: usar 'role' no 'rol'
        pais: additionalData?.pais || 'El_Salvador' // Incluir país si está disponible
      }
    };
    
    // Log para debugging
    console.log('Payload user.create:', JSON.stringify(payload, null, 2));
    
    const webhookUrl = API_CONFIG.WEBHOOK_CREAR_USUARIO_URL;

    
    // Llamar al webhook correspondiente
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
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

      // Verificar si la respuesta tiene contenido antes de parsear JSON
      const contentType = response.headers.get('content-type');
      
      const responseText = await response.text();

      if (!responseText || responseText.trim() === '') {
        throw new Error('El webhook no devolvió ninguna respuesta. Verifica que el flujo de n8n esté configurado correctamente y devuelva los datos del usuario creado.');
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
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
        
        // Buscar el usuario recién creado (el último o el que coincida con el email)
        const emailLower = email.trim().toLowerCase();
        userData = userData.find((u: any) => 
          (u.email || '').toLowerCase() === emailLower
        ) || userData[userData.length - 1] || userData[0];
        
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
    // Usar caseService.reassignCase según la documentación
    // Formato: update_type: "reassign", case_id, agent_id
    await caseService.reassignCase(caseId, newAgentId);
    
    // Limpiar caché de casos y agentes para forzar actualización
    // Los agentes necesitan actualizarse porque el número de casos activos cambió
    clearCache('cases');
    clearCache('agentes');
    
    // Disparar evento para que GestionAgentes recargue los agentes
    window.dispatchEvent(new CustomEvent('caso-reasignado', {
      detail: { caseId, newAgentId }
    }));
    
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
    }

    localStorage.setItem('intelfon_cases', JSON.stringify(cases));
    clearCache('cases');
    return true;
  },

  // Agregar fecha de asueto mediante webhook
  async addHoliday(date: Date, holidayName?: string | null): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.addHoliday] Iniciando agregado de asueto...');
    console.log('[api.addHoliday] Fecha:', date);
    console.log('[api.addHoliday] Festividad:', holidayName);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Formatear fecha como DD/MM/YYYY
    // Usar getFullYear, getMonth, getDate para obtener valores en zona horaria local
    // Asegurarse de que la fecha esté a mediodía para evitar problemas de zona horaria
    const dateAtNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const day = String(dateAtNoon.getDate()).padStart(2, '0');
    const month = String(dateAtNoon.getMonth() + 1).padStart(2, '0');
    const year = dateAtNoon.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    
    console.log('[api.addHoliday] Fecha formateada:', {
      originalDate: date.toISOString(),
      dateAtNoon: dateAtNoon.toISOString(),
      day,
      month,
      year,
      dateStr
    });

    // Construir el payload según el formato esperado
    const payload = {
      action: 'asueto.create',
      actor: {
        user_id: actor.user_id || 0,
        email: actor.email || 'admin@intelfon.com',
        role: mappedRole || 'ADMINISTRADOR'
      },
      data: {
        type: 'individual',
        fecha: dateStr,
        motivo: holidayName || '',
        pais: 'El Salvador'
      }
    };

    console.log('[api.addHoliday] Payload completo a enviar:', JSON.stringify(payload, null, 2));

    try {
      const response = await callAsuetosWebhook('POST', payload);
      console.log('[api.addHoliday] Respuesta del webhook:', response);
      return response;
    } catch (error: any) {
      console.error('[api.addHoliday] ❌ Error al agregar asueto:', error);
      throw new Error(error.message || 'Error al agregar la fecha de asueto');
    }
  },

  // Eliminar fecha de asueto mediante webhook
  async deleteHoliday(date: Date): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.deleteHoliday] Iniciando eliminación de asueto...');
    console.log('[api.deleteHoliday] Fecha:', date);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Formatear fecha como DD/MM/YYYY (mismo formato que usa el webhook)
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const fechaStr = `${day}/${month}/${year}`;

    // Construir el payload con la misma estructura que asueto.read
    const payload = {
      action: 'asueto.delete',
      actor: {
        user_id: actor.user_id || 0,
        email: actor.email || 'admin@intelfon.com',
        role: mappedRole || 'ADMINISTRADOR'
      },
      data: {
        fecha: fechaStr
      }
    };

    console.log('[api.deleteHoliday] Payload completo a enviar:', JSON.stringify(payload, null, 2));

    try {
      const response = await callAsuetosWebhook('POST', payload);
      console.log('[api.deleteHoliday] Respuesta del webhook:', response);
      return response;
    } catch (error: any) {
      console.error('[api.deleteHoliday] ❌ Error al eliminar asueto:', error);
      throw new Error(error.message || 'Error al eliminar la fecha de asueto');
    }
  },

  // Agregar múltiples fechas de asuetos mediante webhook (carga masiva)
  async addBulkHolidays(dates: Date[], holidayNames?: (string | null)[]): Promise<any> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.addBulkHolidays] Iniciando carga masiva de asuetos...');
    console.log('[api.addBulkHolidays] Cantidad de fechas:', dates.length);

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Formatear fechas como DD/MM/YYYY en un array
    const fechasArray = dates.map((date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    });

    // Construir el payload según el formato esperado
    const payload = {
      action: 'asueto.create',
      actor: {
        user_id: actor.user_id || 0,
        email: actor.email || 'admin@intelfon.com',
        role: mappedRole || 'ADMINISTRADOR'
      },
      data: {
        type: 'masivo',
        fecha: fechasArray
      }
    };

    console.log('[api.addBulkHolidays] Payload completo a enviar:', JSON.stringify(payload, null, 2));

    try {
      const response = await callAsuetosWebhook('POST', payload);
      console.log('[api.addBulkHolidays] Respuesta del webhook:', response);
      return response;
    } catch (error: any) {
      console.error('[api.addBulkHolidays] ❌ Error al agregar asuetos en masa:', error);
      throw new Error(error.message || 'Error al agregar las fechas de asuetos');
    }
  },

  // Leer fechas de asuetos desde el webhook
  async readHolidays(): Promise<Array<{ fecha: string; motivo: string; pais: string; row_number: number; fechaDate?: Date }>> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    console.log('[api.readHolidays] Iniciando lectura de asuetos...');

    // Construir el actor con el formato esperado
    const actor = buildActorPayload(user);
    // Mapear el role: ADMIN -> ADMINISTRADOR, otros roles se mantienen
    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const mappedRole = roleMap[actor.role] || actor.role;

    // Construir el payload según el formato esperado
    const payload = {
      action: 'asueto.read',
      actor: {
        user_id: actor.user_id || 0,
        email: actor.email || 'admin@intelfon.com',
        role: mappedRole || 'ADMINISTRADOR'
      },
      data: {}
    };

    console.log('[api.readHolidays] Payload completo a enviar:', JSON.stringify(payload, null, 2));

    try {
      const response = await callAsuetosWebhook('POST', payload);
      console.log('[api.readHolidays] Respuesta del webhook:', response);
      
      // Parsear la nueva estructura: [{ data: [...] }]
      let asuetos: Array<{ fecha: string; motivo: string; pais: string; row_number: number; fechaDate?: Date }> = [];
      
      if (Array.isArray(response)) {
        // La respuesta es un array: [{ data: [...] }]
        for (const item of response) {
          if (item && typeof item === 'object' && Array.isArray(item.data)) {
            // Procesar cada elemento del array data
            // IMPORTANTE: NO modificar la fecha que viene del webhook - guardarla exactamente como viene
            asuetos = item.data.map((asueto: any) => {
              const fechaStr = asueto.fecha || '';
              let fechaDate: Date | undefined;
              
              // Convertir fecha string a Date SOLO para cálculos internos (ordenamiento, etc.)
              // NO usar esta fecha para mostrar - siempre usar fechaStr directamente
              if (fechaStr && fechaStr.includes('/')) {
                try {
                  const [day, month, year] = fechaStr.split('/').map(Number);
                  // Crear fecha en zona horaria local a mediodía para evitar problemas de zona horaria
                  fechaDate = new Date(year, month - 1, day, 12, 0, 0);
                } catch (error) {
                  console.error('[api.readHolidays] Error parseando fecha:', fechaStr, error);
                }
              }
              
              // Guardar la fecha EXACTAMENTE como viene del webhook en el campo fecha
              return {
                fecha: fechaStr, // ESTE es el valor que se debe mostrar - viene directamente del webhook
                motivo: asueto.motivo || 'Indefinido',
                pais: asueto.pais || 'Indefinido',
                row_number: asueto.row_number || 0,
                fechaDate: fechaDate // Solo para cálculos internos, NO para mostrar
              };
            });
            break; // Solo procesar el primer objeto con data
          }
        }
      } else if (response && typeof response === 'object') {
        // Si es un objeto directo con data
        if (Array.isArray(response.data)) {
          // IMPORTANTE: NO modificar la fecha que viene del webhook - guardarla exactamente como viene
          asuetos = response.data.map((asueto: any) => {
            const fechaStr = asueto.fecha || '';
            let fechaDate: Date | undefined;
            
            // Convertir fecha string a Date SOLO para cálculos internos (ordenamiento, etc.)
            // NO usar esta fecha para mostrar - siempre usar fechaStr directamente
            if (fechaStr && fechaStr.includes('/')) {
              try {
                const [day, month, year] = fechaStr.split('/').map(Number);
                // Crear fecha en zona horaria local a mediodía para evitar problemas de zona horaria
                fechaDate = new Date(year, month - 1, day, 12, 0, 0);
              } catch (error) {
                console.error('[api.readHolidays] Error parseando fecha:', fechaStr, error);
              }
            }
            
            // Guardar la fecha EXACTAMENTE como viene del webhook en el campo fecha
            return {
              fecha: fechaStr, // ESTE es el valor que se debe mostrar - viene directamente del webhook
              motivo: asueto.motivo || 'Indefinido',
              pais: asueto.pais || 'Indefinido',
              row_number: asueto.row_number || 0,
              fechaDate: fechaDate // Solo para cálculos internos, NO para mostrar
            };
          });
        }
      }
      
      // Ordenar por fecha cronológicamente
      asuetos.sort((a, b) => {
        if (a.fechaDate && b.fechaDate) {
          return a.fechaDate.getTime() - b.fechaDate.getTime();
        }
        return a.fecha.localeCompare(b.fecha);
      });
      
      console.log('[api.readHolidays] Asuetos parseados:', asuetos.length);
      return asuetos;
    } catch (error: any) {
      console.error('[api.readHolidays] ❌ Error al leer asuetos:', error);
      throw new Error(error.message || 'Error al leer las fechas de asuetos');
    }
  }
};
