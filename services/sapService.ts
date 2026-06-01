import { API_CONFIG } from '../config';

const BACKEND_URL = API_CONFIG.WEBHOOK_URL;

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true'
};

export interface ClienteListado {
  CardCode: string;
  CardName: string;
  estado: string;
}

export interface ClienteDetalle {
  Codigo: string;
  Nombre: string;
  Categoria: string;
  Correo: string;
  Vertical: string;
  Industria: string;
  ActividadEconomica: string;
  Giro: string;
  Ejecutivo: string;
  Cobros: string;
  Sac: string;
  TotalAnexos: string;
  AnexosBloqueados: string;
  AnexosInhibidos: string;
  AnexosBloqueadosInhibidos: string;
}

export const sapService = {
  async getClientesListado(pais: 'SV' | 'GT' = 'SV'): Promise<ClienteListado[]> {
    const url = `${BACKEND_URL}/api/sap/clientes?var_pais=${pais}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        return data;
      }

      return [];
    } catch (err) {
      console.error('[sapService] Error fetching clientes:', err);
      return [];
    }
  },

  async getClienteDetalle(codigo: string, pais: 'SV' | 'GT' = 'SV'): Promise<ClienteDetalle | null> {
    const url = `${BACKEND_URL}/api/sap/clientes/${encodeURIComponent(codigo)}/${pais}`;

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }

      if (data && typeof data === 'object') {
        return data as ClienteDetalle;
      }

      return null;
    } catch (err) {
      console.error('[sapService] Error fetching cliente detalle:', err);
      throw err;
    }
  }
};
