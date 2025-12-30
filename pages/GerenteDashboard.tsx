import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { Case, CaseStatus, KPI } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Users, Clock, ThumbsUp, ArrowUp, ArrowDown, RefreshCw, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

type PeriodFilter = 'hoy' | 'semana' | 'mes';

const GerenteDashboard: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [kpis, setKpis] = useState<KPI>({ totalCases: 0, slaCompliance: 0, csatScore: 0 });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoy');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [hoveredKPI, setHoveredKPI] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [casosData, kpisData] = await Promise.all([
        api.getCases(),
        api.getKPIs()
      ]);
      setCasos(casosData);
      setKpis(kpisData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar casos críticos usando la misma lógica que Alertas Críticas
  const casosCriticos = useMemo(() => {
    return casos.filter(c => 
      c.diasAbierto >= c.categoria.slaDias || 
      c.status === CaseStatus.ESCALADO ||
      (c.categoria.slaDias - c.diasAbierto <= 1 && c.diasAbierto > 0)
    );
  }, [casos]);

  const filteredCasos = useMemo(() => {
    const now = new Date();
    let startDate = new Date();

    if (periodFilter === 'hoy') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (periodFilter === 'semana') {
      const dayOfWeek = now.getDay();
      startDate = new Date(now.setDate(now.getDate() - dayOfWeek));
      startDate.setHours(0, 0, 0, 0);
    } else if (periodFilter === 'mes') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return casos.filter(c => new Date(c.createdAt) >= startDate);
  }, [casos, periodFilter]);

  // Usar datos reales de casos críticos
  const abiertos = casos.filter(c => c.status !== CaseStatus.CERRADO && c.status !== CaseStatus.RESUELTO).length;
  const vencidos = casosCriticos.filter(c => c.diasAbierto >= c.categoria.slaDias).length;
  const escalados = casosCriticos.filter(c => c.status === CaseStatus.ESCALADO).length;
  
  // Calcular variaciones (mock - valores simulados)
  const getVariation = (current: number, label: string) => {
    if (periodFilter === 'hoy') {
      const mockPrev = Math.max(0, current - Math.floor(Math.random() * 3) + 1);
      const diff = current - mockPrev;
      const percent = mockPrev > 0 ? ((diff / mockPrev) * 100).toFixed(0) : '0';
      return {
        value: diff > 0 ? `+${diff} hoy` : diff < 0 ? `${diff} hoy` : 'Sin cambios',
        percent: mockPrev > 0 ? `${diff > 0 ? '+' : ''}${percent}% vs ayer` : null,
        isPositive: diff >= 0,
        isNegative: diff < 0
      };
    } else if (periodFilter === 'semana') {
      const mockPrev = Math.max(0, current - Math.floor(Math.random() * 5) + 2);
      const diff = current - mockPrev;
      const percent = mockPrev > 0 ? ((diff / mockPrev) * 100).toFixed(0) : '0';
      return {
        value: diff > 0 ? `+${diff} esta semana` : diff < 0 ? `${diff} esta semana` : 'Sin cambios',
        percent: mockPrev > 0 ? `${diff > 0 ? '+' : ''}${percent}% vs semana anterior` : null,
        isPositive: diff >= 0,
        isNegative: diff < 0
      };
    } else {
      const mockPrev = Math.max(0, current - Math.floor(Math.random() * 10) + 5);
      const diff = current - mockPrev;
      const percent = mockPrev > 0 ? ((diff / mockPrev) * 100).toFixed(0) : '0';
      return {
        value: diff > 0 ? `+${diff} este mes` : diff < 0 ? `${diff} este mes` : 'Sin cambios',
        percent: mockPrev > 0 ? `${diff > 0 ? '+' : ''}${percent}% vs mes anterior` : null,
        isPositive: diff >= 0,
        isNegative: diff < 0
      };
    }
  };

  const abiertosVar = getVariation(abiertos, 'Casos Abiertos');
  const vencidosVar = getVariation(vencidos, 'Excedidos SLA');
  const csatVar = {
    value: '+0.1 vs ayer',
    percent: '+2.4%',
    isPositive: true,
    isNegative: false
  };
  const historicoVar = {
    value: `+${kpis.totalCases - (kpis.totalCases - filteredCasos.length)} total`,
    percent: null,
    isPositive: true,
    isNegative: false
  };

  // Usar todos los casos, no solo los filtrados por período, para la distribución
  const chartData = [
    { name: 'Nuevos', value: casos.filter(c => c.status === CaseStatus.NUEVO).length },
    { name: 'En Proceso', value: casos.filter(c => c.status === CaseStatus.EN_PROCESO).length },
    { name: 'Escalados', value: casos.filter(c => c.status === CaseStatus.ESCALADO).length },
    { name: 'Resueltos', value: casos.filter(c => c.status === CaseStatus.RESUELTO).length },
  ];

  const totalCasos = chartData.reduce((sum, item) => sum + item.value, 0);
  const chartDataWithPercent = chartData.map(item => ({
    ...item,
    percent: totalCasos > 0 ? ((item.value / totalCasos) * 100).toFixed(1) : '0.0'
  }));

  const COLORS = ['#0f172a', '#f59e0b', '#ef4444', '#10b981'];

  const slaObjective = 90;
  const slaStatus = kpis.slaCompliance >= slaObjective ? 'en_cumplimiento' : 
                     kpis.slaCompliance >= slaObjective - 10 ? 'riesgo' : 'debajo_objetivo';
  
  const slaColor = slaStatus === 'en_cumplimiento' ? 'border-green-500' :
                   slaStatus === 'riesgo' ? 'border-amber-500' : 'border-red-500';

  const slaText = slaStatus === 'en_cumplimiento' ? 'En cumplimiento' :
                  slaStatus === 'riesgo' ? 'Por debajo del objetivo' : 'Requiere atención';

  // Generar insights automáticos usando datos reales de casos críticos
  const insights = useMemo(() => {
    const insightsList: string[] = [];
    const casosFueraSLA = casosCriticos.filter(c => c.diasAbierto >= c.categoria.slaDias);
    const casosVencen24h = casosCriticos.filter(c => {
      const diasRestantes = c.categoria.slaDias - c.diasAbierto;
      return diasRestantes > 0 && diasRestantes <= 1;
    });
    
    if (casosFueraSLA.length > 0) {
      insightsList.push(`${casosFueraSLA.length} caso${casosFueraSLA.length !== 1 ? 's' : ''} fuera de SLA`);
    }
    if (escalados > 0) {
      insightsList.push(`${escalados} caso${escalados !== 1 ? 's' : ''} escalado${escalados !== 1 ? 's' : ''} activo${escalados !== 1 ? 's' : ''}`);
    }
    if (casosVencen24h.length > 0) {
      insightsList.push(`${casosVencen24h.length} caso${casosVencen24h.length !== 1 ? 's' : ''} vence${casosVencen24h.length !== 1 ? 'n' : ''} en <24h`);
    }
    if (kpis.csatScore >= 4.0) {
      insightsList.push('CSAT estable');
    } else {
      insightsList.push('CSAT requiere atención');
    }
    if (kpis.slaCompliance >= slaObjective) {
      insightsList.push('SLA en objetivo');
    } else {
      insightsList.push(`SLA ${kpis.slaCompliance}% - Por debajo del objetivo`);
    }
    return insightsList;
  }, [casosCriticos, escalados, kpis.csatScore, kpis.slaCompliance]);

  const KPICard: React.FC<{
    label: string;
    value: number | string;
    color: string;
    bg: string;
    icon: React.ElementType;
    variation: { value: string; percent: string | null; isPositive: boolean; isNegative: boolean };
    isHighlighted?: boolean;
    tooltip?: string;
  }> = ({ label, value, color, bg, icon: Icon, variation, isHighlighted = false, tooltip }) => (
    <div
      className="p-6 rounded-2xl border shadow-sm flex items-center justify-between relative group"
      style={{
        backgroundColor: isHighlighted ? 'rgba(220, 38, 38, 0.1)' : 'rgba(30, 41, 59, 0.4)',
        borderColor: isHighlighted ? 'rgba(220, 38, 38, 0.3)' : 'rgba(148, 163, 184, 0.15)'
      }}
      onMouseEnter={() => setHoveredKPI(label)}
      onMouseLeave={() => setHoveredKPI(null)}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold uppercase tracking-widest" style={{color: '#94a3b8'}}>{label}</p>
          {tooltip && (
            <div className="relative">
              <Info className="w-3.5 h-3.5" style={{color: '#94a3b8'}} />
              {hoveredKPI === label && (
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50">
                  {tooltip}
                  <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                </div>
              )}
            </div>
          )}
        </div>
        <h3 className="text-3xl font-black mt-1" style={{color: color.includes('red') ? '#ef4444' : color.includes('green') ? '#22c55e' : color.includes('slate') ? '#ffffff' : '#ffffff'}}>{value}</h3>
        <div className="mt-2 flex items-center gap-2">
          {variation.isPositive && !variation.isNegative && (
            <ArrowUp className={`w-3 h-3 ${label === 'Excedidos SLA' ? 'text-red-600' : 'text-green-600'}`} />
          )}
          {variation.isNegative && (
            <ArrowDown className="w-3 h-3 text-green-600" />
          )}
          <span className="text-xs font-semibold" style={{
            color: label === 'Excedidos SLA' 
              ? variation.isPositive ? '#ef4444' : '#22c55e'
              : variation.isPositive ? '#22c55e' : '#ef4444'
          }}>
            {variation.value}
          </span>
        </div>
        {variation.percent && (
          <p className="text-xs mt-0.5" style={{color: '#94a3b8'}}>{variation.percent}</p>
        )}
        {isHighlighted && vencidos > 0 && (
          <p className="text-xs font-semibold mt-2" style={{color: '#f87171'}}>
            {vencidos} caso{vencidos !== 1 ? 's' : ''} fuera de SLA requieren atención
          </p>
        )}
      </div>
      <div className="p-3 rounded-xl" style={{backgroundColor: bg === 'bg-slate-900' ? 'rgb(15, 23, 42)' : bg === 'bg-red-50' ? 'rgba(220, 38, 38, 0.15)' : bg === 'bg-green-50' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(30, 41, 59, 0.6)'}}>
        <Icon className="w-6 h-6" style={{color: bg === 'bg-slate-900' ? '#ffffff' : color.includes('red') ? '#ef4444' : color.includes('green') ? '#22c55e' : '#ffffff'}} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header con filtro de período y última actualización */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div></div>
          <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-xl border p-1" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
            {(['hoy', 'semana', 'mes'] as PeriodFilter[]).map((period) => (
              <button
                key={period}
                onClick={() => setPeriodFilter(period)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: periodFilter === period ? 'rgb(15, 23, 42)' : 'transparent',
                  color: periodFilter === period ? '#ffffff' : '#cbd5e1'
                }}
                onMouseEnter={(e) => {
                  if (periodFilter !== period) {
                    e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (periodFilter !== period) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {period === 'hoy' ? 'Hoy' : period === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{color: '#94a3b8'}}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizado: {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg transition-colors disabled:opacity-50"
              style={{color: '#94a3b8'}}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.color = '#cbd5e1';
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Actualizar"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Casos Abiertos"
          value={abiertos}
          color="#ffffff"
          bg="bg-slate-900"
          icon={TrendingUp}
          variation={abiertosVar}
          tooltip="Total de casos activos que no han sido cerrados o resueltos"
        />
        <KPICard
          label="Excedidos SLA"
          value={vencidos}
          color="#ef4444"
          bg="bg-red-50"
          icon={Clock}
          variation={vencidosVar}
          isHighlighted={true}
          tooltip="Casos que han superado el tiempo comprometido de resolución (SLA)"
        />
        <KPICard
          label="CSAT Promedio"
          value={kpis.csatScore.toFixed(1)}
          color="#22c55e"
          bg="bg-green-50"
          icon={ThumbsUp}
          variation={csatVar}
          tooltip="Puntuación promedio de satisfacción del cliente (1-5)"
        />
        <KPICard
          label="Total Histórico"
          value={kpis.totalCases}
          color="#ffffff"
          bg="bg-slate-50"
          icon={Users}
          variation={historicoVar}
          tooltip="Total acumulado de casos desde el inicio del sistema"
        />
      </div>

      {/* Resumen Ejecutivo */}
      {insights.length > 0 && (
        <div className="p-6 rounded-2xl border shadow-sm" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{color: '#ffffff'}}>
            <CheckCircle2 className="w-5 h-5" style={{color: '#94a3b8'}} />
            Resumen Ejecutivo
          </h3>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm" style={{color: '#cbd5e1'}}>
                <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: '#94a3b8'}}></div>
                {insight}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por Estado */}
        <div className="p-6 rounded-2xl border shadow-sm" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{color: '#ffffff'}}>Distribución por Estado</h3>
            <div className="text-xs font-medium" style={{color: '#94a3b8'}}>
              Total: {totalCasos} casos
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartDataWithPercent}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.15)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(148, 163, 184, 0.1)'}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-lg shadow-lg border" style={{backgroundColor: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                          <p className="font-semibold" style={{color: '#ffffff'}}>{data.name}</p>
                          <p className="text-sm" style={{color: '#cbd5e1'}}>
                            {data.value} caso{data.value !== 1 ? 's' : ''} ({data.percent}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartDataWithPercent.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {chartDataWithPercent.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg" style={{backgroundColor: 'rgba(30, 41, 59, 0.6)'}}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx] }}></div>
                  <span className="font-medium" style={{color: '#cbd5e1'}}>{item.name}</span>
                </div>
                <span className="font-bold" style={{color: '#ffffff'}}>{item.value} ({item.percent}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cumplimiento de SLA */}
        <div className="p-6 rounded-2xl border shadow-sm" style={{backgroundColor: 'rgba(30, 41, 59, 0.4)', borderColor: 'rgba(148, 163, 184, 0.15)'}}>
          <h3 className="text-lg font-bold mb-6" style={{color: '#ffffff'}}>Cumplimiento de SLA</h3>
          <div className="h-64 flex flex-col justify-center items-center">
            <div className={`relative w-48 h-48 rounded-full border-[12px] flex flex-col items-center justify-center`} style={{
              borderColor: slaStatus === 'en_cumplimiento' ? '#22c55e' : slaStatus === 'riesgo' ? '#f59e0b' : '#ef4444'
            }}>
              <span className="text-4xl font-black" style={{color: '#ffffff'}}>{kpis.slaCompliance}%</span>
              <span className="text-xs font-bold uppercase tracking-tighter mt-1" style={{color: '#94a3b8'}}>On Target</span>
            </div>
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm" style={{color: '#94a3b8'}}>
                Objetivo: <span className="font-bold" style={{color: '#ffffff'}}>{slaObjective}%</span>
              </p>
              <p className="text-sm font-semibold" style={{
                color: slaStatus === 'en_cumplimiento' ? '#22c55e' :
                slaStatus === 'riesgo' ? '#f59e0b' : '#ef4444'
              }}>
                {slaText}
              </p>
              {slaStatus !== 'en_cumplimiento' && (
                <p className="text-xs mt-1" style={{color: '#94a3b8'}}>
                  {kpis.slaCompliance < slaObjective 
                    ? `Faltan ${(slaObjective - kpis.slaCompliance).toFixed(1)}% para alcanzar el objetivo`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GerenteDashboard;
