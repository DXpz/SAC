
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente } from '../types';
import { STATE_COLORS } from '../constants';
import { Search, Plus, Filter, ChevronRight, RefreshCw, X } from 'lucide-react';

const BandejaCasos: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [filtered, setFiltered] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadClientes();
    loadCasos();
  }, []);

  // Enriquecer casos cuando se actualice la lista de clientes
  useEffect(() => {
    if (clientes.length > 0 && casos.length > 0) {
      const casosEnriquecidos = casos.map(caso => {
        // Buscar el cliente completo en la lista de clientes
        const clienteCompleto = clientes.find(cli => cli.idCliente === caso.clientId || cli.idCliente === (caso as any).cliente?.idCliente);
        
        if (clienteCompleto && caso.clientName !== clienteCompleto.nombreEmpresa) {
          return {
            ...caso,
            clientName: clienteCompleto.nombreEmpresa,
            clientId: clienteCompleto.idCliente,
            cliente: clienteCompleto,
          };
        }
        
        return caso;
      });
      
      // Solo actualizar si hay cambios
      const hasChanges = casosEnriquecidos.some((caso, idx) => 
        caso.clientName !== casos[idx].clientName || caso.clientId !== casos[idx].clientId
      );
      
      if (hasChanges) {
        setCasos(casosEnriquecidos);
      }
    }
  }, [clientes]);

  const loadClientes = async () => {
    const data = await api.getClientes();
    setClientes(data);
  };

  const loadCasos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      
      // Enriquecer casos con datos completos del cliente desde la lista de clientes
      const casosEnriquecidos = data.map(caso => {
        // Buscar el cliente completo en la lista de clientes usando el clientId
        const clienteCompleto = clientes.find(cli => 
          cli.idCliente === caso.clientId || 
          cli.idCliente === (caso as any).cliente?.idCliente ||
          cli.idCliente === caso.clientId?.replace('CL', 'CL0000') // Normalizar formato de ID
        );
        
        if (clienteCompleto) {
          return {
            ...caso,
            clientName: clienteCompleto.nombreEmpresa,
            clientId: clienteCompleto.idCliente,
            cliente: clienteCompleto,
          };
        }
        
        return caso;
      });
      
      setCasos([...casosEnriquecidos]);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Error al cargar casos:', err);
      setError(err.message || 'Error al cargar los casos desde el servidor. Por favor, intenta nuevamente.');
      setCasos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    let result = casos.filter(c => {
      const id = (c.id || c.ticketNumber || '').toLowerCase();
      const client = (c.clientName || '').toLowerCase();
      const subject = (c.subject || '').toLowerCase();
      
      return id.includes(term) || client.includes(term) || subject.includes(term);
    });

    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter || (c as any).estado === statusFilter);
    }

    setFiltered(result);
  }, [searchTerm, statusFilter, casos]);


  return (
    <div className="space-y-6">
      <div 
        className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-6 rounded-2xl shadow-lg border-2 backdrop-blur-sm bg-white"
        style={{
          borderColor: 'rgba(226, 232, 240, 0.5)'
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente o Asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-accent-light border border-accent-light rounded-xl focus:outline-none focus:ring-2 focus:bg-white transition-all text-sm font-medium shadow-sm"
            style={{
              '--tw-ring-color': 'var(--color-brand-red)',
              '--tw-ring-opacity': '0.2'
            } as React.CSSProperties & { '--tw-ring-color': string, '--tw-ring-opacity': string }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-brand-red)';
              e.target.style.boxShadow = '0 0 0 2px rgba(200, 21, 27, 0.2)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--color-accent-light)';
              e.target.style.boxShadow = '';
            }}
          />
          </div>
          {lastUpdate && !loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizado: {lastUpdate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={loadCasos}
            disabled={loading}
            className="px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: 'var(--color-accent-gray)',
              borderColor: 'rgba(226, 232, 240, 0.5)',
              backgroundColor: 'white'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'rgba(226, 232, 240, 0.3)';
                e.currentTarget.style.borderColor = 'var(--color-brand-red)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.5)';
              }
            }}
            title="Actualizar casos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-gray w-5 h-5 pointer-events-none transition-colors" style={{color: 'var(--color-accent-gray)'}} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-12 pr-10 py-3 bg-accent-light border border-accent-light rounded-xl focus:outline-none transition-all text-sm font-medium appearance-none cursor-pointer shadow-sm hover:bg-white"
              style={{color: 'var(--color-accent-gray)'}}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-brand-red)';
                e.target.style.boxShadow = '0 0 0 2px rgba(200, 21, 27, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--color-accent-light)';
                e.target.style.boxShadow = '';
              }}
            >
              <option value="all">Todos los Estados</option>
              {Object.values(CaseStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button 
            onClick={() => navigate('/app/casos/nuevo')}
            className="text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-accent-red), var(--color-brand-red))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))';
            }}
          >
            <Plus className="w-5 h-5" /> Nuevo Caso
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200/50 p-16 text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderColor: 'var(--color-brand-red)'}}></div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">Cargando casos...</h3>
          <p className="text-slate-500 text-sm">Obteniendo datos desde el servidor</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-red-200/50 p-16 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Error al cargar casos</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadCasos}
            className="px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200/50 p-16 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">No se encontraron casos</h3>
          <p className="text-slate-500 text-sm">
            {casos.length === 0 
              ? 'No hay casos registrados en el sistema'
              : 'Intenta ajustar los filtros de búsqueda'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-600 tracking-normal">ID Caso</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-600 tracking-normal">Cliente</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-600 tracking-normal">Categoría</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-600 tracking-normal">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-600 tracking-normal text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((caso, idx) => (
                  <tr 
                    key={caso.id} 
                    className={`transition-all duration-300 cursor-pointer group border-l-4 border-transparent animate-in slide-in-from-left fade-in`}
                    style={{
                      animationDelay: `${idx * 30}ms`,
                      '--hover-bg': 'rgba(16, 122, 180, 0.05)', 
                      '--hover-border': 'var(--color-accent-blue)'
                    } as React.CSSProperties & { '--hover-bg': string, '--hover-border': string }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(200, 21, 27, 0.05)';
                      e.currentTarget.style.borderLeftColor = 'var(--color-brand-red)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(200, 21, 27, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.borderLeftColor = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '';
                    }} 
                    onClick={() => navigate(`/app/casos/${caso.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">{caso.ticketNumber || (caso as any).idCaso}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {caso.clientId || caso.cliente?.idCliente || 'N/A'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {caso.clientName || caso.cliente?.nombreEmpresa || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                        {caso.category || caso.categoria?.nombre}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border shadow-sm ${STATE_COLORS[(caso.status || (caso as any).estado) as CaseStatus]}`}>
                        {caso.status || (caso as any).estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end">
                        <ChevronRight className="w-5 h-5 transition-all" style={{color: 'var(--color-accent-gray)'}} onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-brand-red)'; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-accent-gray)'; e.currentTarget.style.transform = ''; }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BandejaCasos;
