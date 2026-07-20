import React, { useMemo, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  cases: any[];
  navigate?: (path: string) => void;
}

/**
 * Card "Casos con SLA Vencidos"
 *
 * Cuenta TODOS los casos que tienen una o mas etapas vencidas (no importa
 * el estado actual):
 *   1) Casos actualmente vencidos (slaExpired=true), incluyendo los que
 *      aun no se han cerrado.
 *   2) Casos ya cerrados (Cerrado/Resuelto/Finalizado) cuyo historial
 *      contiene algun detalle con 'vencido'/'venci' (heuristica hasta
 *      que el backend exponga slaEverBreached).
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

  const isClosed = (c: any) => isFinalStatus(c.status || c.estado);
  const hasBreach = (c: any) => {
    if (c.slaExpired === true || c.slaExpired === 'true' || c.slaExpired === 1) return true;
    if (Array.isArray(c.etapasVencidas) && c.etapasVencidas.length > 0) return true;
    return false;
  };

  const { count, total, examples } = useMemo(() => {
    const SIN_CAT = 1;
    let total = 0;
    let count = 0;
    const examples: any[] = [];

    for (const c of cases || []) {
      if (!c) continue;
      if (!c.categoria_id || c.categoria_id === SIN_CAT) continue;

      const breach = hasBreach(c);

      if (!isClosed(c)) {
        // Caso abierto: cuenta 1 en la etapa actual
        total += 1;
        if (breach) count += 1;
      } else if (Array.isArray(c.etapasVencidas) && c.etapasVencidas.length > 0) {
        // Caso cerrado con breach: cuenta 1 por cada etapa donde se vencio
        for (const _ of c.etapasVencidas) {
          total += 1;
          count += 1; // todos con breach
        }
      } else {
        // Caso cerrado sin breach: cuenta 1 (en tiempo)
        total += 1;
      }
    }

    return { count, total, examples };
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
      title="Casos con una o mas etapas vencidas (actualmente vencidos + cerrados con breach previo)"
      className="pt-2 px-2 pb-1 rounded border flex flex-col items-center"
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = count > 0 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(71, 85, 105, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = count > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(71, 85, 105, 0.3)';
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-center w-full m-0" style={{ color: styles.text.secondary }}>
        Casos con SLA Vencidos
      </p>
      <p className="text-2xl font-bold text-center w-full m-0 flex-1 flex items-center justify-center" style={{ color: count > 0 ? '#f59e0b' : styles.text.primary }}>
        {count}
      </p>
      <p className="text-[8px] text-center w-full opacity-70 m-0 leading-tight" style={{ color: count > 0 ? '#f59e0b' : styles.text.tertiary }}>
        {total > 0
          ? 'Casos con SLA por etapa vencidos / Casos totales'
          : 'Sin casos con SLA'}
      </p>

      {expanded && examples.length > 0 && (
        <div className="mt-2 pt-2 border-t space-y-1 w-full" style={{ borderColor: 'rgba(71, 85, 105, 0.2)' }}>
          {examples.map((c, idx) => (
            <div key={c.id || c.case_id || idx} className="text-[11px] truncate" style={{ color: styles.text.tertiary }}>
              <span className="font-medium" style={{ color: styles.text.primary }}>{c.case_id || c.ticketNumber || c.id}:</span>{' '}
              {(c.detalle || c.descripcion || c.subject || '').substring(0, 50)}
            </div>
          ))}
        </div>
      )}

      {examples.length > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="mt-1 text-[10px] font-semibold uppercase tracking-wide hover:opacity-80"
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
