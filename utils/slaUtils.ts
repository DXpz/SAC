/**
 * Helpers para el cálculo de SLA de casos.
 * Evita los bugs clásicos:
 *  - `null <= 1` es `true` por coerción de JavaScript
 *  - `diasRestantes ?? 0` convierte null en 0 (mostrando "En Riesgo" en cerrados)
 *
 * El SLA por etapa se consume desde el backend (campo `slaPorEtapa` en la
 * respuesta de /api/casos/metrics). El frontend no hardcodea estos valores;
 * solo tiene un fallback razonable si el backend no responde.
 */

// SLA por etapa (fallback local si el backend no responde).
// En produccion este mapa se reemplaza con el devuelto por el backend.
const FALLBACK_STAGE_SLA_DAYS: Record<string, number | null> = {
  'Nueva solicitud': null,
  'Nuevo': null,
  'Nueva Solicitud': null,
  'Primer contacto': 1,
  'Diagnostico': 1,
  'Diagnóstico': 1,
  'Ejecucion': 2,
  'Ejecución': 2,
  'Control de Calidad': 1,
  'Listo - Pendiente de entrega cliente': 1,
  'Listo': 1,
  'Finalizado': 1,
  'Cerrado': 1,
  'Resuelto': 1
};

// Mapa activo, puede ser reemplazado por setStageSlaMap con los datos del backend
let activeStageSlaMap: Record<string, number | null> = FALLBACK_STAGE_SLA_DAYS;

// Llamado desde los dashboards tras recibir dashboardMetrics del backend
export const setStageSlaMap = (map: Record<string, number | null> | null | undefined) => {
  if (map && typeof map === 'object' && Object.keys(map).length > 0) {
    activeStageSlaMap = map;
  }
};

export const getStageSlaDays = (estadoNombre: string | undefined | null): number | null => {
  if (!estadoNombre) return 1;
  const sla = activeStageSlaMap[estadoNombre];
  if (sla === undefined) return 1;
  return sla;
};

export const isClosedCase = (caso: any): boolean => {
  const estado = caso?.status || caso?.estado || '';
  return ['Cerrado', 'Resuelto', 'Finalizado', 'cerrado', 'resuelto', 'finalizado'].includes(estado);
};

export const isSlaExpired = (caso: any): boolean => {
  return caso?.slaExpired === true;
};

export const getDiasRestantes = (caso: any): number | null => {
  const v = caso?.diasRestantes;
  return (typeof v === 'number' && !isNaN(v)) ? v : null;
};

export const isSlaCritical = (caso: any): boolean => {
  if (isClosedCase(caso)) return false;
  if (isSlaExpired(caso)) return true;
  const d = getDiasRestantes(caso);
  return d != null && d <= 1;
};

export const isSlaAtRisk = (caso: any): boolean => {
  if (isClosedCase(caso) || isSlaExpired(caso)) return false;
  const d = getDiasRestantes(caso);
  return d != null && d <= 1;
};

export const isSlaWithin = (caso: any): boolean => {
  if (isClosedCase(caso) || isSlaExpired(caso)) return false;
  const d = getDiasRestantes(caso);
  return d != null && d > 1;
};
