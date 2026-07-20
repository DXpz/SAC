import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  cases: any[];
  estados?: any[];
  navigate?: (path: string) => void;
}

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

/**
 * Card "Cumplimiento SLA por etapa"
 *
 * Mide el cumplimiento de SLA por cada etapa del workflow.
 *
 * Formula (acumulada por etapa, no por caso):
 *   - Para cada caso abierto en etapa X: cuenta +1 al total de la etapa X
 *   - Para cada caso cerrado/finalizado con etapasVencidas persistido:
 *     cuenta +1 al total de cada etapa donde se vencio
 *   - Un caso esta "en tiempo" si su slaExpired es false en la etapa actual
 *     y no tiene breach previo en ninguna otra etapa
 *
 * Muestra un numero global (% promedio) y un subtitle "X / Y casos en tiempo"
 * donde Y = total de casos con SLA (suma de todas las etapas).
 */
const MedicionSlaPorEtapaCard: React.FC<Props> = ({
  cases,
  navigate
}) => {
  const { theme } = useTheme();

  const { enTiempo, total } = useMemo(() => {
    const SIN_CAT = 1;
    let total = 0;
    let enTiempo = 0;

    for (const c of cases || []) {
      if (!c) continue;
      if (!c.categoria_id || c.categoria_id === SIN_CAT) continue;

      const breach = hasBreach(c);

      if (!isClosed(c)) {
        // Caso abierto: cuenta 1 en la etapa actual
        total += 1;
        if (!breach) enTiempo += 1;
      } else if (Array.isArray(c.etapasVencidas) && c.etapasVencidas.length > 0) {
        // Caso cerrado con breach: cuenta 1 por cada etapa donde se vencio
        for (const _ of c.etapasVencidas) {
          total += 1;
          enTiempo += 0; // no en tiempo (se vencio en esa etapa)
        }
      } else {
        // Caso cerrado sin breach: cuenta 1 (1 etapa, en tiempo)
        total += 1;
        enTiempo += 1;
      }
    }

    return { enTiempo, total };
  }, [cases]);

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
