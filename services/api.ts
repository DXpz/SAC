
import { Case, CaseStatus, KPI, User, Role, Cliente, Categoria } from '../types';
import { API_CONFIG, CASES_WEBHOOK_URL, CLIENTS_WEBHOOK_URL } from '../config';
import { emailService } from './emailService';
import * as caseService from './caseService';

// Sistema de caché simple para evitar llamadas redundantes
interface CacheEntry {
  data: any;
  timestamp: number;
  promise?: Promise<any>;
}

const CACHE_DURATION_CASES = 10000; // 10 segundos para casos
const CACHE_DURATION_AGENTES = 30000; // 30 segundos para agentes
const CACHE_DURATION_CLIENTES = 30000; // 30 segundos para clientes
const CACHE_DURATION_USUARIOS = 30000; // 30 segundos para usuarios
const CACHE_DURATION_CATEGORIAS = 30000; // 30 segundos para categorias

const cache: {
  cases?: CacheEntry;
  clientes?: CacheEntry;
  agentes?: CacheEntry;
  usuarios?: CacheEntry;
  categorias?: CacheEntry;
} = {};

// Helper para obtener datos del caché o hacer la llamada
const getCachedOrFetch = async <T>(
  key: 'cases' | 'clientes' | 'agentes' | 'usuarios' | 'categorias',
  fetchFn: () => Promise<T>
): Promise<T> => {
  const now = Date.now();
  const cached = cache[key];
  const maxAge = key === 'cases' ? CACHE_DURATION_CASES : 
                 key === 'agentes' ? CACHE_DURATION_AGENTES :
                 key === 'clientes' ? CACHE_DURATION_CLIENTES :
                 key === 'categorias' ? CACHE_DURATION_CATEGORIAS :
                 CACHE_DURATION_USUARIOS;
  
  if (cached && cached.data && (now - cached.timestamp) < maxAge) {
    return cached.data as T;
  }
  
  if (cached?.promise) {
    return await cached.promise as T;
  }
  
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
    delete cache[key];
    throw error;
  }
};

// Limpiar caché manualmente
export const clearCache = (key?: 'cases' | 'clientes' | 'agentes' | 'usuarios') => {
  if (key) {
    delete cache[key];
  } else {
    Object.keys(cache).forEach(k => delete cache[k as keyof typeof cache]);
  }
};

// Helper para obtener la URL base del backend
const getBaseUrl = (): string => {
  return API_CONFIG.WEBHOOK_URL;
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
    'ngrok-skip-browser-warning': 'true',
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
  const CATEGORIES_WEBHOOK_URL = API_CONFIG.WEBHOOK_CATEGORIAS_URL;
  return callWebhookGeneric<T>(CATEGORIES_WEBHOOK_URL, method, body);
};

// Helper para llamar al webhook de estados
const callEstadosWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  const ESTADOS_WEBHOOK_URL = API_CONFIG.WEBHOOK_ESTADOS_URL;
  try {
    const response = await callWebhookGeneric<T>(ESTADOS_WEBHOOK_URL, method, body);
    return response;
  } catch (error: any) {
    throw error;
  }
};

// Helper para llamar al webhook de asuetos
const callAsuetosWebhook = async <T = any>(
  method: 'GET' | 'POST',
  body?: unknown
): Promise<T> => {
  const ASUETOS_WEBHOOK_URL = API_CONFIG.WEBHOOK_ASUETOS_URL;
  try {
    const response = await callWebhookGeneric<T>(ASUETOS_WEBHOOK_URL, method, body);
    return response;
  } catch (error: any) {
    throw error;
  }
};

// Helpers para construir el payload estándar esperado por n8n
const buildActorPayload = (user: User | null) => {
  if (!user) {
    throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
  }

  const numericId = Number((user as any).user_id ?? user.id);
  const userEmail = sessionStorage.getItem('intelfon_user_email') || (user as any).email;

  if (!userEmail) {
    throw new Error('Usuario sin email. Por favor, inicia sesión nuevamente.');
  }

  return {
    user_id: Number.isNaN(numericId) ? 0 : numericId,
    email: userEmail,
    role: user.role,
  };
};

const DEFAULT_CATEGORY = {
  categoria_id: 7, // "Otros" - categoría por defecto para casos sin categoría específica
  nombre: 'Otros',
};


