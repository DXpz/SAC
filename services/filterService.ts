const FILTERS_KEY = 'sac_filters';

export type StoredFilters = {
  paisFilter?: string;
  mesFilter?: string;
  yearFilter?: string;
};

export const getStoredFilters = (): StoredFilters => {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Inicializa los filtros por defecto si no hay ninguno guardado.
// Por defecto: mes actual y año actual. País queda en 'all' para ADMIN_GLOBAL
// o se asigna según el país del usuario para roles normales.
export const ensureDefaultFilters = (): StoredFilters => {
  const current = getStoredFilters();
  if (current.mesFilter || current.yearFilter) return current;
  const now = new Date();
  const defaults: StoredFilters = {
    paisFilter: current.paisFilter || 'all',
    mesFilter: String(now.getMonth() + 1).padStart(2, '0'),
    yearFilter: String(now.getFullYear()),
  };
  localStorage.setItem(FILTERS_KEY, JSON.stringify(defaults));
  return defaults;
};

export const setStoredFilters = (filters: StoredFilters) => {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
  window.dispatchEvent(new CustomEvent('sac-filters-changed', { detail: filters }));
};

export const getDateFiltros = (filters: StoredFilters) => {
  const { mesFilter, yearFilter } = filters;
  if (!mesFilter && !yearFilter) return {};
  const y = yearFilter ? parseInt(yearFilter) : new Date().getFullYear();
  const m = mesFilter ? parseInt(mesFilter) - 1 : 0;
  const inicio = new Date(y, m, 1);
  const fin = new Date(y, mesFilter ? m + 1 : 12, 0);
  fin.setHours(23, 59, 59, 999);
  return {
    fechaInicio: inicio.toISOString(),
    fechaFin: fin.toISOString(),
  };
};

// Obtiene el pais del filtro para pasar al API.
// Retorna undefined si es 'all' o vacío (no filtrar).
// Retorna 'GT' o 'SV' según corresponda.
export const getPaisFromFilters = (): string | undefined => {
  const filters = getStoredFilters();
  const pais = filters.paisFilter || 'all';
  if (pais === 'all') return undefined;
  if (pais === 'Guatemala') return 'GT';
  if (pais === 'ElSalvador') return 'SV';
  return undefined;
};
