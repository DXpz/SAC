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
          // Clientes (lista) - webhook para obtener lista de clientes
          '/api/clientes': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook/b30aeff4-1d3a-4b40-b8da-141b4e1fc5b6',
          },
          // Agentes (gestión de agentes) - webhook para almacenar/actualizar agentes
          '/api/agentes': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook-test/d804c804-9841-41f7-bc4b-66d2edeed53b',
          },
          // Round Robin (asignación de agentes) - webhook para Round Robin
          '/api/round-robin': {
            target: 'https://n8n.red.com.sv',
            changeOrigin: true,
            secure: true,
            rewrite: () => '/webhook-test/case-create-round-robin',
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
