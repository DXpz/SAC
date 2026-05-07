import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        cors: true,
        proxy: {
          // Autenticación (login/usuarios) - se puede sobreescribir vía VITE_WEBHOOK_URL
          '/api/webhook/auth': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/6f27bb4b-bfcd-4776-b554-5194569be2a7',
          },
          // Casos (lista / creación) - usa el webhook de casos que compartiste
          '/api/casos': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/97a6c0f7-ea50-4542-b99e-710b96b58652',
          },
          // Clientes SAP - proxy para desarrollo local
          '/api/clientes': {
            target: 'https://sapapi.red.com.sv/api',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/api\/clientes/, '/cliente'),
          },
          // Agentes (gestión de agentes) - webhook para almacenar/actualizar agentes
          '/api/agentes': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/d804c804-9841-41f7-bc4b-66d2edeed53b',
          },
          // Crear usuario (admin) - webhook para crear nuevos usuarios desde admin
          '/api/crear-usuario': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/8679122d-c982-4cc8-92a9-7591ef887d61',
          },
          // Round Robin (asignación de agentes) - webhook para Round Robin
          '/api/round-robin': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook-test/case-create-round-robin',
          },
          // Cierre de caso con anexos - webhook para cerrar casos
          '/api/case-close': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/d967cdf7-aa21-4d63-95e8-918dff18cf2b',
          },
          // Categorías - proxy para desarrollo local
          '/api/categorias': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/3064d26b-a4b3-40ac-9f65-0835bcaf99f5',
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
