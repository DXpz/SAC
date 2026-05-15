const SAP_API_BASE = 'https://sapapi.red.com.sv/api/cliente';
const API_KEY = 'fdf0cb340b00402c00a057b0f67c00a3';

const headers = {
  'X-API-KEY': API_KEY,
  'Content-Type': 'application/json'
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
  ClienteRedPtt: string;
  ClienteAnalogo: string;
  ClienteDatared: string;
  ClienteInfra: string;
  AnexosPtt: string;
  AnexosAnalogo: string;
  AnexosSirv: string;
  AnexosTracker: string;
  AnexosIden: string;
  Telefono1: string;
  Telefono2: string;
  TelefonoMovil: string;
  Departamento: string;
  Municipio: string;
  TelefonoVentas: string;
  CorreoVentas: string;
  ContactoVentas: string;
  TelefonoCobros: string;
  CorreoCobros: string;
  ContactoCobros: string;
  TelefonoServicioCliente: string;
  CorreoServicioCliente: string;
  ContactoServicioCliente: string;
  TelefonoRepresentanteLegal: string;
  CorreoRepresentanteLegal: string;
  ContactoRepresentanteLegal: string;
  CLASIFICACION: string;
  GestorCobro: string;
}

export const sapService = {
  async getClientesListado(pais: 'SV' | 'GT' = 'SV'): Promise<ClienteListado[]> {
    const paisParam = pais === 'SV' ? 'SV' : 'GT';
    const url = `${SAP_API_BASE}/consulta?var_pais=${paisParam}`;

    try {
      const response = await fetch(url, { headers });

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
      throw err;
    }
  },

  async getClienteDetalle(codigo: string, pais: 'SV' | 'GT' = 'SV'): Promise<ClienteDetalle | null> {
    const paisParam = pais === 'SV' ? 'SV' : 'GT';
    const url = `${SAP_API_BASE}/infocliente?criterio=${encodeURIComponent(codigo)}&var_pais=${paisParam}`;

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
