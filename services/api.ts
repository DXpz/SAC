
import { Case, CaseStatus, KPI, User, Role, Cliente, Categoria } from '../types';
import { MOCK_CASOS, MOCK_AGENTES, MOCK_USERS, MOCK_CLIENTES, MOCK_CATEGORIAS } from './mockData';
import { API_CONFIG, CASES_WEBHOOK_URL, CLIENTS_WEBHOOK_URL } from '../config';

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
    const user = this.getUser();
    
    // Intentar obtener casos desde n8n
    try {
      const response = await callCasesWebhook<any>('POST', {
        action: 'case.read',
        actor: buildActorPayload(user),
        data: {
          // Sin case_id para obtener todos los casos
        },
      });

      // Log detallado de la respuesta para debugging
      console.log('🔍 Respuesta completa de n8n para case.read:', {
        response,
        type: typeof response,
        isArray: Array.isArray(response),
        isNull: response === null,
        isUndefined: response === undefined,
        isEmpty: response === null || response === undefined || (Array.isArray(response) && response.length === 0) || (typeof response === 'object' && Object.keys(response).length === 0),
        keys: response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response) : null,
        stringified: JSON.stringify(response).substring(0, 1000)
      });

      // Función helper para mapear un caso de n8n/Google Sheets al formato Case
      const mapCase = (c: any): Case => {
        // Manejar formato de Google Sheets (columnas directas) o formato JSON anidado
        const caseId = c.case_id || c.idCaso || c.id || c.ticket_number || c.ticketNumber || '';
        
        // Fecha de creación - puede venir en formato dd/MM/yyyy desde Google Sheets
        let createdAt = c.created_at || c.createdAt || c.fecha_creacion || new Date().toISOString();
        if (typeof createdAt === 'string' && createdAt.includes('/')) {
          // Convertir formato dd/MM/yyyy a ISO
          const [day, month, year] = createdAt.split('/');
          createdAt = new Date(`${year}-${month}-${day}`).toISOString();
        }
        
        const createdDate = new Date(createdAt);
        const now = new Date();
        const diasAbierto = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

        // Obtener información del agente (desde Google Sheets o formato JSON)
        const agenteId = c.agente_user_id || c.agente_asignado?.user_id || c.agenteAsignado?.idAgente || c.agent_id || c.agentId || '';
        const agenteEmail = c.agente_email || c.agente_asignado?.email || c.agenteAsignado?.email || '';
        const agenteName = c.agente_nombre || c.agente_asignado?.nombre || c.agenteAsignado?.nombre || agenteEmail || 'Sin asignar';

        // Obtener información de la categoría
        const categoriaId = String(c.categoria_id || c.categoria?.categoria_id || c.category?.id || '');
        let categoriaNombre = c.categoria?.nombre || c.category?.name || c.category_name || c.category || 'General';
        let categoriaSla = c.categoria?.slaDias || c.categoria?.sla_dias || c.category?.sla || 5;
        
        // Si no tenemos nombre de categoría, usar un valor por defecto
        if (!categoriaNombre || categoriaNombre === 'General') {
          categoriaNombre = 'General';
          categoriaSla = 5;
        }

        // Obtener información del cliente
        const clienteId = c.cliente_id || c.cliente?.cliente_id || c.client?.idCliente || c.client_id || c.clientId || '';
        let clienteNombre = c.cliente?.nombre_empresa || c.cliente?.nombreEmpresa || c.client?.nombre || c.client_name || c.clientName || '';
        let clienteEmail = c.email_cliente || c.cliente?.email || c.client?.email || c.client_email || c.clientEmail || '';
        let clienteTelefono = c.telefono_cliente || c.cliente?.telefono || c.client?.phone || c.client_phone || c.clientPhone || '';
        let clienteContacto = c.cliente?.contacto_principal || c.cliente?.contactoPrincipal || c.client?.contacto || '';
        
        // Si no tenemos datos del cliente, usar valores por defecto
        if (!clienteNombre && clienteId) {
          clienteNombre = `Cliente ${clienteId}`;
        }

        // Calcular si el SLA está vencido
        const slaDias = categoriaSla;
        const slaExpired = diasAbierto > slaDias;

        return {
          id: caseId,
          ticketNumber: caseId,
          clientId: clienteId,
          clientName: clienteNombre,
          category: categoriaNombre,
          origin: c.canal_origen || c.canalOrigen || c.origin || c.channel || 'Web',
          subject: c.asunto || c.subject || '',
          description: c.descripcion || c.description || '',
          status: c.estado || c.status || CaseStatus.NUEVO,
          priority: c.prioridad || c.priority || 'Media',
          agentId: String(agenteId),
          agentName: agenteName,
          createdAt: createdAt,
          slaExpired: slaExpired,
          history: c.historial || c.history || [],
          clientEmail: clienteEmail,
          clientPhone: clienteTelefono,
          diasAbierto: diasAbierto,
          agenteAsignado: {
            idAgente: String(agenteId),
            nombre: agenteName,
            email: agenteEmail,
            estado: 'Activo' as any,
            ordenRoundRobin: 0,
            ultimoCasoAsignado: '',
            casosActivos: 0,
          },
          categoria: {
            idCategoria: String(categoriaId || ''),
            nombre: categoriaNombre,
            slaDias: categoriaSla,
            diasAlertaSupervisor: Math.floor(categoriaSla * 0.7),
            diasAlertaGerente: Math.floor(categoriaSla * 0.9),
            activa: true,
          },
          cliente: {
            idCliente: clienteId,
            nombreEmpresa: clienteNombre,
            contactoPrincipal: clienteContacto,
            email: clienteEmail,
            telefono: clienteTelefono,
            pais: c.cliente?.pais || c.client?.country || 'El Salvador',
            estado: c.cliente?.estado || c.client?.state || 'Activo',
          },
        };
      };

      // Intentar diferentes formatos de respuesta de n8n
      // El workflow de n8n lee de Google Sheets, así que puede venir como array directo
      // o dentro de alguna propiedad
      let casesArray: any[] = [];

      // Verificar si la respuesta es solo un objeto de confirmación (problema conocido del workflow)
      if (response?.ok === "true" || response?.ok === true || (response && Object.keys(response).length === 1 && response.ok)) {
        const errorMsg = `El workflow de n8n está devolviendo solo {"ok": "true"} en lugar de los datos de casos.

SOLUCIÓN REQUERIDA EN N8N:
1. Abre el workflow "[JROMERO] CASOS - APP SAC" en n8n
2. Localiza el nodo "Respond to Webhook2" (conectado después de "TODOS LOS CASOS")
3. Cambia la configuración:
   - En lugar de: responseBody = {"ok": "true"}
   - Usa: responseBody = {{ $json }} (para devolver todos los datos)
   O mejor aún, configura el nodo para usar "Respond with All Incoming Items" o devolver $json.json si los datos vienen en esa propiedad

Respuesta recibida: ${JSON.stringify(response)}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (Array.isArray(response)) {
        // Caso 1: Array directo de casos (formato más común de Google Sheets)
        // Verificar si el primer elemento tiene estructura de caso o es un wrapper
        if (response.length > 0) {
          const firstItem = response[0];
          
          // Caso 1a: Array de objetos con propiedad 'data' que contiene los casos
          // Formato: [{data: [caso1, caso2, ...]}]
          if (firstItem?.data && Array.isArray(firstItem.data)) {
            console.log('📦 Formato detectado: Array con objetos que tienen propiedad "data"');
            // Extraer todos los casos de todos los objetos en el array
            casesArray = response.flatMap((item: any) => item.data || []);
          }
          // Caso 1b: Array directo de casos
          // Formato: [caso1, caso2, ...]
          else if (firstItem?.case_id || firstItem?.row_number !== undefined) {
            console.log('📦 Formato detectado: Array directo de casos');
            casesArray = response;
          }
          // Caso 1c: Array de objetos con otras propiedades anidadas
          else {
            console.log('📦 Formato detectado: Array de objetos, intentando extraer casos...');
            // Intentar extraer de propiedades comunes
            const allCases: any[] = [];
            response.forEach((item: any) => {
              if (Array.isArray(item.data)) {
                allCases.push(...item.data);
              } else if (Array.isArray(item.cases)) {
                allCases.push(...item.cases);
              } else if (Array.isArray(item.result)) {
                allCases.push(...item.result);
              } else if (item.case_id || item.row_number !== undefined) {
                // Es un caso individual
                allCases.push(item);
              }
            });
            casesArray = allCases;
          }
        } else {
          // Array vacío
          casesArray = [];
        }
      } else if (response?.cases && Array.isArray(response.cases)) {
        // Si viene dentro de una propiedad 'cases'
        casesArray = response.cases;
      } else if (response?.data && Array.isArray(response.data)) {
        // Si viene dentro de una propiedad 'data'
        casesArray = response.data;
      } else if (response?.result && Array.isArray(response.result)) {
        // Si viene dentro de una propiedad 'result'
        casesArray = response.result;
      } else if (response?.rows && Array.isArray(response.rows)) {
        // Formato alternativo de Google Sheets
        casesArray = response.rows;
      } else if (response?.values && Array.isArray(response.values)) {
        // Otro formato posible de Google Sheets
        casesArray = response.values;
      } else if (response?.json && Array.isArray(response.json)) {
        // Formato cuando n8n devuelve los datos en response.json (común en workflows)
        casesArray = response.json;
      } else if (response?.body && Array.isArray(response.body)) {
        // Formato alternativo con body
        casesArray = response.body;
      }

      if (casesArray.length > 0) {
        console.log(`✅ Se encontraron ${casesArray.length} casos en la respuesta de n8n`);
        const mappedCases = casesArray.map(mapCase);
        
        // Si es agente, filtrar solo sus casos
        if (user?.role === 'AGENTE') {
          const userAgentId = String((user as any).user_id ?? user.id);
          const filteredCases = mappedCases.filter(c => 
            c.agentId === userAgentId ||
            c.agentName === user.name ||
            c.agenteAsignado.idAgente === userAgentId
          );
          console.log(`📋 Casos filtrados para agente ${user.name}: ${filteredCases.length} de ${mappedCases.length}`);
          return filteredCases;
        }
        
        // Retornar casos directamente desde n8n (sin guardar en localStorage)
        console.log(`📋 Retornando ${mappedCases.length} casos sin filtrar`);
        return mappedCases;
      }

      // Si casesArray está vacío, puede ser que:
      // 1. No hay casos en Google Sheets
      // 2. El workflow no está devolviendo los datos correctamente
      // 3. El formato de respuesta no es el esperado
      console.warn('⚠️ No se encontraron casos en la respuesta. casesArray está vacío.', {
        responseType: typeof response,
        isArray: Array.isArray(response),
        responseKeys: response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response) : null,
        responseValue: response,
        responseStringified: JSON.stringify(response).substring(0, 500)
      });
      
      // Si la respuesta existe pero está vacía, puede ser que:
      // - No hay casos en Google Sheets (retornar array vacío)
      // - El workflow devolvió un objeto vacío o null
      if (response !== null && response !== undefined) {
        // Si es un array vacío, simplemente no hay casos
        if (Array.isArray(response) && response.length === 0) {
          console.log('ℹ️ La respuesta es un array vacío. No hay casos en el sistema.');
          return [];
        }
        
        // Si es un objeto vacío
        if (typeof response === 'object' && !Array.isArray(response) && Object.keys(response).length === 0) {
          console.log('ℹ️ La respuesta es un objeto vacío. No hay casos en el sistema.');
          return [];
        }
        
        // Si tiene propiedades pero no encontramos casos, puede ser formato desconocido
        console.warn('⚠️ La respuesta tiene contenido pero no se pudo extraer casos. Formato desconocido.');
      }

      // Si la respuesta no tiene el formato esperado, lanzar error con más detalles
      const responseInfo = {
        response,
        responseType: typeof response,
        isArray: Array.isArray(response),
        isNull: response === null,
        isUndefined: response === undefined,
        keys: response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response) : null,
        stringified: JSON.stringify(response).substring(0, 500),
        hasOk: response?.ok !== undefined,
        okValue: response?.ok
      };
      
      console.error('Respuesta de n8n no tiene el formato esperado para casos:', responseInfo);
      
      let errorDetails = `Formato de respuesta no válido desde el servidor.\n\n`;
      errorDetails += `ANÁLISIS DE LA RESPUESTA:\n`;
      errorDetails += `- Tipo: ${responseInfo.responseType}\n`;
      errorDetails += `- Es array: ${responseInfo.isArray}\n`;
      errorDetails += `- Es null: ${responseInfo.isNull}\n`;
      errorDetails += `- Es undefined: ${responseInfo.isUndefined}\n`;
      if (responseInfo.keys) {
        errorDetails += `- Propiedades encontradas: ${responseInfo.keys.join(', ')}\n`;
      }
      if (responseInfo.hasOk) {
        errorDetails += `- Tiene propiedad "ok": ${responseInfo.okValue}\n`;
      }
      errorDetails += `\nRESPUESTA RECIBIDA (primeros 500 caracteres):\n${responseInfo.stringified}\n\n`;
      errorDetails += `SOLUCIÓN REQUERIDA EN N8N:\n`;
      errorDetails += `El nodo "Respond to Webhook2" debe devolver los datos del nodo "TODOS LOS CASOS".\n`;
      errorDetails += `Configura el nodo para devolver $json o $json.json en lugar de {"ok": "true"}`;
      
      throw new Error(errorDetails);
    } catch (err) {
      console.error('Error al obtener casos desde n8n:', err);
      // No usar fallback local, lanzar el error para que el componente lo maneje
      throw err;
    }
  },

  async getCasoById(id: string): Promise<Case | undefined> {
    const cases = await this.getCases();
    return cases.find(c => c.id === id || c.idCaso === id || c.ticketNumber === id);
  },

  async updateCaseStatus(id: string, status: string, detail: string, extra?: any): Promise<boolean> {
    const user = this.getUser();

    // 1) Notificar cambio de estado a n8n usando el contrato CRUD.UPDATE
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
    } catch (err) {
      console.warn('Error al actualizar caso en n8n, aplicando cambio solo en local.', err);
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

    console.log('📤 ========== PAYLOAD COMPLETO PARA N8N ==========');
    console.log('URL del webhook:', CASES_WEBHOOK_URL);
    console.log('Payload JSON:', JSON.stringify(n8nPayload, null, 2));
    console.log('Payload tamaño:', JSON.stringify(n8nPayload).length, 'bytes');

    // 1) Intentar crear el caso en el backend n8n usando el contrato CRUD.CREATE (no bloquea la creación local)
    try {
      console.log('🌐 Enviando petición POST a n8n...');
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
      
      console.log('✅ Caso enviado exitosamente a n8n');
    } catch (err: any) {
      console.error('❌ ========== ERROR AL ENVIAR A N8N ==========');
      console.error('Error completo:', err);
      console.error('Tipo de error:', typeof err);
      console.error('Mensaje:', err?.message);
      console.error('Stack:', err?.stack);
      if (err?.response) {
        console.error('Response del error:', err.response);
      }
      console.warn('⚠️ Error al crear caso en n8n, usando modo local como fallback.');
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
    return {
      totalCases: cases.length,
      slaCompliance: 85,
      csatScore: 4.2
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
    initStorage();
    const data = localStorage.getItem('intelfon_agents');
    return data ? JSON.parse(data) : MOCK_AGENTES;
  },

  // Obtener lista de clientes desde n8n
  async getClientes(): Promise<Cliente[]> {
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
        return clientesArray.map(mapCliente);
      }

      // Si la respuesta no tiene el formato esperado, usar fallback
      console.warn('Respuesta de n8n no tiene el formato esperado, usando datos mock', response);
      return MOCK_CLIENTES;
    } catch (err) {
      console.warn('Error al obtener clientes desde n8n, usando datos mock como fallback.', err);
      return MOCK_CLIENTES;
    }
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

  // Crear nueva cuenta con webhook (type: register)
  // SOLO el supervisor puede crear cuentas, y DEBE pasar por el webhook de Make.com
  // El usuario se almacena directamente en el sistema a través del webhook
  async createAccount(email: string, password: string, name: string, additionalData?: any): Promise<User> {
    // Validaciones previas
    if (!email || !email.trim()) {
      throw new Error('El correo electrónico es requerido');
    }
    if (!password || !password.trim() || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    if (!name || !name.trim()) {
      throw new Error('El nombre es requerido');
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Formato de correo electrónico inválido');
    }
    
    // Llamar al webhook de Make.com para crear y almacenar el usuario
    // Make.com retorna: { id, name, role, email } cuando es correcto
    // O: { error: true, message: "..." } cuando hay error
    const data = await callWebhook('new_account', {
      email: email.trim().toLowerCase(),
      password: password.trim(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      ...additionalData
    });
    
    // callWebhook ya normaliza la respuesta, así que esperamos { token, user }
    // Si no hay token o user, significa que el sistema no pudo crear/almacenar el usuario
    if (!data.token || !data.user) {
      throw new Error('Error al crear la cuenta. El usuario no pudo ser almacenado en el sistema. Verifica que el webhook esté configurado correctamente.');
    }

    // Validar estructura completa del usuario almacenado
    if (!data.user.id || !data.user.name || !data.user.role) {
      throw new Error('La cuenta fue creada pero no tiene información completa. El usuario no se almacenó correctamente en el sistema.');
    }

    // Validar que el rol sea válido
    if (!['AGENTE', 'SUPERVISOR', 'GERENTE'].includes(data.user.role)) {
      throw new Error('Rol de usuario inválido. La cuenta debe tener un rol válido asignado.');
    }

    // Almacenar el token (el usuario ya está almacenado en el sistema)
    localStorage.setItem('intelfon_token', data.token);
    
    // Almacenar información del usuario EXACTAMENTE como viene del webhook
    // Esto confirma que el usuario fue almacenado exitosamente
    const user: User = {
      id: data.user.id,
      name: data.user.name.trim(),
      role: data.user.role,
      avatar: data.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.user.name)}&background=0f172a&color=fff`
    };

    localStorage.setItem('intelfon_user', JSON.stringify(user));
    
    // El usuario ha sido creado y almacenado exitosamente en el sistema
    return user;
  }
};
