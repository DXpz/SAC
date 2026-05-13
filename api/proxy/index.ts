import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM_BASE = process.env.UPSTREAM_BASE || 'http://200.35.189.139:4000';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url, headers, body } = req;

  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-KEY');
    return res.status(204).end();
  }

  const targetUrl = `${UPSTREAM_BASE}/api${url.split('/api')[1] || ''}`;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': headers['content-type'] || 'application/json',
    'X-API-KEY': process.env.API_KEY || '',
    'ngrok-skip-browser-warning': 'true',
  };

  const authHeader = headers['authorization'];
  if (authHeader) upstreamHeaders['Authorization'] = authHeader;

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: upstreamHeaders,
    };

    if (method !== 'GET' && method !== 'HEAD' && body) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type');
    const data = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.status(response.status).send(data);
  } catch (error) {
    console.error('[proxy] Error:', error);
    return res.status(502).json({ error: 'Proxy error', message: (error as Error).message });
  }
}