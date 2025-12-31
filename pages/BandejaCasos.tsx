
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Case, CaseStatus, Cliente, Categoria } from '../types';
import { STATE_COLORS } from '../constants';
import { Search, Plus, Filter, ChevronRight, RefreshCw, X } from 'lucide-react';

const BandejaCasos: React.FC = () => {
  const [casos, setCasos] = useState<Case[]>([]);
  const [filtered, setFiltered] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoriaFilter, setCategoriaFilter] = useState<string>('all');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const navigate = useNavigate();

  // Función para normalizar el estado del caso
  const normalizeStatus = (status: string | CaseStatus | undefined): CaseStatus => {
    if (!status) return CaseStatus.NUEVO;
    const statusStr = String(status).trim();
    // Buscar coincidencia exacta o por valor del enum
    const statusValues = Object.values(CaseStatus);
    const matchedStatus = statusValues.find(s => {
      const sNormalized = s.toLowerCase().replace(/\s+/g, '');
      const statusNormalized = statusStr.toLowerCase().replace(/\s+/g, '');
      return s === statusStr || s.toLowerCase() === statusStr.toLowerCase() || sNormalized === statusNormalized;
    });
    return (matchedStatus as CaseStatus) || CaseStatus.NUEVO;
  };

  // Función para obtener los colores del estado
  const getStatusColors = (status: CaseStatus) => {
    const statusColors: Record<CaseStatus, { backgroundColor: string; color: string; borderColor: string }> = {
      [CaseStatus.NUEVO]: { backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#3b82f6' },
      [CaseStatus.EN_PROCESO]: { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' },
      [CaseStatus.PENDIENTE_CLIENTE]: { backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#a855f7' },
      [CaseStatus.ESCALADO]: { backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#ef4444' },
      [CaseStatus.RESUELTO]: { backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#10b981' },
      [CaseStatus.CERRADO]: { backgroundColor: '#f1f5f9', color: '#334155', borderColor: '#64748b' }
    };
    return statusColors[status] || { backgroundColor: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadClientes();
    loadCategorias();
    loadCasos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enriquecer casos cuando se actualice la lista de clientes o categorías
  useEffect(() => {
    if (casos.length > 0 && (clientes.length > 0 || categorias.length > 0)) {
      const casosEnriquecidos = casos.map(caso => {
        let casoActualizado = { ...caso };
        
        // Enriquecer con cliente completo
        if (clientes.length > 0) {
          const clienteCompleto = clientes.find(cli => 
            cli.idCliente === caso.clientId || 
            cli.idCliente === (caso as any).cliente?.idCliente ||
            cli.idCliente === caso.clientId?.replace('CL', 'CL0000') // Normalizar formato de ID
          );
          
          if (clienteCompleto) {
            casoActualizado = {
              ...casoActualizado,
              clientName: clienteCompleto.nombreEmpresa,
              clientId: clienteCompleto.idCliente,
              cliente: clienteCompleto,
            };
          }
        }
        
        // Enriquecer con categoría completa
        if (categorias.length > 0) {
          const categoriaId = caso.categoria?.idCategoria || (caso as any).categoria_id || (caso as any).categoriaId;
          const categoriaCompleta = categorias.find(cat => 
            cat.idCategoria === categoriaId ||
            cat.idCategoria === caso.categoria?.idCategoria ||
            String(cat.idCategoria) === String(categoriaId)
          );
          
          if (categoriaCompleta) {
            casoActualizado = {
              ...casoActualizado,
              category: categoriaCompleta.nombre,
              categoria: categoriaCompleta,
            };
          }
        }
        
        return casoActualizado;
      });
      
      // Solo actualizar si hay cambios
      const hasChanges = casosEnriquecidos.some((caso, idx) => 
        caso.clientName !== casos[idx].clientName || 
        caso.clientId !== casos[idx].clientId ||
        caso.category !== casos[idx].category ||
        caso.categoria?.idCategoria !== casos[idx].categoria?.idCategoria
      );
      
      if (hasChanges) {
        setCasos(casosEnriquecidos);
      }
    }
  }, [clientes, categorias, casos]);

  const loadClientes = async () => {
    try {
      const data = await api.getClientes();
      setClientes(data);
    } catch (err) {
      console.error('Error al cargar clientes:', err);
    }
  };

  const loadCategorias = async () => {
    try {
      const data = await api.getCategorias();
      setCategorias(data);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    }
  };

  const loadCasos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCases();
      
      // Enriquecer casos con datos completos del cliente y categoría
      const casosEnriquecidos = data.map(caso => {
        let casoActualizado = { ...caso };
        
        // Enriquecer con cliente completo
        if (clientes.length > 0) {
          const clienteCompleto = clientes.find(cli => 
            cli.idCliente === caso.clientId || 
            cli.idCliente === (caso as any).cliente?.idCliente ||
            cli.idCliente === caso.clientId?.replace('CL', 'CL0000') // Normalizar formato de ID
          );
          
          if (clienteCompleto) {
            casoActualizado = {
              ...casoActualizado,
              clientName: clienteCompleto.nombreEmpresa,
              clientId: clienteCompleto.idCliente,
              cliente: clienteCompleto,
            };
          }
        }
        
        // Enriquecer con categoría completa
        if (categorias.length > 0) {
          const categoriaId = caso.categoria?.idCategoria || (caso as any).categoria_id || (caso as any).categoriaId;
          const categoriaCompleta = categorias.find(cat => 
            cat.idCategoria === categoriaId ||
            cat.idCategoria === caso.categoria?.idCategoria ||
            String(cat.idCategoria) === String(categoriaId)
          );
          
          if (categoriaCompleta) {
            casoActualizado = {
              ...casoActualizado,
              category: categoriaCompleta.nombre,
              categoria: categoriaCompleta,
            };
          }
        }
        
        return casoActualizado;
      });
      
      setCasos([...casosEnriquecidos]);
      const updateTime = new Date();
      setLastUpdate(updateTime);
      // Guardar en localStorage para que Layout pueda mostrarlo
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
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
      result = result.filter(c => {
        const rawStatus = c.status || (c as any).estado;
        const normalizedStatus = normalizeStatus(rawStatus);
        return normalizedStatus === statusFilter;
      });
    }

    if (categoriaFilter !== 'all') {
      result = result.filter(c => {
        const categoriaId = c.categoria?.idCategoria || (c as any).categoria_id || (c as any).categoriaId;
        return String(categoriaId) === String(categoriaFilter) || c.category === categoriaFilter;
      });
    }

    setFiltered(result);
  }, [searchTerm, statusFilter, categoriaFilter, casos]);


  return (
    <div className="space-y-6">
      <div 
        className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-4 rounded-3xl shadow-xl border backdrop-blur-sm"
        style={{
          backgroundColor: '#ffffff',
          borderColor: 'rgba(148, 163, 184, 0.2)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{color: '#64748b'}} />
          <input
            type="text"
            placeholder="Buscar por ID, Cliente o Asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-5 py-3 border rounded-2xl focus:outline-none focus:ring-4 transition-all text-xs font-medium shadow-sm hover:shadow-md"
            style={{
              backgroundColor: '#f8fafc',
              borderColor: 'rgba(148, 163, 184, 0.3)',
              color: '#1e293b',
              '--tw-ring-color': 'var(--color-accent-blue)',
              '--tw-ring-opacity': '0.2'
            } as React.CSSProperties & { '--tw-ring-color': string, '--tw-ring-opacity': string }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--color-accent-blue)';
              e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
              e.target.style.backgroundColor = '#ffffff';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
              e.target.style.boxShadow = '';
              e.target.style.backgroundColor = '#f8fafc';
            }}
          />
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto flex-wrap">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors z-10" style={{color: statusFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: statusFilter === 'all' ? '#ffffff' : '#e0f2fe',
                borderColor: statusFilter === 'all' ? '#cbd5e1' : '#107ab4',
                color: statusFilter === 'all' ? '#475569' : '#0c4a6e',
                minWidth: '190px',
                boxShadow: statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
              onMouseEnter={(e) => {
                if (statusFilter === 'all') {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                } else {
                  e.currentTarget.style.backgroundColor = '#bae6fd';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 122, 180, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (statusFilter === 'all') {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                } else {
                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 122, 180, 0.15)';
                }
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#107ab4';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.15), 0 2px 4px rgba(16, 122, 180, 0.2)';
                e.target.style.backgroundColor = statusFilter === 'all' ? '#f8fafc' : '#bae6fd';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = statusFilter === 'all' ? '#cbd5e1' : '#107ab4';
                e.target.style.boxShadow = statusFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)';
                e.target.style.backgroundColor = statusFilter === 'all' ? '#ffffff' : '#e0f2fe';
              }}
            >
              <option value="all">Todos los Estados</option>
              {Object.values(CaseStatus).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-200" style={{color: statusFilter === 'all' ? '#64748b' : '#107ab4', transform: 'rotate(90deg)'}} />
          </div>
          
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors z-10" style={{color: categoriaFilter === 'all' ? '#64748b' : '#107ab4'}} />
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 border rounded-xl focus:outline-none transition-all text-xs font-semibold appearance-none cursor-pointer"
              style={{
                backgroundColor: categoriaFilter === 'all' ? '#ffffff' : '#e0f2fe',
                borderColor: categoriaFilter === 'all' ? '#cbd5e1' : '#107ab4',
                color: categoriaFilter === 'all' ? '#475569' : '#0c4a6e',
                minWidth: '190px',
                boxShadow: categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)'
              }}
              onMouseEnter={(e) => {
                if (categoriaFilter === 'all') {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                } else {
                  e.currentTarget.style.backgroundColor = '#bae6fd';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 122, 180, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (categoriaFilter === 'all') {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                } else {
                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                  e.currentTarget.style.borderColor = '#107ab4';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 122, 180, 0.15)';
                }
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#107ab4';
                e.target.style.boxShadow = '0 0 0 3px rgba(16, 122, 180, 0.15), 0 2px 4px rgba(16, 122, 180, 0.2)';
                e.target.style.backgroundColor = categoriaFilter === 'all' ? '#f8fafc' : '#bae6fd';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = categoriaFilter === 'all' ? '#cbd5e1' : '#107ab4';
                e.target.style.boxShadow = categoriaFilter === 'all' ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 4px rgba(16, 122, 180, 0.15)';
                e.target.style.backgroundColor = categoriaFilter === 'all' ? '#ffffff' : '#e0f2fe';
              }}
            >
              <option value="all">Todas las Categorías</option>
              {categorias.map(cat => (
                <option key={cat.idCategoria} value={cat.idCategoria}>
                  {cat.nombre}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-all duration-200" style={{color: categoriaFilter === 'all' ? '#64748b' : '#107ab4', transform: 'rotate(90deg)'}} />
          </div>
          
          <button 
            onClick={() => navigate('/app/casos/nuevo')}
            className="text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))'}}
          >
            <Plus className="w-5 h-5" /> Nuevo Caso
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
          <div className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderColor: 'var(--color-brand-red)'}}></div>
            <h3 className="text-base font-bold mb-2" style={{color: '#1e293b'}}>Cargando casos...</h3>
            <p className="text-sm" style={{color: '#64748b'}}>Obteniendo datos desde el servidor</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl shadow-xl border p-12 text-center" style={{backgroundColor: '#ffffff', borderColor: 'rgba(200, 21, 27, 0.3)'}}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor: 'rgba(200, 21, 27, 0.2)'}}>
            <X className="w-10 h-10" style={{color: '#f87171'}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: '#1e293b'}}>Error al cargar casos</h3>
          <p className="text-sm mb-4" style={{color: '#ef4444'}}>{error}</p>
          <button
            onClick={loadCasos}
            className="px-6 py-2 rounded-lg font-semibold transition-colors"
            style={{background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))', color: '#ffffff'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-accent-red), var(--color-brand-red))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))';
            }}
          >
            Reintentar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl shadow-xl border p-12 text-center" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{backgroundColor: '#f8fafc'}}>
            <Search className="w-12 h-12" style={{color: '#94a3b8'}} />
          </div>
          <h3 className="text-base font-bold mb-2" style={{color: '#1e293b'}}>No se encontraron casos</h3>
          <p className="text-sm font-medium" style={{color: '#64748b'}}>
            {casos.length === 0 
              ? 'No hay casos registrados en el sistema'
              : 'Intenta ajustar los filtros de búsqueda'}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                <tr>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>ID Caso</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Categoría</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase" style={{color: '#475569'}}>Estado</th>
                  <th className="px-4 py-3 text-xs font-bold tracking-wide uppercase text-right" style={{color: '#475569'}}>Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{borderColor: 'rgba(148, 163, 184, 0.15)'}}>
                {filtered.map((caso, idx) => (
                  <tr 
                    key={caso.id} 
                    className="transition-all duration-200 cursor-pointer group relative"
                    style={{
                      backgroundColor: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }} 
                    onClick={() => navigate(`/app/casos/${caso.id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold transition-colors" style={{color: '#1e293b'}}>{caso.ticketNumber || (caso as any).idCaso}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm" style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          borderColor: 'rgba(148, 163, 184, 0.2)'
                        }}>
                          {caso.clientId || caso.cliente?.idCliente || 'N/A'}
                        </span>
                        <span className="text-xs font-semibold" style={{color: '#1e293b'}}>
                          {caso.clientName || caso.cliente?.nombreEmpresa || 'Sin nombre'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-[10px] font-semibold px-2.5 py-1.5 rounded-xl border shadow-sm" style={{
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}>
                        {caso.category || caso.categoria?.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const rawStatus = caso.status || (caso as any).estado;
                        const normalizedStatus = normalizeStatus(rawStatus);
                        return (
                          <span 
                            className="text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: (() => {
                                if (normalizedStatus === CaseStatus.NUEVO) return '#2563eb';
                                if (normalizedStatus === CaseStatus.EN_PROCESO) return '#d97706';
                                if (normalizedStatus === CaseStatus.PENDIENTE_CLIENTE) return '#9333ea';
                                if (normalizedStatus === CaseStatus.ESCALADO) return '#dc2626';
                                if (normalizedStatus === CaseStatus.RESUELTO) return '#16a34a';
                                if (normalizedStatus === CaseStatus.CERRADO) return '#64748b';
                                return '#475569';
                              })()
                            }}
                          >
                            {rawStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end">
                        <div className="p-2 rounded-lg transition-all" style={{
                          backgroundColor: 'transparent'
                        }}>
                          <ChevronRight className="w-5 h-5 transition-all" style={{color: '#64748b'}} onMouseEnter={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.transform = 'translateX(4px)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.transform = ''; }} />
                        </div>
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
