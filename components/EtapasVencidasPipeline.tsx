import React, { useMemo } from 'react';
import { TrendingDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { getStageSlaDays, isClosedCase } from '../utils/slaUtils';

interface Props {
  cases: any[];
  estados?: any[];
  navigate?: (path: string) => void;
}

const STAGE_COLORS = [
  { bar: '#3b82f6', name: '#60a5fa' },
  { bar: '#f59e0b', name: '#fbbf24' },
  { bar: '#8b5cf6', name: '#a78bfa' },
  { bar: '#06b6d4', name: '#22d3ee' },
  { bar: '#10b981', name: '#34d399' },
  { bar: '#f97316', name: '#fb923c' },
  { bar: '#ec4899', name: '#f472b6' },
  { bar: '#6b7280', name: '#9ca3af' }
];

const normalize = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

const EtapasVencidasPipeline: React.FC<Props> = ({
  cases,
  estados,
  navigate
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textTertiary = isDark ? '#64748b' : '#94a3b8';
  const axisColor = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)';
  const baselineColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.4)';

  const isCurrentMonth = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  const estadosNorm = useMemo(() => (estados || []).map((e: any) => ({
    id: String(e.id ?? e.name ?? e.nombre ?? ''),
    nombre: String(e.nombre ?? e.name ?? ''),
    orden: e.orden ?? e.order ?? 0,
    isFinal: e.isFinal ?? e.estado_final ?? false
  })), [estados]);

  const estadosOrdenados = useMemo(() =>
    [...estadosNorm].sort((a, b) => a.orden - b.orden),
    [estadosNorm]);

  const casosVencidos = useMemo(() => {
    return (cases || []).filter(c => {
      if (!c) return false;
      if (c.slaExpired !== true) return false;
      const estado = c.status || c.estado || '';
      if (!estado) return false;
      const norm = normalize(estado).replace(/\s+/g, '');
      if (norm === 'cerrado' || norm === 'resuelto' || norm === 'finalizado') return false;
      const fechaRef = c.fecha_actualizacion || c.fechaCreacionFormateada || c.createdAt;
      return isCurrentMonth(fechaRef);
    });
  }, [cases]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of casosVencidos) {
      const estado = c.status || c.estado || '';
      if (!estado) continue;
      const key = normalize(estado);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [casosVencidos]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);
  const totalCount = casosVencidos.length;
  const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const handleStageClick = (estadoNombre: string) => {
    if (!navigate) return;
    const user = api.getUser();
    const role = (user?.role || '').toUpperCase();
    const path = role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMIN_GLOBAL'
      ? '/app/admin/casos'
      : '/app/casos';
    navigate(`${path}?filter=etapas-vencidas&etapa=${encodeURIComponent(estadoNombre)}`);
  };

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: textPrimary }}>
            <TrendingDown className="w-5 h-5" style={{ color: '#ef4444' }} />
            Etapas Vencidas
          </h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
            Distribución de casos vencidos en cada etapa ({monthLabel})
          </p>
        </div>
        <div className="text-xs font-medium" style={{ color: textSecondary }}>
          Total: <span className="font-bold" style={{ color: '#ef4444' }}>{totalCount}</span>
        </div>
      </div>

      <div className="relative pl-36 pr-4">
        <div
          className="absolute bottom-0 left-36 right-0 h-0.5"
          style={{ backgroundColor: baselineColor }}
        />

        <div className="flex items-end justify-center gap-6 h-64 pb-16 flex-wrap">
          {estadosOrdenados.map((estado, idx) => {
            const key = normalize(estado.nombre);
            const count = counts[key] || 0;
            const hasData = count > 0;
            const colorSet = STAGE_COLORS[idx % STAGE_COLORS.length];
            const slaDays = isClosedCase({ status: estado.nombre }) ? null : getStageSlaDays(estado.nombre);
            const heightPct = hasData ? Math.max(12, (count / maxCount) * 100) : 0;

            return (
              <div
                key={estado.id}
                className="flex flex-col items-center justify-end h-full relative group"
                style={{ width: '90px' }}
              >
                <div
                  className="absolute bottom-full mb-2 px-2 py-1 rounded text-[10px] font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                  style={{
                    backgroundColor: isDark ? '#020617' : '#1e293b',
                    color: '#fff',
                    border: `1px solid ${hasData ? '#ef4444' : colorSet.bar}`
                  }}
                >
                  {count} vencido{count === 1 ? '' : 's'}
                </div>

                {hasData ? (
                  <p
                    className="text-lg font-black leading-none mb-1 transition-all"
                    style={{ color: '#ef4444' }}
                  >
                    {count}
                  </p>
                ) : (
                  <div className="h-6" />
                )}

                {hasData ? (
                  <button
                    onClick={() => handleStageClick(estado.nombre)}
                    className="w-full rounded-t-md transition-all hover:opacity-80 cursor-pointer"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: '8px',
                      backgroundColor: '#ef4444',
                      boxShadow: '0 -2px 8px rgba(239, 68, 68, 0.4)'
                    }}
                    title={`${estado.nombre}: ${count} vencido${count !== 1 ? 's' : ''}${slaDays != null ? ` · SLA ${slaDays}d` : ''}`}
                  />
                ) : (
                  <div className="w-full h-1 opacity-30" style={{ backgroundColor: axisColor }} />
                )}

                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-24 text-center">
                  <p
                    className={`text-[10px] font-bold leading-tight uppercase tracking-wide ${slaDays == null ? '' : 'mb-0.5'}`}
                    style={{ color: hasData ? textPrimary : (isDark ? '#cbd5e1' : '#475569') }}
                  >
                    {estado.nombre}
                  </p>
                  {slaDays != null && (
                    <p
                      className="text-[9px] font-medium"
                      style={{ color: '#ef4444' }}
                    >
                      SLA {slaDays}d
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EtapasVencidasPipeline;