// Función auxiliar para llamar al webhook de n8n
// Solo permite operaciones si el webhook responde correctamente
// scenario: 'login' | 'forgot_password' | 'reset_password' | 'register'
const callWebhook = async (scenario: 'login' | 'forgot_password' | 'reset_password' | 'new_account', data: any) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  // Mapear scenario a event para n8n
  const eventMap: Record<'login' | 'forgot_password' | 'reset_password' | 'new_account', string> = {
    'login': 'auth.login',
    'forgot_password': 'auth.forgot_password',
    'reset_password': 'auth.reset_password',
    'new_account': 'auth.register'
  };

  const event = eventMap[scenario];

try {
    let response: Response;

    const pathMap: Record<string, string> = {
      'login': '/api/auth/login',
      'forgot_password': '/api/auth/forgot_password',
      'reset_password': '/api/auth/reset_password',
      'new_account': '/api/auth/register'
    };
    const path = pathMap[scenario] || '/api/auth/login';
    const webhookUrl = `${API_CONFIG.WEBHOOK_URL}${path}`;

    response = await fetch(webhookUrl, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok && response.status === 0) {
      throw new Error('Error de CORS: El servidor no está permitiendo peticiones desde este origen.');
    }

    const result = await response.json();

    if (result.error === true) {
      throw new Error(result.message || 'Error en la operación');
    }

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
      if (!['AGENTE', 'SUPERVISOR', 'GERENTE', 'ADMIN', 'ADMINISTRADOR'].includes(result.role)) {
        throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
      }
      
      // Normalizar la respuesta al formato esperado internamente
      // IMPORTANTE: Incluir el campo pais/country del webhook si está disponible
      // Buscar país en todos los campos posibles
      const paisEncontrado = result.pais || result.country || result.país || result.Pais || result.Country || 
                             result.PAIS || result.COUNTRY || (result as any).pais_usuario || 
                             (result as any).country_user || (result as any).user_pais;
      
      return {
        token: `token-${result.id}-${Date.now()}`, // Generar token local basado en el ID
        user: {
          id: result.id,
          name: result.name,
          role: result.role,
          email: result.email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=0f172a&color=fff`,
          pais: paisEncontrado || undefined // Incluir país del webhook desde cualquier campo posible
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
  console.log('[auth] data from callWebhook:', JSON.stringify(data));

  // El backend retorna: { id, name, role, email, token } directamente
  // O callWebhook puede retornar: { token, user: { id, name, role, email } }
  // Manejar ambos casos
  const userData = data.user || data;
  const token = data.token || data.token;

  if (!token || !userData.id) {
    throw new Error('Credenciales inválidas o cuenta no registrada en el sistema');
  }

  // Validar que el usuario tenga nombre válido
  if (!userData.name || typeof userData.name !== 'string' || userData.name.trim() === '') {
    throw new Error('Información de usuario incompleta. La cuenta no está correctamente registrada.');
  }

  // Validar que el rol sea válido y venga del webhook
  const userRole = userData.role;
  if (!userRole || !['AGENTE', 'SUPERVISOR', 'GERENTE', 'ADMIN', 'ADMINISTRADOR'].includes(userRole)) {
    throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
  }

  // Almacenar el token JWT para futuras peticiones
  localStorage.setItem('intelfon_token', token);

  // Guardar el email usado para login en sessionStorage (se limpia al cerrar sesión)
  sessionStorage.setItem('intelfon_user_email', email.trim().toLowerCase());

  const user: User = {
    id: userData.id,
    name: userData.name.trim(),
    email: userData.email || email.trim().toLowerCase(),
    role: userRole,
    avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0f172a&color=fff`,
    pais: userData.pais || userData.country || undefined
  };

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
    
    // Todas las cuentas DEBEN estar registradas y almacenadas en el sistema
    // El webhook de Make.com verifica si el usuario existe en su base de datos
    // Si el usuario no está almacenado, el webhook retornará un error
    try {
      const user = await authenticateWithWebhook(email.trim(), pass);
      // Si llegamos aquí, el usuario está almacenado en el sistema y las credenciales son correctas

      // Obtener el pais del usuario desde la tabla usuarios y guardarlo
      try {
        const usuarios = await this.getUsuarios();
        console.log('[DEBUG] Buscando pais para usuario:', user.email, 'name:', user.name);
        console.log('[DEBUG] Lista de usuarios disponibles:', usuarios.map(u => ({email: u.email, nombre: u.nombre, pais: u.pais})));
        const usuarioCompleto = usuarios.find((u: any) =>
          (u.email || '').toLowerCase() === emailLower ||
          (u.nombre || '').toUpperCase() === (user.name || '').toUpperCase()
        );
        console.log('[DEBUG] Usuario encontrado:', usuarioCompleto);
        if (usuarioCompleto && usuarioCompleto.pais) {
          user.pais = usuarioCompleto.pais;
          console.log('[DEBUG] Pais asignado:', user.pais);
          // Guardar el usuario con el pais en localStorage
          localStorage.setItem('intelfon_user', JSON.stringify(user));
        }
      } catch (paisError) {
        // Si falla al obtener el pais, continuar sin él
        console.warn('No se pudo obtener el pais del usuario:', paisError);
      }

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

  async reassignCase(caseId: string, newAgentId: string, motivo?: string): Promise<{ success: boolean; message: string }> {
    const result = await caseService.reassignCase(caseId, newAgentId, motivo);
    clearCache('cases');
    return result;
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
      // Sin fallback a mock - lanzar error si caseService falla
      console.error('Error creating case via caseService:', err);
      throw new Error('No se pudo crear el caso. Por favor intenta de nuevo.');
    }
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
      const response = await fetch(`${API_CONFIG.WEBHOOK_AGENTES_URL}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });

      if (!response.ok) {
        throw new Error('Error al obtener agentes');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : data.agentes ?? data.agents ?? [];
    });
  },

  // Obtener lista de usuarios desde backend directo
  async getUsuarios(): Promise<any[]> {
    return getCachedOrFetch('usuarios', async () => {
      const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });

      if (!response.ok) {
        throw new Error('Error al obtener usuarios');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    });
  },

  // Obtener lista de clientes desde SAP via backend
  async getClientes(): Promise<Cliente[]> {
    return getCachedOrFetch('clientes', async () => {
      const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/sap/clientes?var_pais=SV`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      });

      if (!response.ok) {
        throw new Error('Error al obtener clientes');
      }

      const data = await response.json();
      const clientesArray = Array.isArray(data) ? data : [];

      const mapCliente = (c: any): Cliente => ({
        idCliente: c.CardCode || c.cardCode || c.cliente_id || '',
        nombreEmpresa: c.CardName || c.cardName || c.nombre || '',
        contactoPrincipal: c.ContactoVentas || c.contactoVentas || 'N/A',
        email: c.Correo || c.correo || c.email || 'sin-email@cliente.com',
        telefono: c.Telefono1 || c.telefono1 || c.Telefono || c.telefono || 'N/A',
        pais: 'SV',
        estado: c.estado || 'ACTIVO',
      });

      return clientesArray.map(mapCliente);
    });
  },

  // Obtener cliente por ID
  async getClienteById(clienteId: string): Promise<Cliente | undefined> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CLIENTES_URL}/${clienteId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });

    if (!response.ok) return undefined;

    const data = await response.json();
    return {
      idCliente: data.cliente_id || data.idCliente || data.id || '',
      nombreEmpresa: data.nombre_empresa || data.nombreEmpresa || data.nombre || '',
      contactoPrincipal: data.contacto_principal || data.contactoPrincipal || 'N/A',
      email: data.email || data.correo || 'sin-email@cliente.com',
      telefono: data.telefono || data.phone || 'N/A',
      pais: data.pais || data.country || 'El Salvador',
      estado: data.estado || data.state || data.status || 'ACTIVO',
    };
  },

  // Obtener lista de categorías desde la API real
  async getCategorias(): Promise<Categoria[]> {
    return getCachedOrFetch('categorias', async () => {
      try {
        const user = this.getUser();
        if (!user) return [];

        const response = await fetch(`${getBaseUrl()}/api/categorias`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('intelfon_token')}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        const categoriasArray = Array.isArray(data) ? data : data.categorias ?? data.categories ?? data.data ?? [];

        if (!Array.isArray(categoriasArray)) return [];

        return categoriasArray
          .filter((c: any) => c.activa !== false)
          .map((c: any): Categoria => ({
            idCategoria: String(c.id ?? c.categoria_id ?? ''),
            nombre: c.categoria ?? c.nombre ?? c.name ?? c.category_name ?? '',
            slaDias: Number(c.valor_sla ?? c.sla ?? c.sla_dias ?? 5),
            diasAlertaSupervisor: Number(c.dias_alerta_supervisor ?? c.diasAlertaSupervisor ?? 3),
            diasAlertaGerente: Number(c.dias_alerta_gerente ?? c.diasAlertaGerente ?? 4),
            activa: c.activa !== false
          }));
      } catch (err) {
        return [];
      }
    });
  },

  // Crear nueva categoría mediante backend directo
  async createCategory(categoryData: {
    category_name: string;
    description: string;
    sla: number;
  }): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CATEGORIAS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        categoria: categoryData.category_name,
        descripcion: categoryData.description,
        valor_sla: categoryData.sla
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear categoría');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Actualizar categoría existente mediante webhook
  async updateCategory(categoryData: {
    id: string;
    category_name: string;
    description: string;
    sla: number;
  }): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CATEGORIAS_URL}/${categoryData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        categoria: categoryData.category_name,
        descripcion: categoryData.description,
        valor_sla: categoryData.sla
      })
    });
    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Eliminar categoría mediante webhook
  async deleteCategory(categoryId: string): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_CATEGORIAS_URL}/${categoryId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
    });
    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Leer todas las categorías mediante backend directo
  async readCategories(): Promise<any[]> {
    const user = this.getUser();
    if (!user) {
      throw new Error('Usuario no autenticado. Por favor, inicia sesión.');
    }

    try {
      const response = await fetch(`${getBaseUrl()}/api/categorias`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('intelfon_token')}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error('Error al leer las categorías');
      }

      const data = await response.json();
      const rawCategorias = Array.isArray(data) ? data : data.data ?? data.categorias ?? [];
      
      return rawCategorias.map((c: any) => ({
        id: String(c.id ?? ''),
        name: c.categoria ?? c.nombre ?? c.name ?? '',
        slaDays: Number(c.valor_sla ?? c.sla ?? c.sla_dias ?? 3),
        description: c.descripcion ?? c.description ?? ''
      }));
    } catch (error: any) {
      throw new Error(error.message || 'Error al leer las categorías');
    }
  },

  // Buscar categoría por ID mediante backend directo
  async queryCategory(categoryId: string): Promise<any> {
    const categorias = await this.readCategories();
    return categorias.find(c => String(c.id) === String(categoryId));
  },

  // Crear nuevo estado mediante backend directo
  async createState(stateData: {
    nombre: string;
    descripcion?: string;
    orden?: number;
    estado_final?: boolean;
  }): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        nombre: stateData.nombre,
        descripcion: stateData.descripcion || null,
        orden: stateData.orden || 1,
        estado_final: stateData.estado_final || false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear el estado');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Actualizar estado mediante backend directo
  async updateEstado(id: string, stateData: {
    nombre?: string;
    descripcion?: string;
    orden?: number;
    estado_final?: boolean;
  }): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify(stateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar el estado');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Actualizar orden de un estado
  async updateEstadoOrden(id: string, orden: number): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ orden })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar el orden');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Eliminar estado mediante backend directo
  async deleteState(id: string): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar el estado');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Leer transiciones de estados desde backend directo
  async readTransiciones(): Promise<any[]> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}/transiciones`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });

    if (!response.ok) {
      throw new Error('Error al leer las transiciones');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Leer todos los estados desde backend directo
  async readEstados(): Promise<any[]> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });

    if (!response.ok) {
      throw new Error('Error al leer los estados');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  // Actualizar matriz de transiciones mediante backend directo
  async updateTransiciones(estados: Record<string, { transiciones: string[] }>): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ESTADOS_URL}/transiciones`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ estados })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar las transiciones');
    }

