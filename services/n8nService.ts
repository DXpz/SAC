/**
 * Servicio para llamar a webhooks de N8N relacionados con casos SAC.
 */

const N8N_BASE_URL = 'https://n8n.red.com.sv/webhook';

export interface SolicitarEquipoBodegaParams {
  anexo: string;      // FOLCOD del cliente (folio de equipos)
  clicod: string;     // Código del cliente (CardCode SAP)
  nreclamo: string;   // Número de caso (case_id)
}

export interface SolicitarEquipoBodegaResponse {
  success: boolean;
  message: string;
  raw?: any;
}

/**
 * Solicita un equipo de bodega enviando al webhook de N8N.
 * El webhook valida que el folio esté activo (FOLSTA='A') y crea el registro
 * en [@CAC_RECLAMO] en SAP. Si la validación falla, retorna success=false.
 *
 * @see https://n8n.red.com.sv/webhook/333a8a22-4d9e-41d2-91b0-eadbad5846c6
 */
export const solicitarEquipoBodega = async (
  params: SolicitarEquipoBodegaParams
): Promise<SolicitarEquipoBodegaResponse> => {
  const url = `${N8N_BASE_URL}/333a8a22-4d9e-41d2-91b0-eadbad5846c6`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anexo: params.anexo.trim(),
        clicod: params.clicod.trim(),
        nreclamo: params.nreclamo.trim()
      })
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { myField: text };
    }

    // El workflow responde con {myField: "..."}
    // - "proceso completado" => éxito
    // - "el anexo no se pudo verificar" => fallo
    // - otros => tratar según message
    const message = String(data?.myField ?? data?.message ?? '');
    const success = /proceso completado|completado/i.test(message);

    return {
      success,
      message: message || `HTTP ${response.status}`,
      raw: data
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Error de red al llamar al webhook'
    };
  }
};

/**
 * Procesa múltiples folios SECUENCIALMENTE.
 * Si alguno falla, aborta y devuelve el error.
 * Útil cuando el usuario tiene varios folios y debe procesarlos uno a uno.
 */
export const solicitarEquipoBodegaMultiple = async (
  folios: string[],
  paramsBase: Omit<SolicitarEquipoBodegaParams, 'anexo'>
): Promise<{ success: boolean; results: SolicitarEquipoBodegaResponse[] }> => {
  const results: SolicitarEquipoBodegaResponse[] = [];
  for (const anexo of folios) {
    const folio = anexo.trim();
    if (!folio) continue;
    const result = await solicitarEquipoBodega({ ...paramsBase, anexo: folio });
    results.push(result);
    if (!result.success) {
      return { success: false, results };
    }
  }
  return { success: true, results };
};