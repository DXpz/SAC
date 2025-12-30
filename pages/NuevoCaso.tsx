import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { CaseStatus, Cliente, Categoria, Channel } from '../types';
import { Search, X, Building2, User, Phone, Mail, ArrowLeft } from 'lucide-react';
import Toast, { ToastType } from '../components/Toast';

const NuevoCaso: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [newCase, setNewCase] = useState({
    clienteId: '',
    categoriaId: '',
    contactChannel: Channel.WEB,
    notificationChannel: Channel.EMAIL,
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
      contactChannel: Channel.WEB,
      notificationChannel: Channel.EMAIL,
    });
    setClienteSearchTerm('');
    setShowClienteDropdown(false);
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!newCase.clientName || !newCase.email || !newCase.subject || !newCase.description || !newCase.categoriaId) {
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
        setToast({ message: 'Caso creado exitosamente', type: 'success' });
        setTimeout(() => {
          navigate('/app/casos');
        }, 1500);
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/casos')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver a Bandeja de Casos
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Crear Nuevo Caso SAC</h1>
          <p className="text-slate-600">Completa todos los campos requeridos para registrar un nuevo caso</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200/50 overflow-hidden">
          <form onSubmit={handleCreateCase} className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Columna Izquierda */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                  Información del Cliente
                </h2>

                <div className="relative cliente-selector-container">
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">
                    Cliente <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
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
                      onFocus={() => setShowClienteDropdown(true)}
                      placeholder="Buscar cliente por ID, nombre, email o teléfono..."
                      className="w-full pl-12 pr-10 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                    />
                    {newCase.clienteId && (
                      <button
                        type="button"
                        onClick={handleClienteClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de resultados */}
                  {showClienteDropdown && filteredClientes.length > 0 && (
                    <div className="absolute z-30 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-2 bg-slate-50 border-b border-slate-200 sticky top-0">
                        <p className="text-xs font-semibold text-slate-600">
                          {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                        </p>
                      </div>
                      {filteredClientes.map((cliente) => (
                        <div
                          key={cliente.idCliente}
                          onClick={() => handleClienteSelect(cliente)}
                          className="p-4 hover:bg-gradient-to-r hover:from-slate-50 hover:to-white cursor-pointer border-b border-slate-100 last:border-b-0 transition-all group"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl group-hover:from-slate-200 group-hover:to-slate-100 transition-all shadow-sm">
                              <Building2 className="w-5 h-5 text-slate-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
                                  {cliente.nombreEmpresa}
                                </span>
                                <span className="text-xs font-bold text-white bg-slate-600 px-2 py-1 rounded-md shadow-sm">
                                  {cliente.idCliente}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <User className="w-4 h-4 text-slate-400" />
                                  <span className="font-medium">{cliente.contactoPrincipal}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <Mail className="w-4 h-4 text-slate-400" />
                                  <span className="truncate font-medium">{cliente.email}</span>
                                </div>
                                {cliente.telefono && (
                                  <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Phone className="w-4 h-4 text-slate-400" />
                                    <span className="font-medium">{cliente.telefono}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {showClienteDropdown && clienteSearchTerm && filteredClientes.length === 0 && (
                    <div className="absolute z-30 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl p-8 text-center animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="text-slate-300 mb-3">
                        <Search className="w-12 h-12 mx-auto" />
                      </div>
                      <p className="text-sm font-bold text-slate-700 mb-1">No se encontraron clientes</p>
                      <p className="text-xs text-slate-500">Intenta buscar por ID, nombre de empresa, contacto, email o teléfono</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Empresa / Cliente</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                    placeholder="Nombre de la empresa"
                    value={newCase.clientName}
                    onChange={e => setNewCase({...newCase, clientName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Contacto Principal</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                      placeholder="Nombre contacto"
                      value={newCase.contactName}
                      onChange={e => setNewCase({...newCase, contactName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Teléfono</label>
                    <input 
                      type="tel"
                      className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                      placeholder="+50370000000"
                      value={newCase.phone}
                      onChange={e => setNewCase({...newCase, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Email Cliente <span className="text-red-500">*</span></label>
                  <input 
                    type="email" 
                    required 
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                    placeholder="cliente@empresa.com"
                    value={newCase.email}
                    onChange={e => setNewCase({...newCase, email: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Medio de Contacto (Primer Contacto) <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.contactChannel}
                    onChange={(e) => setNewCase({...newCase, contactChannel: e.target.value as Channel})}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm appearance-none cursor-pointer"
                  >
                    <option value={Channel.WEB}>Web</option>
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.TELEFONO}>Teléfono</option>
                    <option value={Channel.REDES_SOCIALES}>Redes Sociales</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Canal de Notificación (Contacto Posterior) <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.notificationChannel}
                    onChange={(e) => setNewCase({...newCase, notificationChannel: e.target.value as Channel})}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm appearance-none cursor-pointer"
                  >
                    <option value={Channel.EMAIL}>Email</option>
                    <option value={Channel.WHATSAPP}>WhatsApp</option>
                    <option value={Channel.TELEFONO}>Teléfono</option>
                    <option value={Channel.WEB}>Web</option>
                    <option value={Channel.REDES_SOCIALES}>Redes Sociales</option>
                  </select>
                </div>
              </div>

              {/* Columna Derecha */}
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                  Detalles del Caso
                </h2>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 tracking-normal mb-2">Categoría <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={newCase.categoriaId}
                    onChange={(e) => setNewCase({...newCase, categoriaId: e.target.value})}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm appearance-none cursor-pointer"
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
                    <p className="text-xs text-slate-400 mt-1">Cargando categorías...</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Asunto <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm"
                    placeholder="Resumen del caso"
                    value={newCase.subject}
                    onChange={e => setNewCase({...newCase, subject: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Descripción <span className="text-red-500">*</span></label>
                  <textarea 
                    required 
                    rows={12}
                    className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 transition-all bg-slate-50 focus:bg-white font-medium text-sm resize-none"
                    placeholder="Detalles completos del caso..."
                    value={newCase.description}
                    onChange={e => setNewCase({...newCase, description: e.target.value})}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-8 pt-6 border-t border-slate-200 flex gap-4">
              <button 
                type="button" 
                onClick={() => navigate('/app/casos')}
                className="flex-1 py-4 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all border-2 border-slate-200"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Registrando...' : 'Registrar Caso'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default NuevoCaso;

