// Configuración de la API y Webhooks
const BACKEND_URL = import.meta.env.VITE_WEBHOOK_URL || 'https://sac.red.com.sv';

export const API_CONFIG = {
  // URL del backend directo (sin /api porque los paths ya lo incluyen)
  WEBHOOK_URL: BACKEND_URL,

  // URLs del backend (todas incluyen /api)
  WEBHOOK_AGENTES_URL: BACKEND_URL + '/api/agentes',
  WEBHOOK_CREAR_USUARIO_URL: BACKEND_URL + '/api/usuarios',
  WEBHOOK_CASOS_URL: BACKEND_URL + '/api/casos',
  WEBHOOK_ROUND_ROBIN_URL: BACKEND_URL + '/api/round-robin',
  WEBHOOK_CATEGORIAS_URL: BACKEND_URL + '/api/categorias',
  WEBHOOK_ESTADOS_URL: BACKEND_URL + '/api/estados',
  WEBHOOK_ASUETOS_URL: BACKEND_URL + '/api/asuetos',
  WEBHOOK_CLIENTES_URL: BACKEND_URL + '/api/clientes',

  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 30000,

  // Modo demo: deshabilitado
  DEMO_MODE_FALLBACK: false,
};

// Webhook específico para gestión de CASOS
export const CASES_WEBHOOK_URL = BACKEND_URL + '/api/casos';

// Webhook específico para gestión de CLIENTES
export const CLIENTS_WEBHOOK_URL = BACKEND_URL + '/api/clientes';