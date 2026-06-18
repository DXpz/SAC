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
