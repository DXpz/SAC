const API_BASE = import.meta.env.DEV
  ? '/api/clientes'
  : (import.meta.env.VITE_API_URL || '/api/clientes');

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
    const url = `${API_BASE}/listado?pais=${pais}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sapService] API Error:', response.status, errorText);
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      let result: ClienteListado[] = [];

      if (Array.isArray(data)) {
        result = data;
      } else if (data?.clientes && Array.isArray(data.clientes)) {
        result = data.clientes;
      } else if (data?.data && Array.isArray(data.data)) {
        result = data.data;
      }

      return result;
    } catch (err) {
      console.error('[sapService] Error fetching clientes:', err);
      throw err;
    }
  },

  async getClienteDetalle(codigo: string, pais: 'SV' | 'GT' = 'SV'): Promise<ClienteDetalle | null> {
    const url = `${API_BASE}/detalle?criterio=${encodeURIComponent(codigo)}&pais=${pais}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      let result: ClienteDetalle | null = null;

      if (Array.isArray(data) && data.length > 0) {
        result = data[0];
      } else if (data?.cliente) {
        result = data.cliente;
      } else if (data?.data) {
        result = data.data;
      }

      return result;
    } catch (err) {
      console.error('[sapService] Error fetching cliente detalle:', err);
      throw err;
    }
  }
};
