// Configuración de la API y Webhooks
export const API_CONFIG = {
  // URL del backend directo via ngrok
  WEBHOOK_URL: import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev/api',
  
  // URLs del backend
  WEBHOOK_AGENTES_URL: import.meta.env.VITE_WEBHOOK_URL + '/agentes',
  WEBHOOK_CREAR_USUARIO_URL: import.meta.env.VITE_WEBHOOK_URL + '/usuarios',
  WEBHOOK_CASOS_URL: import.meta.env.VITE_WEBHOOK_URL + '/casos',
  WEBHOOK_ROUND_ROBIN_URL: import.meta.env.VITE_WEBHOOK_URL + '/round-robin',
  WEBHOOK_CATEGORIAS_URL: import.meta.env.VITE_WEBHOOK_URL + '/categorias',
  WEBHOOK_ESTADOS_URL: import.meta.env.VITE_WEBHOOK_URL + '/estados',
  WEBHOOK_ASUETOS_URL: import.meta.env.VITE_WEBHOOK_URL + '/asuetos',
  WEBHOOK_CLIENTES_URL: import.meta.env.VITE_WEBHOOK_URL + '/clientes',
  
  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 30000,
  
  // Modo demo: deshabilitado
  DEMO_MODE_FALLBACK: false,
};

// Webhook específico para gestión de CASOS
export const CASES_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL + '/casos';

// Webhook específico para gestión de CLIENTES
export const CLIENTS_WEBHOOK_URL = import.meta.env.VITE_WEBHOOK_URL + '/clientes';

