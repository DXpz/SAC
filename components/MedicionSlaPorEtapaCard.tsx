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

/**
 * Card "Medición de SLA por Etapa"
 *
 * Para cada etapa (estado) muestra:
 *   - total de casos abiertos en esa etapa
 *   - cuántos están dentro del SLA (no vencidos)
 *   - % de cumplimiento
 *
 * Color por cumplimiento:
 *   verde  >= 90%  (en cumplimiento)
 *   amarillo 70-89% (en riesgo)
 *   rojo   < 70%  (bajo)
 */
const MedicionSlaPorEtapaCard: React.FC<Props> = ({
  cases,
  estados,
  navigate
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = React.useState(true);

  const { totalGeneral, rows, peorEtapa } = useMemo(() => {
    // Solo casos abiertos (no finales) y con categoria real (categoria_id != 1)
    const SIN_CAT = 1;
    const casosAbiertos = (cases || []).filter(c =>
      c && !isFinalStatus(c.status || c.estado) && c.categoria_id && c.categoria_id !== SIN_CAT
    );

    // Agrupar por estado
    const map: Record<string, { total: number; enTiempo: number }> = {};
    casosAbiertos.forEach(c => {
      const estado = c.status || c.estado || 'Sin etapa';
      if (!map[estado]) map[estado] = { total: 0, enTiempo: 0 };
      map[estado].total += 1;
      if (c.slaExpired !== true) map[estado].enTiempo += 1;
    });

    // Orden por etapa (usando lista del backend si existe)
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

    // También agregar estados que no estén en `order`
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
    if (pct >= 90) return '#10b981'; // verde
    if (pct >= 70) return '#f59e0b'; // amarillo
    return '#ef4444'; // rojo
  };

  const cardStyle: React.CSSProperties = {
    ...styles.card,
    cursor: 'pointer',
    height: '100%'
  };

  return (
    <div
      title="Cumplimiento de SLA por cada etapa. Verde >= 90%, Amarillo 70-89%, Rojo < 70%."
      className="p-4 rounded-xl border-2 transition-all duration-200 relative"
      style={cardStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="absolute top-3 right-3">
        <TrendingUp className="w-6 h-6" style={{ color: styles.text.tertiary }} />
      </div>
      <div className="flex items-start justify-between mb-3 pr-8">
        <div className="flex-1">
          <p className="text-2xl font-black leading-none mb-1.5" style={{ color: styles.text.primary }}>
            {rows.length > 0
              ? `${Math.round(rows.reduce((acc, r) => acc + r.pct, 0) / rows.length)}%`
              : '—'}
          </p>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: styles.text.secondary }}>
            Cumplimiento SLA por Etapa
          </p>
          <p className="text-[10px] mt-1" style={{ color: styles.text.tertiary }}>
            {totalGeneral} caso{totalGeneral !== 1 ? 's' : ''} abierto{totalGeneral !== 1 ? 's' : ''} con SLA
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="p-1 rounded hover:bg-white/5"
          title={expanded ? 'Ocultar detalle' : 'Ver detalle'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: styles.text.tertiary }} /> : <ChevronDown className="w-4 h-4" style={{ color: styles.text.tertiary }} />}
        </button>
      </div>

      {expanded && rows.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {rows.map((r) => {
            const color = getColorByPct(r.pct);
            return (
              <div key={r.name} className="flex items-center gap-2">
                <span
                  className="text-[11px] flex-1 truncate"
                  style={{ color: styles.text.primary }}
                  title={`${r.name} (${r.enTiempo}/${r.total} en tiempo)`}
                >
                  {r.name}
                </span>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{
                    backgroundColor: 'rgba(71, 85, 105, 0.2)',
                    width: '70px',
                    flexShrink: 0
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${r.pct}%`, backgroundColor: color }}
                  />
                </div>
                <span
                  className="text-[11px] font-bold tabular-nums w-9 text-right"
                  style={{ color }}
                >
                  {r.pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {expanded && rows.length === 0 && (
        <p className="text-[11px] italic mt-2" style={{ color: styles.text.tertiary }}>
          Sin casos abiertos con SLA válido
        </p>
      )}

      {peorEtapa && peorEtapa.pct < 70 && (
        <p className="text-[10px] mt-2 pt-2 border-t" style={{ borderColor: 'rgba(71, 85, 105, 0.2)', color: '#ef4444' }}>
          ⚠ Peor etapa: {peorEtapa.name} ({peorEtapa.pct}%)
        </p>
      )}
    </div>
  );
};

export default MedicionSlaPorEtapaCard;