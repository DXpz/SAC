import React from 'react';
import CountrySelector from './CountrySelector';

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
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
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

  const handleMesChange = (value: string) => {
    setMesFilter(value);
    if (!yearFilter) {
      setYearFilter(String(new Date().getFullYear()));
    }
  };

  const handleYearChange = (value: string) => {
    setYearFilter(value);
    if (!mesFilter) {
      setMesFilter(String(new Date().getMonth() + 1).padStart(2, '0'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isAdminGlobal && (
        <CountrySelector
          value={paisFilter}
          onChange={setPaisFilter}
          theme={theme}
          label="País"
          includeAll={true}
        />
      )}

      <div className="flex items-center gap-2">
        <label
          className="text-xs font-semibold whitespace-nowrap"
          style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
        >
          Mes:
        </label>
        <select
          value={mesFilter}
          onChange={(e) => handleMesChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)',
            color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
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
      </div>

      <div className="flex items-center gap-2">
        <label
          className="text-xs font-semibold whitespace-nowrap"
          style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
        >
          Año:
        </label>
        <select
          value={yearFilter}
          onChange={(e) => handleYearChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            borderColor: 'rgba(148, 163, 184, 0.2)',
            color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
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
      </div>

      {(mesFilter || yearFilter || paisFilter !== 'all') && (
        <button
          onClick={onApply}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all hover:scale-105"
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            borderColor: '#3b82f6',
          }}
        >
          Aplicar filtros
        </button>
      )}
    </div>
  );
};

export default FilterBar;
