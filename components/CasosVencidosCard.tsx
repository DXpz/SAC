import React from 'react';
import { Ticket } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  count: number;
  navigate?: (path: string) => void;
  onCardClick?: () => void;
  filterQuery?: string;
  delay?: string;
  tooltipId?: string;
  totalSlaDias?: number;
}

const CasosVencidosCard: React.FC<Props> = ({
  count,
  navigate,
  onCardClick,
  filterQuery = 'vencidos',
  delay = '0.2s',
  tooltipId,
  totalSlaDias
}) => {
  const { theme } = useTheme();

  const styles = {
    card: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const colorSecondary = count > 0 ? '#ef4444' : styles.text.secondary;

  const handleClick = () => {
    if (onCardClick) {
      onCardClick();
      return;
    }
    if (!navigate) return;
    const user = api.getUser();
    const role = (user?.role || '').toUpperCase();
    const path = role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMIN_GLOBAL'
      ? '/app/admin/casos'
      : '/app/casos';
    navigate(`${path}?filter=${filterQuery}`);
  };

  const dataAttr = tooltipId ? { 'data-tooltip-id': tooltipId } : {};

  return (
    <div
      {...dataAttr}
      title="Casos cuyo tiempo total abierto supera el SLA de la categoría. Vista global, no por etapa."
      className="pt-2 px-2 pb-1 rounded border cursor-pointer h-full flex flex-col items-center"
      style={{
        ...styles.card,
        borderColor: 'rgba(71, 85, 105, 0.3)',
        backgroundColor: styles.card.backgroundColor,
        animation: `fadeInSlide 0.3s ease-out ${delay} both`
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-center w-full m-0" style={{ color: styles.text.secondary }}>
        Casos Vencidos
      </p>
      <p className="text-2xl font-bold text-center w-full m-0 flex-1 flex items-center justify-center" style={{ color: colorSecondary }}>
        {count}
      </p>
      <p className="text-[9px] text-center w-full opacity-70 m-0" style={{ color: count > 0 ? '#ef4444' : styles.text.tertiary }}>
        {count > 0
          ? `Más de ${totalSlaDias ?? 6} días (SLA global)`
          : `En tiempo (${totalSlaDias ?? 6}d global)`}
      </p>
    </div>
  );
};

export default CasosVencidosCard;
