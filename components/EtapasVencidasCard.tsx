import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { CaseStatus } from '../types';
import { api } from '../services/api';

interface Props {
  cases: any[];
  estados?: any[];
  navigate?: (path: string) => void;
  onCardClick?: () => void;
}

const isFinalStatus = (status: any): boolean => {
  if (!status) return false;
  const s = String(status).toLowerCase().replace(/\s+/g, '');
  return s === 'cerrado' || s === 'resuelto' || s === 'finalizado';
};

const EtapasVencidasCard: React.FC<Props> = ({
  cases,
  estados,
  navigate,
  onCardClick
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const { total, breakdown } = useMemo(() => {
    const isVencida = (c: any) => c?.slaExpired === true;
    const filtered = (cases || []).filter(c => c && !isFinalStatus(c.status) && isVencida(c));

    const map: Record<string, number> = {};
    filtered.forEach(c => {
      const key = c.status || 'Sin etapa';
      map[key] = (map[key] || 0) + 1;
    });

    const order = estados && estados.length > 0
      ? estados.map((e: any) => e.nombre)
      : ['Nuevo', 'Primer Contacto', 'Diagnostico', 'Ejecucion', 'Control de Calidad', 'Listo', 'Finalizado'];

    const breakdownList = order
      .map(name => ({ name, value: map[name] || 0 }))
      .filter(b => b.value > 0)
      .concat(
        Object.keys(map)
          .filter(k => !order.includes(k))
          .map(k => ({ name: k, value: map[k] }))
      );

    return { total: filtered.length, breakdown: breakdownList };
  }, [cases, estados]);

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
    navigate(`${path}?filter=etapas-vencidas`);
  };

  const styles = {
    card: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const color = total > 0 ? '#ef4444' : styles.text.tertiary;
  const colorSecondary = total > 0 ? '#ef4444' : styles.text.secondary;

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    borderColor: total > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(71, 85, 105, 0.3)',
    backgroundColor: total > 0 ? (theme === 'dark' ? 'rgba(220, 38, 38, 0.05)' : 'rgba(220, 38, 38, 0.03)') : styles.card.backgroundColor,
    cursor: 'pointer',
    height: '100%'
  };

  return (
    <div
      title="Casos cuya etapa actual excedió su SLA. El caso puede estar en tiempo si cambia de etapa pronto."
      className="p-4 rounded-xl border-2 transition-all duration-200 relative"
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = total > 0 ? 'rgba(220, 38, 38, 0.5)' : 'rgba(71, 85, 105, 0.5)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = total > 0 ? 'rgba(220, 38, 38, 0.3)' : 'rgba(71, 85, 105, 0.3)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="absolute top-3 right-3">
        <AlertCircle className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex items-start justify-between mb-2 pr-8">
        <div className="flex-1">
          <p className="text-4xl font-black leading-none mb-1.5" style={{ color: colorSecondary }}>
            {total}
          </p>
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: colorSecondary }} />
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: styles.text.secondary }}>
              Etapas Vencidas
            </p>
          </div>
          <p className="text-[10px] mt-1" style={{ color: total > 0 ? '#ef4444' : styles.text.tertiary }}>
            {total > 0 ? 'SLA de etapa excedido' : 'En tiempo'}
          </p>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(71, 85, 105, 0.2)' }}>
          <button
            type="button"
            className="flex items-center justify-between w-full text-[10px] font-semibold uppercase tracking-wide mb-1.5 hover:opacity-80"
            style={{ color: styles.text.tertiary }}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
          >
            <span>Desglose por etapa</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {expanded && (
            <div className="space-y-1">
              {breakdown.map((b) => {
                const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
                return (
                  <div key={b.name} className="flex items-center gap-2">
                    <span className="text-[11px] flex-1 truncate" style={{ color: styles.text.primary }} title={b.name}>
                      {b.name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(71, 85, 105, 0.2)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: '#ef4444' }}
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums w-6 text-right" style={{ color: '#ef4444' }}>
                      {b.value}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EtapasVencidasCard;
