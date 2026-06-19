/**
 * Helpers para el cálculo de SLA de casos.
 * Evita los bugs clásicos:
 *  - `null <= 1` es `true` por coerción de JavaScript
 *  - `diasRestantes ?? 0` convierte null en 0 (mostrando "En Riesgo" en cerrados)
 */

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
