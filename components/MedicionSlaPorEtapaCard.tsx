import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  enTiempo: number;
  total: number;
  navigate?: (path: string) => void;
}

const MedicionSlaPorEtapaCard: React.FC<Props> = ({
  enTiempo,
  total,
  navigate
}) => {
  const { theme } = useTheme();

  const pct = total > 0 ? Math.round((enTiempo / total) * 100) : null;
  const color = pct === null ? '#94a3b8' : pct >= 90 ? '#22c55e' : pct >= 70 ? '#fbbf24' : '#f87171';

  const handleClick = () => {
    if (!navigate) return;
    const user = api.getUser();
    const role = (user?.role || '').toUpperCase();
    const path = role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMIN_GLOBAL'
      ? '/app/admin/casos'
      : '/app/casos';
    navigate(`${path}?filter=etapas-vencidas`);
  };

  const styles = {
    card: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderColor: 'rgba(71, 85, 105, 0.3)',
    },
    textSecondary: theme === 'dark' ? '#cbd5e1' : '#475569',
    textTertiary: theme === 'dark' ? '#94a3b8' : '#64748b',
  };

  return (
    <div
      title={`pct = round(${enTiempo} / ${total} * 100) = ${pct ?? 'N/A'}%`}
      className="pt-2 px-2 pb-1 rounded border cursor-pointer h-full flex flex-col items-center"
      style={{
        ...styles.card,
        backgroundColor: styles.card.backgroundColor,
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-center w-full m-0" style={{ color: styles.textSecondary }}>
        Cumplimiento SLA por etapa
      </p>
      <p className="text-2xl font-bold text-center w-full m-0 flex-1 flex items-center justify-center" style={{ color }}>
        {pct === null ? '—' : `${pct}%`}
      </p>
      <p className="text-[8px] text-center w-full opacity-70 m-0 leading-tight" style={{ color: styles.textTertiary }}>
        {total > 0
          ? 'casos con SLA por etapa en tiempo / Caso totales'
          : 'Sin casos con SLA'}
      </p>
    </div>
  );
};

export default MedicionSlaPorEtapaCard;
