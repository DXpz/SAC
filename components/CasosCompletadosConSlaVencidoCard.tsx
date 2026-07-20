import React, { useMemo, useEffect, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  cases: any[];
  navigate?: (path: string) => void;
}

/**
 * Card "Casos Completados con SLA Vencido"
 *
 * Cuenta los casos finalizados (Cerrado, Resuelto, Finalizado) cuyo
 * historial_casos contiene al menos un evento con detalle
 * 'vencido' / 'venci' / 'SLA de etapa excedido' (heuristica hasta que
 * el backend exponga un endpoint dedicado).
 *
 * Si el backend expone el flag directo en el caso, lo usa.
 */
const CasosCompletadosConSlaVencidoCard: React.FC<Props> = ({
  cases,
  navigate
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isFinalStatus = (status: any): boolean => {
    if (!status) return false;
    const s = String(status).toLowerCase().replace(/\s+/g, '');
    return s === 'cerrado' || s === 'resuelto' || s === 'finalizado';
  };

  const { count, totalFinalizados, examples } = useMemo(() => {
    const finalizados = (cases || []).filter(c => c && isFinalStatus(c.status || c.estado));

    // Heuristica: un caso completo tuvo SLA vencido en alguna etapa si
    //   1) El backend expone el flag directo en `c.sla.vencido_por_etapa`
    //      o `c.vencidoPorEtapa` o similar
    //   2) O el campo `c.slaEverBreached` (placeholder futuro)
    //   3) O el detalle del historial contiene 'vencido' / 'venci'
    // Para esta version inicial usamos (3) como fallback.
    const matchesBreach = (s: string) => /venci[oó]?/i.test(s || '');

    let count = 0;
    const examples: any[] = [];

    for (const c of finalizados) {
      let breached = false;

      // 1) Flag directo del backend
      const flagBreach = c.slaEverBreached ?? c.vencidoPorEtapa ?? c.sla_vencido_en_historial;
      if (flagBreach === true) breached = true;

      // 2) Revision del historial (si esta disponible en el caso)
      if (!breached && Array.isArray(c.historial)) {
        for (const h of c.historial) {
          const detalle = String(h.detalle || '');
          if (matchesBreach(detalle)) {
            breached = true;
            break;
          }
        }
      }

      // 3) Fallback: palabra 'vencido' en el detalle del caso
      if (!breached) {
        if (matchesBreach(c.detalle || c.descripcion)) breached = true;
      }

      if (breached) {
        count += 1;
        if (examples.length < 3) examples.push(c);
      }
    }

    return { count, totalFinalizados: finalizados.length, examples };
  }, [cases]);

  const handleClick = () => {
    if (!navigate) return;
    const user = api.getUser();
    const role = (user?.role || '').toUpperCase();
    const path = role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMIN_GLOBAL'
      ? '/app/admin/casos'
      : '/app/casos';
    navigate(`${path}?filter=completados-sla-vencido`);
  };

  const styles = {
    card: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    borderColor: count > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(71, 85, 105, 0.3)',
    backgroundColor: count > 0 ? (theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)') : styles.card.backgroundColor,
    cursor: 'pointer',
    height: '100%'
  };

  return (
    <div
      title="Casos finalizados cuyo SLA de etapa fue excedido en algún momento del workflow"
      className="p-3 rounded-lg border transition-all duration-200 relative"
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = count > 0 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(71, 85, 105, 0.5)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = count > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(71, 85, 105, 0.3)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="absolute top-3 right-3">
        <CheckCircle className="w-6 h-6" style={{ color: count > 0 ? '#f59e0b' : styles.text.tertiary }} />
      </div>
      <div className="flex items-start justify-between mb-2 pr-8">
        <div className="flex-1">
          <p className="text-3xl font-bold leading-tight mb-1" style={{ color: count > 0 ? '#f59e0b' : styles.text.primary }}>
            {count}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: styles.text.secondary }}>
            Completados con SLA Vencido
          </p>
          <p className="text-[10px] mt-1" style={{ color: styles.text.tertiary }}>
            {totalFinalizados > 0
              ? `${count} de ${totalFinalizados} finalizados`
              : 'Sin finalizados'}
          </p>
        </div>
      </div>

      {expanded && examples.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'rgba(71, 85, 105, 0.2)' }}>
          {examples.map((c, idx) => (
            <div key={c.id || c.case_id || idx} className="text-[11px] truncate" style={{ color: styles.text.tertiary }}>
              <span className="font-medium" style={{ color: styles.text.primary }}>{c.case_id || c.ticketNumber || c.id}:</span>{' '}
              {(c.detalle || c.descripcion || '').substring(0, 50)}
            </div>
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="mt-2 text-[10px] font-semibold uppercase tracking-wide hover:opacity-80"
          style={{ color: styles.text.tertiary }}
        >
          {expanded ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
          {expanded ? ' Ocultar' : ' Ver'} ejemplos
        </button>
      )}
    </div>
  );
};

export default CasosCompletadosConSlaVencidoCard;