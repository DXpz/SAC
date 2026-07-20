import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Case } from '../types';
import { getStageSlaDays, isClosedCase } from '../utils/slaUtils';

interface Estado {
  id: string;
  nombre: string;
  orden?: number;
  isFinal?: boolean;
}

interface StagePipelineProps {
  casos: Case[];
  estados: Estado[];
  isAdminGlobal?: boolean;
  paisFilter?: string;
  onStageClick?: (estadoNombre: string) => void;
  theme?: 'light' | 'dark';
}

const STAGE_COLORS = [
  { bar: '#3b82f6', name: '#60a5fa' },  // azul
  { bar: '#f59e0b', name: '#fbbf24' },  // ambar
  { bar: '#8b5cf6', name: '#a78bfa' },  // purpura
  { bar: '#06b6d4', name: '#22d3ee' },  // cyan
  { bar: '#10b981', name: '#34d399' },  // verde
  { bar: '#f97316', name: '#fb923c' },  // naranja
  { bar: '#ec4899', name: '#f472b6' },  // rosa
  { bar: '#6b7280', name: '#9ca3af' }   // gris
];

const normalize = (s: string) =>
  String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

export const StagePipeline: React.FC<StagePipelineProps> = ({
  casos,
  estados,
  onStageClick,
  theme = 'light'
}) => {
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const textTertiary = isDark ? '#64748b' : '#94a3b8';
  const axisColor = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)';
  const labelBg = isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.8)';
  const baselineColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.4)';

  // Normalizar estados
  const estadosNorm = useMemo(() => estados.map((e: any) => ({
    id: String(e.id ?? e.name ?? e.nombre ?? ''),
    nombre: String(e.nombre ?? e.name ?? ''),
    orden: e.orden ?? e.order ?? 0,
    isFinal: e.isFinal ?? e.estado_final ?? false
  })), [estados]);

  // Ordenar por orden
  const estadosOrdenados = useMemo(() =>
    [...estadosNorm].sort((a, b) => a.orden - b.orden),
    [estadosNorm]);

  // Contar casos por estado (solo current para Finalizado)
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of casos) {
      if (!c) continue;
      const estado = c.status || (c as any).estado || '';
      if (!estado) continue;
      const key = normalize(estado);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [casos]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(counts)), [counts]);
  const totalCount = casos.length;

  // Solo mostrar estados con count > 0 (y al menos los del flujo, aunque tengan 0)
  // estadosVisibles removido - ahora mostramos TODOS los estados, los vacios solo con label
  const _estadosVisiblesUnused = estadosOrdenados;

  if (totalCount === 0) {
    return (
      <div
        className="rounded-2xl border p-5 shadow-sm"
        style={{ backgroundColor: cardBg, borderColor: cardBorder }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold" style={{ color: textPrimary }}>
              Pipeline por Etapa
            </h2>
            <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
              Distribución de casos en cada estado
            </p>
          </div>
        </div>
        <p className="text-sm text-center py-8" style={{ color: textTertiary }}>
          No hay casos en este momento
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5 shadow-sm"
      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: textPrimary }}>
            Pipeline por Etapa
          </h2>
          <p className="text-xs mt-0.5" style={{ color: textSecondary }}>
            Distribución de casos en cada estado
          </p>
        </div>
        <div className="text-xs font-medium" style={{ color: textSecondary }}>
          Total: <span className="font-bold" style={{ color: textPrimary }}>{totalCount}</span>
        </div>
      </div>

      {/* Contenedor de barras */}
      <div className="relative pl-36 pr-4">
        {/* Linea base (eje X) */}
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
            // Altura proporcional: minimo 8% si tiene casos, para que sea visible
            const heightPct = hasData ? Math.max(12, (count / maxCount) * 100) : 0;

            return (
              <div
                key={estado.id}
                className="flex flex-col items-center justify-end h-full relative group"
                style={{ width: '90px' }}
              >
                {/* Tooltip on hover */}
                <div
                  className="absolute bottom-full mb-2 px-2 py-1 rounded text-[10px] font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                  style={{
                    backgroundColor: isDark ? '#020617' : '#1e293b',
                    color: '#fff',
                    border: `1px solid ${colorSet.bar}`
                  }}
                >
                  {count} {count === 1 ? 'caso' : 'casos'}
                </div>

                {/* Tooltip on hover */}
                <div
                  className="absolute bottom-full mb-2 px-2 py-1 rounded text-[10px] font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10"
                  style={{
                    backgroundColor: isDark ? '#020617' : '#1e293b',
                    color: '#fff',
                    border: `1px solid ${colorSet.bar}`
                  }}
                >
                  {count} {count === 1 ? 'caso' : 'casos'}
                </div>

                {/* Numero arriba de la barra (solo si tiene datos) */}
                {hasData ? (
                  <p
                    className="text-lg font-black leading-none mb-1 transition-all"
                    style={{ color: colorSet.bar }}
                  >
                    {count}
                  </p>
                ) : (
                  <div className="h-6" /> /* spacer para mantener alineacion */
                )}

                {/* Barra (solo si tiene datos) */}
                {hasData ? (
                  <button
                    onClick={() => onStageClick?.(estado.nombre)}
                    className="w-full rounded-t-md transition-all hover:opacity-80 cursor-pointer"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: '8px',
                      backgroundColor: colorSet.bar,
                      boxShadow: `0 -2px 8px ${colorSet.bar}40`
                    }}
                    title={`${estado.nombre}: ${count} caso${count === 1 ? '' : 's'}${slaDays != null ? ` · SLA ${slaDays}d` : ''}`}
                  />
                ) : (
                  <div className="w-full h-1 opacity-30" style={{ backgroundColor: axisColor }} />
                )}

                {/* Label de la etapa (debajo del eje) - SIEMPRE visible */}
                <div
                  className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-24 text-center"
                >
                  <p
                    className={`text-[10px] font-bold leading-tight uppercase tracking-wide ${slaDays == null ? '' : 'mb-0.5'}`}
                    style={{ color: hasData ? textPrimary : textTertiary }}
                  >
                    {estado.nombre}
                  </p>
                  {slaDays != null && (
                    <p
                      className="text-[9px] font-medium"
                      style={{ color: colorSet.bar }}
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

export default StagePipeline;
