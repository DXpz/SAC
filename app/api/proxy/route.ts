import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-KEY, ngrok-skip-browser-warning, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(req: NextRequest) {
  const token = req.cookies.get('api_token')?.value;
  if (!token) {
    return NextResponse.json({ detail: 'No autenticado' }, { status: 401 });
  }

  const base = (process.env.API_UPSTREAM ?? 'http://200.35.189.139:4000').trim().replace(/\/+$/, '');

  const { searchParams } = req.nextUrl;
  const endpointParam = searchParams.get('endpoint');
  const pathParam = searchParams.get('_path') || '';

  const rawPath = endpointParam || pathParam;
  const suffix = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const qs = new URLSearchParams();
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint' && key !== '_path') qs.set(key, value);
  });
  const queryString = qs.toString();
  const target = `${base}/api${suffix}${queryString ? `?${queryString}` : ''}`;

  const upstreamHeaders: Record<string, string> = {
    'X-API-KEY': process.env.API_KEY || '',
    'ngrok-skip-browser-warning': 'true',
    'Authorization': `Bearer ${token}`,
  };

  const forwarded = ['content-type', 'accept'];
  forwarded.forEach(h => {
    const val = req.headers.get(h);
    if (val) upstreamHeaders[h] = val;
  });

  const method = req.method;

  let body: undefined | string;
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await req.text();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      body = JSON.stringify(Object.fromEntries(formData));
    }
  }

  const upstreamBody = body && body.length > 0 ? body : undefined;

  console.log('[proxy]', method, target, 'headers:', JSON.stringify(upstreamHeaders), 'body:', upstreamBody);

  try {
    const upstream = await fetch(target, {
      method,
      headers: upstreamHeaders,
      body: upstreamBody,
    });
    const outType = upstream.headers.get('content-type');
    const buffer = Buffer.from(await upstream.arrayBuffer());

    const response = new NextResponse(buffer, {
      status: upstream.status,
      headers: outType ? { 'Content-Type': outType } : {},
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (err: any) {
    console.error('[proxy] Error conectando a', target, err);
    return NextResponse.json({ error: 'Error conectando al upstream.', detail: String(err), target }, { status: 502 });
  }
}