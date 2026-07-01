import React from 'react';

interface FilterBarProps {
  isAdminGlobal: boolean;
  paisFilter: string;
  setPaisFilter: (value: string) => void;
  mesFilter: string;
  setMesFilter: (value: string) => void;
  yearFilter: string;
  setYearFilter: (value: string) => void;
  theme?: 'light' | 'dark';
  onApply?: () => void;
}

const MESES = [
  { value: '01', label: 'Ene' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Abr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Ago' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dic' },
];

const ANIOS = () => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(String(y));
  }
  return years;
};

export const FilterBar: React.FC<FilterBarProps> = ({
  isAdminGlobal,
  paisFilter,
  setPaisFilter,
  mesFilter,
  setMesFilter,
  yearFilter,
  setYearFilter,
  theme = 'light',
  onApply,
}) => {
  const years = ANIOS();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* País - solo ADMIN_GLOBAL */}
      {isAdminGlobal && (
        <select
          value={paisFilter}
          onChange={(e) => setPaisFilter(e.target.value)}
          className="px-2 py-1 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
          style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
            borderColor: 'rgba(148, 163, 184, 0.25)',
            color: theme === 'dark' ? '#e2e8f0' : '#334155',
            cursor: 'pointer',
          }}
        >
          <option value="all">Todos los países</option>
          <option value="Guatemala">Guatemala</option>
          <option value="ElSalvador">El Salvador</option>
        </select>
      )}

      {/* Mes */}
      <select
        value={mesFilter}
        onChange={(e) => setMesFilter(e.target.value)}
        className="px-2 py-1 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        style={{
          backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          color: theme === 'dark' ? '#e2e8f0' : '#334155',
          cursor: 'pointer',
        }}
      >
        <option value="">Todos los meses</option>
        {MESES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Año */}
      <select
        value={yearFilter}
        onChange={(e) => setYearFilter(e.target.value)}
        className="px-2 py-1 rounded-md border text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
        style={{
          backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          color: theme === 'dark' ? '#e2e8f0' : '#334155',
          cursor: 'pointer',
        }}
      >
        <option value="">Todos los años</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Botón aplicar */}
      {(mesFilter || yearFilter || paisFilter !== 'all') ? (
        <button
          onClick={onApply}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all hover:opacity-90"
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
          }}
        >
          Aplicar
        </button>
      ) : (
        <button
          onClick={onApply}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all hover:bg-white/10"
          style={{
            backgroundColor: 'transparent',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
            borderColor: 'rgba(148, 163, 184, 0.2)',
          }}
        >
          Actualizar
        </button>
      )}
    </div>
  );
};

export default FilterBar;
