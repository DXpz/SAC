import React, { useMemo } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
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

const MedicionSlaPorEtapaCard: React.FC<Props> = ({
  cases,
  estados,
  navigate
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState(true);

  const { totalGeneral, rows, peorEtapa } = useMemo(() => {
    const SIN_CAT = 1;
    const casosAbiertos = (cases || []).filter(c =>
      c && !isFinalStatus(c.status || c.estado) && c.categoria_id && c.categoria_id !== SIN_CAT
    );

    const map: Record<string, { total: number; enTiempo: number }> = {};
    casosAbiertos.forEach(c => {
      const estado = c.status || c.estado || 'Sin etapa';
      if (!map[estado]) map[estado] = { total: 0, enTiempo: 0 };
      map[estado].total += 1;
      if (c.slaExpired !== true) map[estado].enTiempo += 1;
    });

    const order = estados && estados.length > 0
      ? estados.map((e: any) => e.nombre)
      : ['Nueva Solicitud', 'Primer Contacto', 'Diagnóstico', 'Ejecución', 'Control de Calidad', 'Listo - pendiente entrega cliente', 'Finalizado'];

    const list = order
      .filter(name => map[name] && map[name].total > 0)
      .map(name => {
        const r = map[name];
        const pct = r.total > 0 ? Math.round((r.enTiempo / r.total) * 100) : 0;
        return { name, total: r.total, enTiempo: r.enTiempo, pct };
      });

    Object.keys(map).forEach(k => {
      if (!order.includes(k) && map[k].total > 0) {
        const r = map[k];
        list.push({ name: k, total: r.total, enTiempo: r.enTiempo, pct: r.total > 0 ? Math.round((r.enTiempo / r.total) * 100) : 0 });
      }
    });

    const total = list.reduce((acc, r) => acc + r.total, 0);
    const peor = list.length > 0
      ? list.reduce((min, r) => r.pct < min.pct ? r : min, list[0])
      : null;

    return { totalGeneral: total, rows: list, peorEtapa: peor };
  }, [cases, estados]);

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
      borderColor: 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const getColorByPct = (pct: number): string => {
    if (pct >= 90) return '#10b981';
    if (pct >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const overallPct = rows.length > 0
    ? Math.round(rows.reduce((acc, r) => acc + r.pct, 0) / rows.length)
    : null;

  const overallColor = overallPct === null ? styles.text.tertiary : getColorByPct(overallPct);

  return (
    <div
      title="Cumplimiento de SLA por cada etapa. Verde >= 90%, Amarillo 70-89%, Rojo < 70%."
      className="p-2 rounded border cursor-pointer h-full flex flex-col"
      style={{
        ...styles.card,
        borderColor: 'rgba(71, 85, 105, 0.3)',
        backgroundColor: styles.card.backgroundColor
      }}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between w-full">
        <p className="text-[10px] font-bold uppercase tracking-wide text-center flex-1" style={{ color: styles.text.secondary }}>
          Cumplimiento SLA por Etapa
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="p-0.5 rounded hover:bg-white/5 flex-shrink-0"
          title={expanded ? 'Ocultar detalle' : 'Ver detalle'}
        >
          {expanded ? <ChevronUp className="w-3 h-3" style={{ color: styles.text.tertiary }} /> : <ChevronDown className="w-3 h-3" style={{ color: styles.text.tertiary }} />}
        </button>
      </div>

      <p className="text-2xl font-bold text-center flex-1 flex items-center justify-center" style={{ color: overallColor }}>
        {overallPct === null ? '—' : `${overallPct}%`}
      </p>

      <p className="text-[9px] text-center w-full opacity-70" style={{ color: styles.text.tertiary }}>
        {totalGeneral} caso{totalGeneral !== 1 ? 's' : ''} abierto{totalGeneral !== 1 ? 's' : ''} con SLA
      </p>

      {expanded && rows.length > 0 && (
        <div className="space-y-1 mt-2 w-full pt-2 border-t" style={{ borderColor: 'rgba(71, 85, 105, 0.2)' }}>
          {rows.map((r, idx) => {
            const color = getColorByPct(r.pct);
            return (
              <div key={`${idx}-${r.name}`} className="space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[10px] font-medium truncate"
                    style={{ color: styles.text.primary }}
                    title={`${r.name} (${r.enTiempo}/${r.total} en tiempo)`}
                  >
                    {r.name}
                  </span>
                  <span
                    className="text-[10px] font-bold tabular-nums flex-shrink-0"
                    style={{ color }}
                  >
                    {r.pct}%
                  </span>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(71, 85, 105, 0.2)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && rows.length === 0 && (
        <p className="text-[10px] italic text-center mt-2" style={{ color: styles.text.tertiary }}>
          Sin casos abiertos con SLA válido
        </p>
      )}

      {peorEtapa && peorEtapa.pct < 70 && (
        <p className="text-[9px] mt-2 pt-1 border-t text-center" style={{ borderColor: 'rgba(71, 85, 105, 0.2)', color: '#ef4444' }}>
          ⚠ Peor: {peorEtapa.name} ({peorEtapa.pct}%)
        </p>
      )}
    </div>
  );
};

export default MedicionSlaPorEtapaCard;
