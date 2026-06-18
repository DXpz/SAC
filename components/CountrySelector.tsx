import React from 'react';

interface CountrySelectorProps {
  value: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
  label?: string;
  includeAll?: boolean;
}

const COUNTRY_LABELS: Record<string, string> = {
  'all': 'Todos los países',
  'Guatemala': 'Guatemala',
  'ElSalvador': 'El Salvador',
  'GT': 'Guatemala',
  'SV': 'El Salvador',
};

export const CountrySelector: React.FC<CountrySelectorProps> = ({
  value,
  onChange,
  theme = 'light',
  label = 'País',
  includeAll = true,
}) => {
  return (
    <div className="flex items-center gap-2">
      <label
        className="text-xs font-semibold whitespace-nowrap"
        style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
      >
        {label}:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
          cursor: 'pointer',
        }}
      >
        {includeAll && <option value="all">{COUNTRY_LABELS['all']}</option>}
        <option value="Guatemala">{COUNTRY_LABELS['Guatemala']}</option>
        <option value="ElSalvador">{COUNTRY_LABELS['ElSalvador']}</option>
      </select>
    </div>
  );
};

export default CountrySelector;
