// Configuración de la API y Webhooks
export const API_CONFIG = {
  // URL del webhook de n8n para autenticación y gestión de usuarios
  // En desarrollo usa el proxy de Vite (/api/webhook/auth), en producción usa la URL completa
  WEBHOOK_URL: import.meta.env.VITE_WEBHOOK_URL || '/api/webhook/auth',
  
  // URL del webhook de n8n para almacenar/actualizar agentes (entorno de pruebas)
  // En desarrollo usa el proxy de Vite (/api/agentes), en producción usa la URL completa
  WEBHOOK_AGENTES_URL: import.meta.env.VITE_WEBHOOK_AGENTES_URL || '/api/agentes',
  
  // URL del webhook de n8n para crear nuevos usuarios desde admin
  // En desarrollo usa el proxy de Vite (/api/crear-usuario), en producción usa la URL completa
  WEBHOOK_CREAR_USUARIO_URL: import.meta.env.VITE_WEBHOOK_CREAR_USUARIO_URL || '/api/crear-usuario',
  
  // URL del webhook de n8n para la gestión de casos (CRUD)
  // En desarrollo usa el proxy de Vite (/api/casos), en producción usa la URL completa
  WEBHOOK_CASOS_URL: import.meta.env.VITE_WEBHOOK_CASOS_URL || '/api/casos',
  
  // URL del webhook de n8n para Round Robin de agentes
  // En desarrollo usa el proxy de Vite (/api/round-robin), en producción usa la URL completa
  WEBHOOK_ROUND_ROBIN_URL: import.meta.env.VITE_WEBHOOK_ROUND_ROBIN_URL || '/api/round-robin',
  
  // URL del webhook de n8n para gestión de categorías
  // En desarrollo usa el proxy de Vite (/api/categorias), en producción usa la URL completa
  WEBHOOK_CATEGORIAS_URL: (import.meta.env as any).VITE_WEBHOOK_CATEGORIAS_URL || '/api/categorias',
  
  // URLs completas de n8n (para referencia y uso en producción)
  // Estas URLs se usan cuando VITE_WEBHOOK_*_URL está definido o en producción
  // Authentication Workflow
  WEBHOOK_URL_FULL: 'https://n8n.red.com.sv/webhook/auth-workflow',
  // Agentes Workflow
  WEBHOOK_AGENTES_URL_FULL: 'https://n8n.red.com.sv/webhook/d804c804-9841-41f7-bc4b-66d2edeed53b',
  // Usuarios Workflow
  WEBHOOK_CREAR_USUARIO_URL_FULL: 'https://n8n.red.com.sv/webhook/usuarios-workflow',
  // Casos Workflow
  WEBHOOK_CASOS_URL_FULL: 'https://n8n.red.com.sv/webhook/97a6c0f7-ea50-4542-b99e-710b96b58652',
  // Round Robin
  WEBHOOK_ROUND_ROBIN_URL_FULL: 'https://n8n.red.com.sv/webhook-test/case-create-round-robin',
  // Clientes Workflow
  WEBHOOK_CLIENTES_URL_FULL: 'https://n8n.red.com.sv/webhook/clientes-workflow',
  // Categorias Workflow
  WEBHOOK_CATEGORIAS_URL_FULL: 'https://n8n.red.com.sv/webhook/3064d26b-a4b3-40ac-9f65-0835bcaf99f5',
  // Estados Workflow
  WEBHOOK_ESTADOS_URL_FULL: 'https://n8n.red.com.sv/webhook/837e1ddf-3677-411d-9aca-9b5095a42ecd',
  // Asuetos Workflow
  WEBHOOK_ASUETOS_URL_FULL: 'https://n8n.red.com.sv/webhook/asuetos-workflow',
  
  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 30000, // Aumentado a 30 segundos para dar más tiempo
  
  // Modo demo: deshabilitado - solo se permite acceso con webhook
  DEMO_MODE_FALLBACK: false,
};

// Webhook específico para gestión de CASOS (listado/creación) en n8n
// En desarrollo apunta a un endpoint relativo que pasa por el proxy de Vite
// En producción puedes sobreescribirlo con la URL completa del webhook de n8n
// NOTA: Se mantiene por compatibilidad, pero se recomienda usar API_CONFIG.WEBHOOK_CASOS_URL
export const CASES_WEBHOOK_URL =
  import.meta.env.VITE_CASES_WEBHOOK_URL || API_CONFIG.WEBHOOK_CASOS_URL || '/api/casos';

// Webhook específico para gestión de CLIENTES en n8n
// En desarrollo apunta a un endpoint relativo que pasa por el proxy de Vite
// En producción puedes sobreescribirlo con la URL completa del webhook de n8n
export const CLIENTS_WEBHOOK_URL =
  import.meta.env.VITE_CLIENTS_WEBHOOK_URL || '/api/clientes';

