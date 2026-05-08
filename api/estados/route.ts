import type { VercelRequest, VercelResponse } from '@vercel/node';

const N8N_ESTADOS_URL = 'https://n8n.red.com.sv/webhook/837e1ddf-3677-411d-9aca-9b5095a42ecd';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, body } = req;

  if (method === 'POST') {
    try {
      const response = await fetch(N8N_ESTADOS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch estados' });
      }

      const data = await response.json();

      const transformedData = Array.isArray(data)
        ? data.map((est: any) => ({
            id: String(est.id || ''),
            name: est.nombre_estado || est.name || '',
            order: Number(est.orden || est.order || 0),
            isFinal: est.estado_final === true || est.isFinal === true || est.is_final === true || false
          }))
        : data;

      return res.status(200).json(transformedData);
    } catch (error) {
      return res.status(500).json({ error: 'Proxy error', message: (error as Error).message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}