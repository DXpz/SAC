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
}

const CasosVencidosCard: React.FC<Props> = ({
  count,
  navigate,
  onCardClick,
  filterQuery = 'vencidos',
  delay = '0.2s',
  tooltipId
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

  const color = count > 0 ? '#ef4444' : styles.text.tertiary;
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
      className="p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden"
      style={{
        ...styles.card,
        borderColor: 'rgba(71, 85, 105, 0.3)',
        backgroundColor: styles.card.backgroundColor,
        animation: `fadeInSlide 0.3s ease-out ${delay} both`,
        transform: 'scale(1)',
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
        e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
      }}
    >
      <div className="absolute top-3 right-3">
        <Ticket className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex items-start justify-between mb-2 pr-8">
        <div className="flex-1">
          <p className="text-4xl font-black leading-none mb-1.5" style={{ color: colorSecondary }}>
            {count}
          </p>
          <div className="flex items-center gap-1.5">
            <Ticket className="w-4 h-4 flex-shrink-0" style={{ color: colorSecondary }} />
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: styles.text.secondary }}>
              Casos Vencidos
            </p>
          </div>
          <p className="text-[10px] mt-1" style={{ color: count > 0 ? '#ef4444' : styles.text.tertiary }}>
            {count > 0 ? 'SLA categoría excedido' : 'En tiempo'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CasosVencidosCard;
