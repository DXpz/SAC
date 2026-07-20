import React, { useMemo } from 'react';
import { TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

interface Props {
  cases: any[];
  estados?: any[];
  navigate?: (path: string) => void;
}

const normalize = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, '');

const STAGE_COLORS = [
  { bar: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },   // azul
  { bar: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },   // naranja
  { bar: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },   // morado
  { bar: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },    // cyan
  { bar: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },   // verde
  { bar: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)' },  // gris
  { bar: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' }   // rosa
];

/**
 * Pipeline "Etapas Vencidas (Mes Actual)"
 *
 * Misma estructura visual que StagePipeline (recharts) pero SOLO con
 * casos cuya etapa actual está vencida (slaExpired=true) y que ingresaron
 * a esa etapa en el mes en curso.
 */
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
  const labelBg = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)';

  const isCurrentMonth = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };

  // Normalizar estados
  const estadosNorm = useMemo(() => (estados || []).map((e: any) => ({
    id: String(e.id ?? e.name ?? e.nombre ?? ''),
    nombre: String(e.nombre ?? e.name ?? ''),
    orden: e.orden ?? e.order ?? 0,
    isFinal: e.isFinal ?? e.estado_final ?? false
  })), [estados]);

  const estadosOrdenados = useMemo(() =>
    [...estadosNorm].sort((a, b) => a.orden - b.orden),
    [estadosNorm]);

  // Filtrar solo casos VENCIDOS del mes en curso
  const casosVencidos = useMemo(() => {
    return (cases || []).filter(c => {
      if (!c) return false;
      if (c.slaExpired !== true) return false;
      const estado = c.status || c.estado || '';
      if (!estado) return false;
      // Solo estados finales cerrados se excluyen del todo
      const norm = normalize(estado);
      if (norm === 'cerrado' || norm === 'resuelto' || norm === 'finalizado') return false;
      // Entrada a la etapa en el mes actual
      const fechaRef = c.fecha_actualizacion || c.fechaCreacionFormateada || c.createdAt;
      return isCurrentMonth(fechaRef);
    });
  }, [cases]);

  // Contar casos VENCIDOS por etapa
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

  const totalCount = casosVencidos.length;
  const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const handleClick = () => {
    if (!navigate) return;
    const user = api.getUser();
    const role = (user?.role || '').toUpperCase();
    const path = role === 'ADMIN' || role === 'ADMINISTRADOR' || role === 'ADMIN_GLOBAL'
      ? '/app/admin/casos'
      : '/app/casos';
    navigate(`${path}?filter=etapas-vencidas`);
  };

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm cursor-pointer hover:shadow-md transition-all"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-3">
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
          Total: <span className="font-bold" style={{ color: totalCount > 0 ? '#ef4444' : textPrimary }}>{totalCount}</span>
        </div>
      </div>

      <div className="overflow-x-auto" style={{ paddingBottom: '8px' }}>
          <div className="flex items-end justify-around gap-2" style={{ minHeight: '140px', minWidth: `${estadosOrdenados.length * 90}px` }}>
            {estadosOrdenados.map((estado, idx) => {
              const colorSet = STAGE_COLORS[idx % STAGE_COLORS.length];
              const normKey = normalize(estado.nombre);
              const count = counts[normKey] || 0;
              const hasData = count > 0;
              // Altura proporcional al maximo
              const maxBarHeight = 100;
              const minBarHeight = 12;
              const maxCount = Math.max(1, ...Object.values(counts));
              const barHeight = hasData
                ? minBarHeight + (count / maxCount) * (maxBarHeight - minBarHeight)
                : 6;

              return (
                <div
                  key={estado.id || estado.nombre}
                  className="flex flex-col items-center"
                  style={{ minWidth: '70px', flex: 1 }}
                  title={`${estado.nombre}: ${count} caso${count !== 1 ? 's' : ''} vencido${count !== 1 ? 's' : ''}`}
                >
                  {/* Contador encima de la barra */}
                  <div
                    className="text-xs font-bold mb-1"
                    style={{ color: hasData ? '#ef4444' : textTertiary }}
                  >
                    {count}
                  </div>
                  {/* Barra */}
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${barHeight}px`,
                      backgroundColor: hasData ? colorSet.bar : axisColor,
                      boxShadow: hasData ? `0 -2px 8px ${colorSet.glow}` : 'none',
                      opacity: hasData ? 1 : 0.4
                    }}
                  />
                  {/* Label inferior: nombre de la etapa (siempre visible) */}
                  <div
                    className="text-[11px] text-center mt-2 leading-tight px-1 w-full"
                    style={{
                      color: textPrimary,
                      fontWeight: 500,
                      opacity: hasData ? 1 : 0.7
                    }}
                  >
                    {estado.nombre}
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