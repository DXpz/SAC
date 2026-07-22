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
// Por defecto: SIN filtro de mes (todos los meses). País queda en 'all' para ADMIN_GLOBAL
// o se asigna según el país del usuario para roles normales.
export const ensureDefaultFilters = (): StoredFilters => {
  const current = getStoredFilters();

  // Migracion one-time: si los filtros guardados son del año actual
  // (default anterior del sistema), limpiarlos a vacíos para que la
  // Bandeja muestre TODOS los casos. Esto es seguro porque al inicio
  // de cualquier sesión el usuario quiere ver todo, no filtrado por
  // el default obsoleto.
  const currentYear = new Date().getFullYear();
  if (current.yearFilter === String(currentYear) && current.mesFilter) {
    const migrated = { ...current, mesFilter: '', yearFilter: '' };
    localStorage.setItem(FILTERS_KEY, JSON.stringify(migrated));
    return migrated;
  }

  if (current.mesFilter || current.yearFilter) return current;
  const defaults: StoredFilters = {
    paisFilter: current.paisFilter || 'all',
    mesFilter: '',   // '' = todos los meses (sin filtro)
    yearFilter: '',  // '' = todos los años (sin filtro)
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
  // Si mesFilter vacio, NO filtrar (mostrar TODOS los meses/años).
  // Asi 'Todos los meses' ignora el año y muestra todo.
  if (!mesFilter) return {};
  const y = yearFilter ? parseInt(yearFilter) : new Date().getFullYear();
  const m = parseInt(mesFilter) - 1;
  const inicio = new Date(y, m, 1);
  const fin = new Date(y, m + 1, 0);
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
