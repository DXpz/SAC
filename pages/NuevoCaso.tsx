import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CaseStatus, Cliente, Categoria, Channel } from '../types';
import { Search, X, Building2, ArrowLeft, CheckCircle2, HelpCircle, ChevronDown } from 'lucide-react';
import Toast, { ToastType } from '../components/Toast';
import { useTheme } from '../contexts/ThemeContext';

const NuevoCaso: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  
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
    const initializeData = async () => {
      await loadClientes();
      await loadCategorias();
      // Guardar hora de actualización para mostrar en el header
      const updateTime = new Date();
      localStorage.setItem('bandeja_last_update', updateTime.toISOString());
    };
    initializeData();
  }, []);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showClienteDropdown && !target.closest('.cliente-selector-container')) {
        setShowClienteDropdown(false);
      }
      if (showCategoriaDropdown && !target.closest('.categoria-selector-container')) {
        setShowCategoriaDropdown(false);
      }
    };

    if (showClienteDropdown || showCategoriaDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showClienteDropdown, showCategoriaDropdown]);

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
    // Solo autocompletar empresa/cliente, NO los datos de contacto
    setNewCase({
      ...newCase,
      clienteId: cliente.idCliente,
      clientName: cliente.nombreEmpresa,
      // Dejar vacíos para que el usuario los ingrese manualmente
      contactName: '',
      phone: '',
      email: '',
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

  const handleCategoriaSelect = (categoria: Categoria) => {
    setNewCase({
      ...newCase,
      categoriaId: categoria.idCategoria,
    });
    setShowCategoriaDropdown(false);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas - Solo campos de "Detalles del Caso" son obligatorios
    if (!newCase.subject || !newCase.description || !newCase.categoriaId) {
      setToast({ message: 'Por favor, completa todos los campos requeridos de Detalles del Caso (marcados con *)', type: 'warning' });
      return;
    }

    // Validar formato de email solo si se proporcionó
    if (newCase.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCase.email)) {
        setToast({ message: 'Por favor, ingresa un email válido', type: 'warning' });
        return;
      }
    }

    setLoading(true);
    try {
      // Obtener usuario actual
      const currentUser = api.getUser();
      
      const casePayload: any = {
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
        createdAt: new Date().toISOString()
      };

      // Si el usuario es AGENTE, agregar su email al payload (el backend procesa el correo para asignar)
      const agentEmail = (currentUser as any)?.email;
      if (currentUser?.role === 'AGENTE' && agentEmail) {
        casePayload.agentEmail = agentEmail;
        casePayload.agenteEmail = agentEmail;
      }


      const result = await api.createCase(casePayload);

      if (result) {
        
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          navigate('/app/casos');
        }, 2000);
      } else {
        setToast({ message: 'Error al crear el caso. Por favor, intenta nuevamente.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error al crear el caso. Por favor, intenta nuevamente.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Estilos dinámicos basados en el tema
  const styles = {
    container: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
      minHeight: '100vh'
    },
    card: {
      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    },
    input: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  return (
    <div style={styles.container}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/casos')}
            className="flex items-center gap-2 mb-3 transition-colors font-medium"
            style={{color: styles.text.tertiary}}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = styles.text.secondary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = styles.text.tertiary;
            }}
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Bandeja de Casos
          </button>
        </div>

        {/* Formulario */}
        <div className="rounded-3xl shadow-xl border overflow-hidden" style={{...styles.card, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
          <form onSubmit={handleCreateCase} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Columna Izquierda */}
              <div className="space-y-5">
                <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                  Información del Cliente
                </h2>

                <div className="relative cliente-selector-container">
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>
                    Cliente
                  </label>
                  <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{color: styles.text.tertiary}} />
                    <input
                      type="text"
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
                        e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = styles.input.borderColor;
                        e.target.style.boxShadow = '';
                        e.target.style.backgroundColor = styles.input.backgroundColor;
                      }}
                      placeholder="Buscar cliente por ID, nombre, email o teléfono..."
                      className="w-full pl-11 pr-9 py-3 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        ...styles.input,
                        '--tw-ring-color': 'var(--color-accent-blue)',
                        '--tw-ring-opacity': '0.2'
                      } as React.CSSProperties & { '--tw-ring-color': string, '--tw-ring-opacity': string }}
                    />
                    {newCase.clienteId && (
                      <button
                        type="button"
                        onClick={handleClienteClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{color: styles.text.tertiary}}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = styles.text.secondary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = styles.text.tertiary;
                        }}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de resultados */}
                  {showClienteDropdown && filteredClientes.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 border" style={{...styles.card}}>
                      <div className="p-2 border-b sticky top-0" style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                        borderColor: 'rgba(148, 163, 184, 0.2)'
                      }}>
                        <p className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                          {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                        </p>
                      </div>
                      {filteredClientes.map((cliente) => (
                        <div
                          key={cliente.idCliente}
                          onClick={() => handleClienteSelect(cliente)}
                          className="p-4 cursor-pointer border-b last:border-b-0 transition-all group"
                          style={{
                            borderColor: 'rgba(184, 148, 153, 0.1)',
                            backgroundColor: 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(248, 250, 252, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl transition-all shadow-sm" style={{
                              backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9'
                            }}>
                              <Building2 className="w-5 h-5" style={{color: styles.text.secondary}} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold transition-colors" style={{color: styles.text.primary}}>
                                  {cliente.nombreEmpresa}
                                </span>
                                <span className="text-xs font-bold px-2 py-1 rounded-md shadow-sm" style={{
                                  backgroundColor: theme === 'dark' ? '#0f172a' : '#e2e8f0',
                                  color: styles.text.secondary
                                }}>
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
                    <div className="absolute z-30 w-full mt-2 rounded-xl shadow-2xl p-8 text-center animate-in fade-in slide-in-from-top-2 duration-200 border" style={{...styles.card}}>
                      <div className="mb-3" style={{color: styles.text.tertiary}}>
                        <Search className="w-12 h-12 mx-auto" />
                      </div>
                      <p className="text-sm font-bold mb-1" style={{color: styles.text.primary}}>No se encontraron clientes</p>
                      <p className="text-xs" style={{color: styles.text.tertiary}}>Intenta buscar por ID, nombre de empresa, contacto, email o teléfono</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Empresa / Cliente</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = styles.input.borderColor;
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = styles.input.backgroundColor;
                    }}
                    placeholder="Nombre de la empresa"
                    value={newCase.clientName}
                    onChange={e => setNewCase({...newCase, clientName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Contacto Principal</label>
                    <input 
                      type="text"
                      className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        ...styles.input
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--color-accent-blue)';
                        e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                        e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = styles.input.borderColor;
                        e.target.style.boxShadow = '';
                        e.target.style.backgroundColor = styles.input.backgroundColor;
                      }}
                      placeholder="Nombre contacto"
                      value={newCase.contactName}
                      onChange={e => setNewCase({...newCase, contactName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Teléfono</label>
                    <input 
                      type="tel"
                      className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                      style={{
                        ...styles.input
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--color-accent-blue)';
                        e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                        e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = styles.input.borderColor;
                        e.target.style.boxShadow = '';
                        e.target.style.backgroundColor = styles.input.backgroundColor;
                      }}
                      placeholder="+50370000000"
                      value={newCase.phone}
                      onChange={e => setNewCase({...newCase, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Email Cliente</label>
                  <input 
                    type="email" 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = styles.input.borderColor;
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = styles.input.backgroundColor;
                    }}
                    placeholder="cliente@empresa.com"
                    value={newCase.email}
                    onChange={e => setNewCase({...newCase, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Medio de Contacto (Primer Contacto)</label>
                  <select
                    value={newCase.contactChannel}
                    onChange={(e) => setNewCase({...newCase, contactChannel: e.target.value as Channel})}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input,
                      color: newCase.contactChannel ? styles.text.secondary : styles.text.tertiary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
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
                  <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: styles.text.secondary}}>Canal de Notificación (Contacto Posterior)</label>
                  <select
                    value={newCase.notificationChannel}
                    onChange={(e) => setNewCase({...newCase, notificationChannel: e.target.value as Channel})}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input,
                      color: newCase.notificationChannel ? styles.text.secondary : styles.text.tertiary
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
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
                <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)'}}>
                  Detalles del Caso
                </h2>

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="block text-xs font-semibold tracking-normal" style={{color: styles.text.secondary}}>Categoría <span className="text-red-500">*</span></label>
                    {newCase.categoriaId && (() => {
                      const categoriaSeleccionada = categorias.find(c => c.idCategoria === newCase.categoriaId);
                      return categoriaSeleccionada && (categoriaSeleccionada.descripcion || (categoriaSeleccionada as any).description) ? (
                        <div className="relative group">
                          <HelpCircle 
                            className="w-3.5 h-3.5 cursor-help transition-colors flex-shrink-0" 
                            style={{ color: styles.text.tertiary }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = styles.text.tertiary;
                            }}
                          />
                          <div 
                            className="absolute left-full ml-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-normal opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                              color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                              boxShadow: theme === 'dark' 
                                ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                                : '0 4px 12px rgba(0, 0, 0, 0.3)',
                              width: 'max-content',
                              maxWidth: '300px',
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}
                          >
                              {categoriaSeleccionada.descripcion || (categoriaSeleccionada as any).description || 'Sin descripción disponible'}
                            <div 
                              className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0"
                              style={{
                                borderTop: '4px solid transparent',
                                borderBottom: '4px solid transparent',
                                borderRight: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                              }}
                            />
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="relative categoria-selector-container">
                    <button
                      type="button"
                      onClick={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
                      className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs appearance-none cursor-pointer shadow-sm hover:shadow-md text-left flex items-center justify-between"
                      style={{
                        ...styles.input
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = styles.input.backgroundColor;
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--color-accent-blue)';
                        e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                        e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = styles.input.borderColor;
                        e.target.style.boxShadow = '';
                        e.target.style.backgroundColor = styles.input.backgroundColor;
                      }}
                    >
                      <span style={{ color: newCase.categoriaId ? styles.text.primary : styles.text.tertiary }}>
                        {newCase.categoriaId 
                          ? (() => {
                              const categoriaSeleccionada = categorias.find(c => c.idCategoria === newCase.categoriaId);
                              return categoriaSeleccionada 
                                ? `${categoriaSeleccionada.nombre} — SLA ${categoriaSeleccionada.slaDias} días`
                                : 'Seleccione una categoría...';
                            })()
                          : 'Seleccione una categoría...'
                        }
                      </span>
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform ${showCategoriaDropdown ? 'rotate-180' : ''}`}
                        style={{ color: styles.text.tertiary }}
                      />
                    </button>
                    {showCategoriaDropdown && categorias.length > 0 && (
                      <div className="absolute z-30 w-full mt-2 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 border" style={{...styles.card}}>
                        <div className="p-2 border-b sticky top-0" style={{
                          backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                          borderColor: 'rgba(148, 163, 184, 0.2)'
                        }}>
                          <p className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                            {categorias.length} {categorias.length === 1 ? 'categoría disponible' : 'categorías disponibles'}
                          </p>
                        </div>
                        {categorias.map((categoria) => {
                          const isSelected = newCase.categoriaId === categoria.idCategoria;
                          const descripcion = categoria.descripcion || (categoria as any).description || categoria.nombre || 'Sin descripción disponible';
                          return (
                            <div
                              key={categoria.idCategoria}
                              onClick={() => handleCategoriaSelect(categoria)}
                              className="p-4 cursor-pointer border-b last:border-b-0 transition-all group relative"
                              style={{
                                borderColor: 'rgba(184, 148, 153, 0.1)',
                                backgroundColor: isSelected 
                                  ? (theme === 'dark' ? 'rgba(16, 122, 180, 0.2)' : 'rgba(16, 122, 180, 0.1)')
                                  : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(248, 250, 252, 0.1)' : 'rgba(248, 250, 252, 0.5)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="text-sm font-medium mb-0.5" style={{color: styles.text.primary}}>
                                    {categoria.nombre}
                                  </div>
                                  <div className="text-xs" style={{color: styles.text.secondary}}>
                                    SLA {categoria.slaDias} días
                                  </div>
                                </div>
                                <div className="relative group/tooltip flex-shrink-0">
                                  <HelpCircle 
                                    className="w-4 h-4 cursor-help transition-colors" 
                                    style={{ 
                                      color: theme === 'dark' ? '#cbd5e1' : '#475569'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = theme === 'dark' ? '#f1f5f9' : '#0f172a';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = theme === 'dark' ? '#cbd5e1' : '#475569';
                                    }}
                                  />
                                  <div 
                                    className="absolute right-full mr-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-normal opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-[100] pointer-events-none"
                                    style={{
                                      backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                                      color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                                      border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                                      boxShadow: theme === 'dark' 
                                        ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                                        : '0 4px 12px rgba(0, 0, 0, 0.3)',
                                      width: 'max-content',
                                      maxWidth: '300px',
                                      top: '50%',
                                      transform: 'translateY(-50%)'
                                    }}
                                  >
                                    {descripcion}
                                    <div 
                                      className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0"
                                      style={{
                                        borderTop: '4px solid transparent',
                                        borderBottom: '4px solid transparent',
                                        borderLeft: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {categorias.length === 0 && (
                      <p className="text-xs mt-1" style={{color: styles.text.tertiary}}>Cargando categorías...</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{color: styles.text.secondary}}>Asunto <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = styles.input.borderColor;
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = styles.input.backgroundColor;
                    }}
                    placeholder="Resumen del caso"
                    value={newCase.subject}
                    onChange={e => setNewCase({...newCase, subject: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{color: styles.text.secondary}}>Descripción <span className="text-red-500">*</span></label>
                  <textarea 
                    required 
                    rows={12}
                    className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs resize-none shadow-sm hover:shadow-md"
                    style={{
                      ...styles.input
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-accent-blue)';
                      e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.15)';
                      e.target.style.backgroundColor = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = styles.input.borderColor;
                      e.target.style.boxShadow = '';
                      e.target.style.backgroundColor = styles.input.backgroundColor;
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
                  color: styles.text.secondary,
                  borderColor: 'rgba(148, 163, 184, 0.4)',
                  backgroundColor: styles.card.backgroundColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.6)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = styles.card.backgroundColor;
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

