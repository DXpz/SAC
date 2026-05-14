// Configuración de la API y Webhooks
export const API_CONFIG = {
  // URL del backend directo via ngrok (sin /api porque los paths ya lo incluyen)
  WEBHOOK_URL: import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev',
  
  // URLs del backend (todas incluyen /api)
  WEBHOOK_AGENTES_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/agentes',
  WEBHOOK_CREAR_USUARIO_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/usuarios',
  WEBHOOK_CASOS_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/casos',
  WEBHOOK_ROUND_ROBIN_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/round-robin',
  WEBHOOK_CATEGORIAS_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/categorias',
  WEBHOOK_ESTADOS_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/estados',
  WEBHOOK_ASUETOS_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/asuetos',
  WEBHOOK_CLIENTES_URL: (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/clientes',
  
  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 30000,
  
  // Modo demo: deshabilitado
  DEMO_MODE_FALLBACK: false,
};

// Webhook específico para gestión de CASOS
export const CASES_WEBHOOK_URL = (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/casos';

// Webhook específico para gestión de CLIENTES
export const CLIENTS_WEBHOOK_URL = (import.meta.env.VITE_WEBHOOK_URL || 'https://kailee-chorial-toshiko.ngrok-free.dev') + '/api/clientes';

