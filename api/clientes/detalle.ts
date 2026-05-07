import type { VercelRequest, VercelResponse } from '@vercel/node';

const SAP_API_BASE = 'https://sapapi.red.com.sv/api';
const SAP_API_KEY = process.env.SAP_API_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, query } = req;

  if (method === 'GET') {
    const criterio = query.criterio as string;
    const pais = (query.pais as string) || 'SV';

    if (!criterio) {
      return res.status(400).json({ error: 'Missing criterio parameter' });
    }

    try {
      const response = await fetch(`${SAP_API_BASE}/cliente/infocliente?criterio=${encodeURIComponent(criterio)}&var_pais=${pais}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': SAP_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch cliente detalle' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Proxy error', message: (error as Error).message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}