return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  async updateAgente(id: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.WEBHOOK_AGENTES_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ estado: data.estado })
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      clearCache('agentes');
      return true;
    } catch (error: any) {
      throw new Error(error.message || 'Error al actualizar agente');
    }
  },

  async deleteAgente(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_CONFIG.WEBHOOK_AGENTES_URL}/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      clearCache('agentes');
      return true;
    } catch (error: any) {
      throw new Error(error.message || 'Error al eliminar agente');
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

    // Construir el payload directo para el backend
    const rolMap: Record<string, string> = {
      'ADMIN': 'ADMINISTRADOR',
      'AGENTE': 'AGENTE',
      'SUPERVISOR': 'SUPERVISOR',
      'GERENTE': 'GERENTE'
    };
    const paisMap: Record<string, string> = {
      'El Salvador': 'ElSalvador',
      'El_Salvador': 'ElSalvador',
      'ElSalvador': 'ElSalvador',
      'Guatemala': 'Guatemala',
      'GT': 'Guatemala'
    };
    const rolUsuario = rolMap[additionalData?.rol || 'AGENTE'] || 'AGENTE';
    const paisUsuario = paisMap[additionalData?.pais || 'ElSalvador'] || 'ElSalvador';

    const payload = {
      email: email.trim().toLowerCase(),
      nombre: name.trim(),
      role: rolUsuario,
      pais: paisUsuario
    };
    
    // Llamar directamente al backend /api/usuarios
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios`, {
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
        throw new Error(result.message || 'Error al crear el usuario');
      }

      // Mapear respuesta del backend al formato User
      const user: User & { passwordTemporal?: string } = {
        id: result.id || result.user_id || `user-${Date.now()}`,
        name: result.nombre || name.trim(),
        role: (result.rol || result.role || 'AGENTE') as Role,
        avatar: result.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=0f172a&color=fff`,
        passwordTemporal: result.passwordTemporal || undefined
      };

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

  // Agregar fecha de asueto mediante backend directo
  async addHoliday(date: Date, holidayName?: string | null): Promise<any> {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${year}-${month}-${day}`;

    const response = await fetch(`${API_CONFIG.WEBHOOK_ASUETOS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        fecha: dateStr,
        motivo: holidayName || '',
        pais: 'ElSalvador'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear el asueto');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Eliminar fecha de asueto mediante backend directo
  async deleteHoliday(date: Date): Promise<any> {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const fechaStr = `${year}-${month}-${day}`;

    const response = await fetch(`${API_CONFIG.WEBHOOK_ASUETOS_URL}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({ fecha: fechaStr })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar el asueto');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Agregar múltiples fechas de asuetos mediante backend directo
  async addBulkHolidays(dates: Date[], holidayNames?: (string | null)[]): Promise<any> {
    const fechasArray = dates.map((date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    });

    const response = await fetch(`${API_CONFIG.WEBHOOK_ASUETOS_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        type: 'masivo',
        data: {
          fechas: fechasArray.map((fecha, i) => ({
            fecha,
            motivo: holidayNames?.[i] || 'Indefinido',
            pais: 'El Salvador'
          }))
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear asuetos masivos');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  // Leer fechas de asuetos desde backend directo
  async readHolidays(): Promise<Array<{ fecha: string; motivo: string; pais: string; row_number: number; fechaDate?: Date }>> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_ASUETOS_URL}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });

    if (!response.ok) {
      throw new Error('Error al leer las fechas de asuetos');
    }

    const data = await response.json();
    const asuetosArray = Array.isArray(data) ? data : data.data ?? [];

    const mapAsueto = (asueto: any) => {
      const fechaStr = asueto.fecha || '';
      let fechaDate: Date | undefined;

      if (fechaStr) {
        try {
          fechaDate = new Date(fechaStr);
          if (isNaN(fechaDate.getTime())) {
            fechaDate = undefined;
          }
        } catch {
          fechaDate = undefined;
        }
      }

      return {
        fecha: fechaStr,
        motivo: asueto.motivo || 'Indefinido',
        pais: asueto.pais || 'Indefinido',
        row_number: asueto.id || asueto.row_number || 0,
        fechaDate: fechaDate
      };
    };

    const asuetos = asuetosArray.map(mapAsueto);

    asuetos.sort((a, b) => {
      if (a.fechaDate && b.fechaDate) {
        return a.fechaDate.getTime() - b.fechaDate.getTime();
      }
      return a.fecha.localeCompare(b.fecha);
    });

    return asuetos;
  },

  // ==================== PARÁMETROS FINALES ====================

  /**
   * Leer todos los parámetros desde el backend directo
   */
  async readParametros(): Promise<any[]> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/parametros`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
    });

    if (!response.ok) {
      throw new Error('Error al leer los parámetros');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  /**
   * Crear un nuevo parámetro de estado final
   */
  async createParametro(parametroData: {
    nombre_parametro: string;
    descripcion: string;
    id_estado_final: string;
    tipo: string;
    etiqueta: string;
    placeholder?: string;
    requerido?: boolean;
  }): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/parametros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify(parametroData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al crear el parámetro');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  },

  /**
   * Eliminar un parámetro de estado final
   */
  async deleteParametro(id: string): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/parametros/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar el parámetro');
    }

    return response.json();
  },

  async updateUser(id: string, data: any): Promise<any> {
    const response = await fetch(`${API_CONFIG.WEBHOOK_URL}/api/usuarios/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al actualizar el usuario");
    }

    return response.json();
  }
};
