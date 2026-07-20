import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
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

const isCurrentMonth = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/**
 * Card "Etapas Vencidas (Mes Actual)"
 *
 * Cuenta casos cuya etapa actual está vencida (slaExpired=true) y que
 * ingresaron a esa etapa en el mes en curso.
 *
 * Siempre muestra la gráfica de barras por etapa (no requiere expandir).
 */
const EtapasVencidasCard: React.FC<Props> = ({
  cases,
  estados,
  navigate,
  onCardClick
}) => {
  const { theme } = useTheme();

  const { total, breakdown } = useMemo(() => {
    const isVencida = (c: any) => c?.slaExpired === true;

    // Solo casos: abiertos, etapa vencida, y entrada a la etapa en mes actual
    // (fecha del último cambio de estado o fecha_creacion)
    const filtered = (cases || []).filter(c => {
      if (!c || isFinalStatus(c.status || c.estado)) return false;
      if (!isVencida(c)) return false;
      const fechaRef = c.fecha_actualizacion || c.fechaCreacionFormateada || c.createdAt;
      return isCurrentMonth(fechaRef);
    });

    const map: Record<string, number> = {};
    filtered.forEach(c => {
      const key = c.status || c.estado || 'Sin etapa';
      map[key] = (map[key] || 0) + 1;
    });

    const order = estados && estados.length > 0
      ? estados.map((e: any) => e.nombre)
      : ['Nueva Solicitud', 'Primer Contacto', 'Diagnóstico', 'Ejecución', 'Control de Calidad', 'Listo - pendiente entrega cliente', 'Finalizado'];

    const breakdownList = order
      .map(name => ({ name, value: map[name] || 0 }));

    // Agregar estados que esten en map pero no en order (al final)
    Object.keys(map).forEach(k => {
      if (!order.includes(k)) {
        breakdownList.push({ name: k, value: map[k] });
      }
    });

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

  const monthLabel = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div
      title={`Casos cuya etapa actual excedió su SLA, ingresados en ${monthLabel}.`}
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
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: styles.text.secondary }}>
            Etapas Vencidas
          </p>
          <p className="text-[10px] mt-1 capitalize" style={{ color: total > 0 ? '#ef4444' : styles.text.tertiary }}>
            {monthLabel} · {total > 0 ? 'SLA de etapa excedido' : 'En tiempo'}
          </p>
        </div>
      </div>

      {breakdown.length > 0 ? (
        <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'rgba(71, 85, 105, 0.2)' }}>
          {breakdown.map((b) => {
            const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
            const hasVencidos = b.value > 0;
            return (
              <div key={b.name} className="flex items-center gap-1.5">
                <span
                  className="text-[10px] flex-1 whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: hasVencidos ? styles.text.primary : styles.text.tertiary, minWidth: 0 }}
                  title={b.name}
                >
                  {b.name}
                </span>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(71, 85, 105, 0.2)', width: '50px', flexShrink: 0 }}
                >
                  {hasVencidos && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: '#ef4444' }}
                    />
                  )}
                </div>
                <span
                  className="text-[10px] font-bold tabular-nums w-5 text-right"
                  style={{ color: hasVencidos ? '#ef4444' : styles.text.tertiary }}
                >
                  {b.value}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] italic mt-3 pt-3 border-t" style={{ borderColor: 'rgba(71, 85, 105, 0.2)', color: styles.text.tertiary }}>
          Sin etapas configuradas
        </p>
      )}
    </div>
  );
};

export default EtapasVencidasCard;