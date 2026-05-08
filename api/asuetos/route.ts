import type { VercelRequest, VercelResponse } from '@vercel/node';

const N8N_ASUETOS_URL = 'https://n8n.red.com.sv/webhook/asuetos-workflow';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, body } = req;

  if (method === 'POST') {
    try {
      const response = await fetch(N8N_ASUETOS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch asuetos' });
      }

      const data = await response.json();

      // Transformar fecha ISO (2026-10-05T06:00:00.000Z) a DD/MM/YYYY
      const parseDateToDDMMYYYY = (isoDate: string): string => {
        if (!isoDate) return '';
        try {
          const date = new Date(isoDate);
          if (isNaN(date.getTime())) return isoDate;
          const day = String(date.getUTCDate()).padStart(2, '0');
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const year = date.getUTCFullYear();
          return `${day}/${month}/${year}`;
        } catch {
          return isoDate;
        }
      };

      // El frontend espera formato { data: [...] }
      // El webhook devuelve array directo, envolvemos en el formato esperado
      const asuetosArray = Array.isArray(data)
        ? data.map((asueto: any, index: number) => ({
            id: asueto.id || '',
            fecha: parseDateToDDMMYYYY(asueto.fecha),
            motivo: asueto.motivo || 'Indefinido',
            pais: asueto.pais || 'Indefinido',
            row_number: index + 1,
            fecha_creacion: asueto.fecha_creacion || null
          }))
        : [];

      return res.status(200).json({ data: asuetosArray });
    } catch (error) {
      return res.status(500).json({ error: 'Proxy error', message: (error as Error).message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}