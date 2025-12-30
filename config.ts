// Configuración de la API y Webhooks
export const API_CONFIG = {
  // URL del webhook de n8n para autenticación y gestión de usuarios
  // En desarrollo se recomienda usar el proxy de Vite configurado en vite.config.ts
  WEBHOOK_URL: import.meta.env.VITE_WEBHOOK_URL || '/api/webhook/auth',
  
  // Timeout para las peticiones (en milisegundos)
  TIMEOUT: 30000, // Aumentado a 30 segundos para dar más tiempo
  
  // Modo demo: deshabilitado - solo se permite acceso con webhook
  DEMO_MODE_FALLBACK: false,
};

// Webhook específico para gestión de CASOS (listado/creación) en n8n
// En desarrollo apunta a un endpoint relativo que pasa por el proxy de Vite
// En producción puedes sobreescribirlo con la URL completa del webhook de n8n
export const CASES_WEBHOOK_URL =
  import.meta.env.VITE_CASES_WEBHOOK_URL || '/api/casos';

// Webhook específico para gestión de CLIENTES en n8n
// En desarrollo apunta a un endpoint relativo que pasa por el proxy de Vite
// En producción puedes sobreescribirlo con la URL completa del webhook de n8n
export const CLIENTS_WEBHOOK_URL =
  import.meta.env.VITE_CLIENTS_WEBHOOK_URL || '/api/clientes';

