import type { VercelRequest, VercelResponse } from '@vercel/node';

const UPSTREAM_BASE = process.env.UPSTREAM_BASE || 'http://200.35.189.139:4000';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url, query, headers, body } = req;

  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-KEY');
    return res.status(204).end();
  }

  const urlObj = new URL(url, 'https://sac-ruby.vercel.app');
  const endpoint = urlObj.searchParams.get('endpoint');

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint query param', url });
  }

  const targetUrl = `${UPSTREAM_BASE}${endpoint}`;

  const upstreamHeaders: Record<string, string> = {
    'Content-Type': headers['content-type'] || 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  const apiKey = process.env.API_KEY;
  if (apiKey) upstreamHeaders['X-API-KEY'] = apiKey;

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

    console.log('[proxy] targetUrl:', targetUrl, 'body:', body);

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