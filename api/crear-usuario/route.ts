import type { VercelRequest, VercelResponse } from '@vercel/node';

const N8N_USUARIOS_URL = 'https://n8n.red.com.sv/webhook/usuarios-workflow';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, body } = req;

  if (method === 'POST') {
    try {
      const response = await fetch(N8N_USUARIOS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to create user' });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Proxy error', message: (error as Error).message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}