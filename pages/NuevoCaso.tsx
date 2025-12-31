import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CaseStatus, Cliente, Categoria, Channel } from '../types';
import { Search, X, Building2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Toast, { ToastType } from '../components/Toast';

const NuevoCaso: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [newCase, setNewCase] = useState({
    clienteId: '',
    categoriaId: '',
    contactChannel: '' as Channel | '',
    notificationChannel: '' as Channel | '',
    subject: '',
    description: '',
    clientName: '',
    contactName: '',
    phone: '',
    email: '',
  });

  const navigate = useNavigate();

  useEffect(() => {
    loadClientes();
    loadCategorias();
    // Guardar hora de actualización para mostrar en el header
    const updateTime = new Date();
    localStorage.setItem('bandeja_last_update', updateTime.toISOString());
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showClienteDropdown && !target.closest('.cliente-selector-container')) {
        setShowClienteDropdown(false);
      }
    };

    if (showClienteDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showClienteDropdown]);

  const loadClientes = async () => {
    const data = await api.getClientes();
    setClientes(data);
  };

  const loadCategorias = async () => {
    const data = await api.getCategorias();
    setCategorias(data);
  };

  // Filtrar clientes según el término de búsqueda
  const filteredClientes = useMemo(() => {
    if (!clienteSearchTerm.trim()) {
      return clientes.slice(0, 50);
    }
    const term = clienteSearchTerm.toLowerCase();
    return clientes.filter(cliente => 
      cliente.idCliente.toLowerCase().includes(term) ||
      cliente.nombreEmpresa.toLowerCase().includes(term) ||
      cliente.contactoPrincipal.toLowerCase().includes(term) ||
      cliente.email.toLowerCase().includes(term) ||
      cliente.telefono.includes(term)
    );
  }, [clientes, clienteSearchTerm]);

  const handleClienteSelect = async (cliente: Cliente) => {
    setNewCase({
      ...newCase,
      clienteId: cliente.idCliente,
      clientName: cliente.nombreEmpresa,
      contactName: cliente.contactoPrincipal,
      phone: cliente.telefono,
      email: cliente.email,
    });
    setClienteSearchTerm(`${cliente.idCliente} - ${cliente.nombreEmpresa}`);
    setShowClienteDropdown(false);
  };

  const handleClienteClear = () => {
    setNewCase({
      ...newCase,
      clienteId: '',
      clientName: '',
      contactName: '',
      phone: '',
      email: '',
      contactChannel: '' as Channel | '',
      notificationChannel: '' as Channel | '',
    });
    setClienteSearchTerm('');
    setShowClienteDropdown(false);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!newCase.clientName || !newCase.email || !newCase.subject || !newCase.description || !newCase.categoriaId || !newCase.contactChannel || !newCase.notificationChannel) {
      setToast({ message: 'Por favor, completa todos los campos requeridos (marcados con *)', type: 'warning' });
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newCase.email)) {
      setToast({ message: 'Por favor, ingresa un email válido', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const casePayload = {
        clienteId: newCase.clienteId,
        categoriaId: newCase.categoriaId,
        contactChannel: newCase.contactChannel,
        notificationChannel: newCase.notificationChannel,
        subject: newCase.subject,
        description: newCase.description,
        clientName: newCase.clientName,
        contactName: newCase.contactName,
        phone: newCase.phone,
        clientEmail: newCase.email,
        status: CaseStatus.NUEVO,
        createdAt: new Date().toISOString(),
      };

      console.log('📝 ========== INICIANDO CREACIÓN DE CASO ==========');
      console.log('📋 Datos del formulario:', casePayload);
      console.log('👤 Usuario actual:', api.getUser());

      const result = await api.createCase(casePayload);

      if (result) {
        console.log('✅ ========== CASO CREADO EXITOSAMENTE ==========');
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          navigate('/app/casos');
        }, 2000);
      } else {
        console.error('❌ Error: api.createCase retornó false');
        setToast({ message: 'Error al crear el caso. Por favor, intenta nuevamente.', type: 'error' });
      }
    } catch (err: any) {
      console.error('❌ ========== ERROR AL CREAR CASO ==========');
      console.error('Error completo:', err);
      console.error('Mensaje:', err.message);
      console.error('Stack:', err.stack);
      setToast({ message: err.message || 'Error al crear el caso. Por favor, intenta nuevamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/casos')}
            className="flex items-center gap-2 mb-3 transition-colors font-medium"
            style={{color: '#64748b'}}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Bandeja de Casos
          </button>
        </div>

        {/* Formulario */}
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <form onSubmit={handleCreateCase} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda */}
              <div className="space-y-5">
                <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: '#1e293b', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                  Información del Cliente
                </h2>

                <div className="relative cliente-selector-container">
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{color: '#94a3b8'}} />
                    <input
                      type="text"
                      required
                      value={clienteSearchTerm}
                      onChange={(e) => {
                        setClienteSearchTerm(e.target.value);
                        setShowClienteDropdown(true);
                        if (!e.target.value) {
                          handleClienteClear();
                        }
                      }}
                      onFocus={(e) => {
                        setShowClienteDropdown(true);
                        e.target.style.borderColor = 'var(--color-accent-blue)';
                        e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                        e.target.style.backgroundColor = '#ffffff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                        e.target.style.boxShadow = '';
                        e.target.style.backgroundColor = '#f8fafc';
                      }}
                      placeholder="Buscar cliente por ID, nombre, email o teléfono..."
                      className="w-full pl-11 pr-9 py-3 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        backgroundColor: '#f8fafc',
                        borderColor: 'rgba(148, 163, 184, 0.3)',
                        color: '#1e293b',
                        '--tw-ring-color': 'var(--color-accent-blue)',
                        '--tw-ring-opacity': '0.2'
                      } as React.CSSProperties & { '--tw-ring-color': string, '--tw-ring-opacity': string }}
                    />
                    {newCase.clienteId && (
                      <button
                        type="button"
                        onClick={handleClienteClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{color: '#64748b'}}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#475569';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#94a3b8';
                        }}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de resultados */}
                  {showClienteDropdown && filteredClientes.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 border" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                      <div className="p-2 border-b sticky top-0" style={{backgroundColor: '#f8fafc', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                        <p className="text-xs font-semibold" style={{color: '#475569'}}>
                          {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                        </p>
                      </div>
                      {filteredClientes.map((cliente) => (
                        <div
                          key={cliente.idCliente}
                          onClick={() => handleClienteSelect(cliente)}
                          className="p-4 cursor-pointer border-b last:border-b-0 transition-all group"
                          style={{
                            borderColor: 'rgba(148, 163, 184, 0.1)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl transition-all shadow-sm" style={{backgroundColor: '#f1f5f9'}}>
                              <Building2 className="w-5 h-5" style={{color: '#475569'}} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold transition-colors" style={{color: '#1e293b'}}>
                                  {cliente.nombreEmpresa}
                                </span>
                                <span className="text-xs font-bold px-2 py-1 rounded-md shadow-sm" style={{backgroundColor: '#e2e8f0', color: '#475569'}}>
                                  {cliente.idCliente}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showClienteDropdown && clienteSearchTerm && filteredClientes.length === 0 && (
                    <div className="absolute z-30 w-full mt-2 rounded-xl shadow-2xl p-8 text-center animate-in fade-in slide-in-from-top-2 duration-200 border" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                      <div className="mb-3" style={{color: '#64748b'}}>
                        <Search className="w-12 h-12 mx-auto" />
                      </div>
                      <p className="text-sm font-bold mb-1" style={{color: '#1e293b'}}>No se encontraron clientes</p>
                      <p className="text-xs" style={{color: '#94a3b8'}}>Intenta buscar por ID, nombre de empresa, contacto, email o teléfono</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Empresa / Cliente</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: '#1e293b'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                    placeholder="Nombre de la empresa"
                    value={newCase.clientName}
                    onChange={e => setNewCase({...newCase, clientName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Contacto Principal</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        backgroundColor: '#f8fafc',
                        borderColor: 'rgba(148, 163, 184, 0.3)',
                        color: '#1e293b'
                      }}
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
                      placeholder="Nombre contacto"
                      value={newCase.contactName}
                      onChange={e => setNewCase({...newCase, contactName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Teléfono</label>
                    <input 
                      type="tel"
                      className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        backgroundColor: '#f8fafc',
                        borderColor: 'rgba(148, 163, 184, 0.3)',
                        color: '#1e293b'
                      }}
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
                      placeholder="+50370000000"
                      value={newCase.phone}
                      onChange={e => setNewCase({...newCase, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Email Cliente <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    required 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: '#1e293b'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                    placeholder="cliente@empresa.com"
                    value={newCase.email}
                    onChange={e => setNewCase({...newCase, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Medio de Contacto (Primer Contacto) <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.contactChannel}
                    onChange={(e) => setNewCase({...newCase, contactChannel: e.target.value as Channel})}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: newCase.contactChannel ? '#475569' : '#94a3b8'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                  >
                    <option value="" disabled>Seleccionar una opción</option>
                    <option value={Channel.WEB}>Web</option>
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.TELEFONO}>Teléfono</option>
                    <option value={Channel.REDES_SOCIALES}>Redes Sociales</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Canal de Notificación (Contacto Posterior) <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.notificationChannel}
                    onChange={(e) => setNewCase({...newCase, notificationChannel: e.target.value as Channel})}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: newCase.notificationChannel ? '#475569' : '#94a3b8'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                  >
                    <option value="" disabled>Seleccionar una opción</option>
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.TELEFONO}>Teléfono</option>
                    <option value={Channel.WEB}>Web</option>
                    <option value={Channel.REDES_SOCIALES}>Redes Sociales</option>
                  </select>
                </div>
              </div>

              {/* Columna Derecha */}
              <div className="space-y-5">
                <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: '#1e293b', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                  Detalles del Caso
                </h2>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>Categoría <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.categoriaId}
                    onChange={(e) => setNewCase({...newCase, categoriaId: e.target.value})}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: '#475569'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                  >
                    <option value="">Seleccione una categoría...</option>
                    {categorias.length > 0 ? (
                      categorias.map((categoria) => (
                        <option key={categoria.idCategoria} value={categoria.idCategoria}>
                          {categoria.nombre} — SLA {categoria.slaDias} días
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>Cargando categorías...</option>
                    )}
                  </select>
                  {categorias.length === 0 && (
                    <p className="text-xs mt-1" style={{color: '#64748b'}}>Cargando categorías...</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{color: '#475569'}}>Asunto <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: '#1e293b'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                    placeholder="Resumen del caso"
                    value={newCase.subject}
                    onChange={e => setNewCase({...newCase, subject: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{color: '#475569'}}>Descripción <span className="text-red-500">*</span></label>
                  <textarea 
                    required 
                    rows={12}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs resize-none shadow-sm hover:shadow-md"
                    style={{
                      backgroundColor: '#f8fafc',
                      borderColor: 'rgba(148, 163, 184, 0.3)',
                      color: '#1e293b'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = '#f8fafc';
                    }}
                    placeholder="Detalles completos del caso..."
                    value={newCase.description}
                    onChange={e => setNewCase({...newCase, description: e.target.value})}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-5 pt-4 border-t flex gap-3" style={{borderColor: 'rgba(148, 163, 184, 0.2)'}}>
              <button 
                type="button" 
                onClick={() => navigate('/app/casos')}
                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all border-2 shadow-sm hover:shadow-md"
                style={{
                  color: '#475569',
                  borderColor: 'rgba(148, 163, 184, 0.4)',
                  backgroundColor: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-2 text-xs font-bold rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(200, 21, 27, 0.25)'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-accent-red), var(--color-brand-red))';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(200, 21, 27, 0.35)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(200, 21, 27, 0.25)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {loading ? 'Registrando...' : 'Registrar Caso'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification para errores */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Animación de éxito a pantalla completa */}
      {showSuccessAnimation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div 
            className="flex flex-col items-center justify-center"
            style={{
              animation: 'scaleInBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }}
          >
            {/* Icono de check animado */}
            <div
              className="relative mb-6"
              style={{
                animation: 'checkMark 0.5s ease-out 0.3s both'
              }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
                  boxShadow: '0 20px 60px rgba(200, 21, 27, 0.4)'
                }}
              >
                <CheckCircle2 
                  className="w-14 h-14 text-white" 
                  style={{
                    strokeWidth: 2.5
                  }}
                />
              </div>
              {/* Anillo de expansión */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '3px solid var(--color-brand-red)',
                  animation: 'ringExpand 0.8s ease-out 0.2s',
                  opacity: 0
                }}
              />
            </div>
            
            {/* Mensaje */}
            <h2
              className="text-2xl font-bold mb-2"
              style={{
                color: '#ffffff',
                animation: 'fadeInUp 0.5s ease-out 0.4s both'
              }}
            >
              ¡Caso creado exitosamente!
            </h2>
            <p
              className="text-base"
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                animation: 'fadeInUp 0.5s ease-out 0.5s both'
              }}
            >
              Redirigiendo a la bandeja de casos...
            </p>
          </div>
        </div>
      )}

      {/* Estilos de animación inline */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleInBounce {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes checkMark {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        @keyframes ringExpand {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default NuevoCaso;

