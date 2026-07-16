import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sapService, ClienteListado } from '../services/sapService';
import { Channel } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { API_CONFIG } from '../config';
import { CheckCircle2, AlertTriangle, Search, X, Building2, Loader2 } from 'lucide-react';

type Pais = 'SV' | 'GT';

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const NuevoCasoPublico: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [pais, setPais] = useState<Pais | ''>('');
  const [clientes, setClientes] = useState<ClienteListado[]>([]);
  const [categorias, setCategorias] = useState<Array<{ id: number; nombre: string }>>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [loadingCategorias, setLoadingCategorias] = useState(false);

  const [form, setForm] = useState({
    clienteId: '',
    clienteNombre: '',
    categoriaId: '',
    descripcion: '',
    contactoPrincipal: '',
    telefono: '',
    email: '',
    emailNotificacion: '',
    canalContacto: '' as Channel | ''
  });

  const [clienteSearchTerm, setClienteSearchTerm] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const debouncedSearchTerm = useDebounce(clienteSearchTerm, 300);

  const [submitting, setSubmitting] = useState(false);
  const [successCase, setSuccessCase] = useState<{ case_id: string; agente: string | null } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const clienteDropdownRef = useRef<HTMLDivElement>(null);

  // Cargar clientes cuando cambia el país o el término de búsqueda
  useEffect(() => {
    if (!pais) {
      setClientes([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingClientes(true);
      try {
        const list = await sapService.getClientesListado(pais);
        if (!cancelled) setClientes(list);
      } catch (e) {
        console.error('Error cargando clientes:', e);
        if (!cancelled) setClientes([]);
      } finally {
        if (!cancelled) setLoadingClientes(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pais]);

  // Cargar categorías cuando cambia el país
  useEffect(() => {
    if (!pais) {
      setCategorias([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingCategorias(true);
      try {
        const url = `${API_CONFIG.WEBHOOK_URL}/api/categorias?pais=${pais}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : (data.data || data.categorias || []);
          setCategorias(list.map((c: any) => ({
            id: Number(c.id ?? c.idCategoria ?? c.categoria_id),
            nombre: String(c.nombre ?? c.categoria ?? c.name ?? 'Sin nombre')
          })));
        }
      } catch (e) {
        console.error('Error cargando categorías:', e);
        if (!cancelled) setCategorias([]);
      } finally {
        if (!cancelled) setLoadingCategorias(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [pais]);

  // Filtrar clientes según búsqueda
  const clientesFiltrados = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return clientes.slice(0, 50);
    const term = debouncedSearchTerm.toLowerCase();
    return clientes.filter(c =>
      String(c.CardCode).toLowerCase().includes(term) ||
      String(c.CardName).toLowerCase().includes(term) ||
      (c.Phone1 || '').toLowerCase().includes(term) ||
      (c.E_Mail || '').toLowerCase().includes(term)
    ).slice(0, 50);
  }, [clientes, debouncedSearchTerm]);

  // Click fuera del dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node)) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset al cambiar país
  useEffect(() => {
    setForm(f => ({
      ...f,
      clienteId: '',
      clienteNombre: '',
      categoriaId: ''
    }));
    setClienteSearchTerm('');
  }, [pais]);

  const handleClienteSelect = (c: ClienteListado) => {
    setForm(f => ({
      ...f,
      clienteId: c.CardCode,
      clienteNombre: c.CardName
    }));
    setClienteSearchTerm(c.CardName);
    setShowClienteDropdown(false);
  };

  const handleClienteClear = () => {
    setForm(f => ({ ...f, clienteId: '', clienteNombre: '' }));
    setClienteSearchTerm('');
  };

  const validar = (): string[] => {
    const errs: string[] = [];
    if (!pais) errs.push('Selecciona el país');
    if (!form.clienteId) errs.push('Selecciona un cliente');
    if (!form.categoriaId) errs.push('Selecciona una categoría');
    if (!form.descripcion.trim() || form.descripcion.trim().length < 10) errs.push('La descripción debe tener al menos 10 caracteres');
    if (!form.contactoPrincipal.trim()) errs.push('Ingresa el contacto principal');
    if (!form.telefono.trim()) errs.push('Ingresa un teléfono');
    if (!form.email.trim()) errs.push('Ingresa un email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.push('El email no es válido');
    if (form.emailNotificacion.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.emailNotificacion.trim())) {
      errs.push('El email de notificaciones no es válido');
    }
    if (!form.canalContacto) errs.push('Selecciona el medio de contacto y notificación');
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors([]);

    const errs = validar();
    if (errs.length > 0) {
      setValidationErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pais,
        cliente_id: form.clienteId,
        categoria_id: parseInt(form.categoriaId, 10),
        descripcion: form.descripcion.trim(),
        contacto_principal: form.contactoPrincipal.trim(),
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        email_notificacion: form.emailNotificacion.trim() || undefined,
        canal_contacto: form.canalContacto
      };

      const url = `${API_CONFIG.WEBHOOK_URL}/api/public/casos`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (Array.isArray(data.errors) && data.errors.length > 0) {
          setValidationErrors(data.errors);
        } else {
          setErrorMessage(data.message || 'Error al crear el caso');
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setSuccessCase({ case_id: data.case_id, agente: data.agente?.nombre || null });
    } catch (err: any) {
      console.error('Error creando caso público:', err);
      setErrorMessage(err?.message || 'Error de conexión. Por favor intenta nuevamente.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNuevo = () => {
    setSuccessCase(null);
    setPais('');
    setForm({
      clienteId: '',
      clienteNombre: '',
      categoriaId: '',
      descripcion: '',
      contactoPrincipal: '',
      telefono: '',
      email: '',
      emailNotificacion: '',
      canalContacto: ''
    });
    setClienteSearchTerm('');
    setValidationErrors([]);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ================================
  // ESTILOS
  // ================================
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
    },
    input: {
      backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.2)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  const inputBaseClass = "w-full px-4 py-3 border rounded-xl outline-none transition-all font-medium text-sm shadow-sm hover:shadow-md";

  // ================================
  // PANTALLA DE ÉXITO
  // ================================
  if (successCase) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div
          className="rounded-3xl shadow-2xl border p-8 text-center"
          style={{ ...styles.card, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        >
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}
          >
            <CheckCircle2 className="w-12 h-12" style={{ color: '#22c55e' }} />
          </div>
          <h2 className="text-3xl font-black mb-3" style={{ color: styles.text.primary }}>
            ¡Caso creado exitosamente!
          </h2>
          <p className="text-sm mb-6" style={{ color: styles.text.secondary }}>
            Tu solicitud ha sido registrada. Un agente se pondrá en contacto contigo pronto.
          </p>

          <div
            className="rounded-2xl p-6 mb-6 border-2"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(16, 122, 180, 0.1)' : 'rgba(16, 122, 180, 0.05)',
              borderColor: 'rgba(16, 122, 180, 0.3)'
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: styles.text.tertiary }}>
              Número de caso
            </p>
            <p className="text-4xl font-black tracking-tight" style={{ color: '#107ab4' }}>
              {successCase.case_id}
            </p>
            {successCase.agente && (
              <p className="text-sm mt-3" style={{ color: styles.text.secondary }}>
                Asignado a: <span className="font-semibold">{successCase.agente}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleNuevo}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: '#107ab4',
                color: '#ffffff'
              }}
            >
              Crear otro caso
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-xl font-semibold text-sm border transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: 'transparent',
                color: styles.text.primary,
                borderColor: styles.input.borderColor
              }}
            >
              Ir al login
            </button>
          </div>

          <p className="text-xs mt-6" style={{ color: styles.text.tertiary }}>
            Guarda el número de caso para futuras referencias.
          </p>
        </div>
      </div>
    );
  }

  // ================================
  // FORMULARIO
  // ================================
  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-black mb-2" style={{ color: styles.text.primary }}>
          Abrir nuevo caso
        </h2>
        <p className="text-sm" style={{ color: styles.text.secondary }}>
          Completa todos los campos obligatorios (*) para registrar tu solicitud.
        </p>
      </div>

      {/* Errores de validación o error general */}
      {(validationErrors.length > 0 || errorMessage) && (
        <div
          className="rounded-2xl p-4 mb-6 border-2"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
            borderColor: 'rgba(239, 68, 68, 0.4)'
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-2" style={{ color: '#ef4444' }}>
                {errorMessage || 'Por favor corrige los siguientes errores:'}
              </h4>
              {validationErrors.length > 0 && (
                <ul className="text-sm space-y-1" style={{ color: styles.text.primary }}>
                  {validationErrors.map((err, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span style={{ color: '#ef4444' }}>•</span>
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-3xl shadow-xl border overflow-hidden"
        style={{ ...styles.card, boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* === COLUMNA IZQUIERDA === */}
            <div className="space-y-5">
              <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{ color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)' }}>
                Ubicación y Cliente
              </h2>

              {/* País */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  País <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['SV', 'GT'] as Pais[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPais(p)}
                      className="px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all"
                      style={{
                        backgroundColor: pais === p
                          ? (theme === 'dark' ? 'rgba(16, 122, 180, 0.2)' : 'rgba(16, 122, 180, 0.1)')
                          : styles.input.backgroundColor,
                        borderColor: pais === p ? '#107ab4' : styles.input.borderColor,
                        color: pais === p ? '#107ab4' : styles.text.primary
                      }}
                    >
                      {p === 'SV' ? 'El Salvador' : 'Guatemala'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cliente (buscador) */}
              <div className="relative" ref={clienteDropdownRef}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Cliente <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: styles.text.tertiary }} />
                  <input
                    type="text"
                    value={clienteSearchTerm}
                    onChange={(e) => {
                      setClienteSearchTerm(e.target.value);
                      setShowClienteDropdown(true);
                      if (!e.target.value) handleClienteClear();
                    }}
                    onFocus={() => setShowClienteDropdown(true)}
                    placeholder={pais ? 'Buscar por ID, nombre, email o teléfono...' : 'Selecciona primero el país'}
                    disabled={!pais || loadingClientes}
                    className={inputBaseClass + ' pl-10 pr-10'}
                    style={{ ...styles.input, opacity: (!pais || loadingClientes) ? 0.5 : 1 }}
                  />
                  {loadingClientes && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" style={{ color: styles.text.tertiary }} />
                  )}
                  {form.clienteId && !loadingClientes && (
                    <button
                      type="button"
                      onClick={handleClienteClear}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: styles.text.tertiary }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {showClienteDropdown && clientesFiltrados.length > 0 && (
                  <div
                    className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-xl border shadow-lg"
                    style={{ backgroundColor: styles.card.backgroundColor, borderColor: styles.input.borderColor }}
                  >
                    {clientesFiltrados.map(c => (
                      <button
                        key={c.CardCode}
                        type="button"
                        onClick={() => handleClienteSelect(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-500/10 transition-colors flex items-center gap-2"
                      >
                        <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: styles.text.tertiary }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate" style={{ color: styles.text.primary }}>
                            {c.CardName}
                          </div>
                          <div className="text-xs truncate" style={{ color: styles.text.tertiary }}>
                            {c.CardCode}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showClienteDropdown && clientesFiltrados.length === 0 && !loadingClientes && clienteSearchTerm && (
                  <div
                    className="absolute z-10 mt-1 w-full p-4 text-center rounded-xl border text-sm"
                    style={{ backgroundColor: styles.card.backgroundColor, borderColor: styles.input.borderColor, color: styles.text.tertiary }}
                  >
                    No se encontraron clientes
                  </div>
                )}
              </div>

              {/* Categoría */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Categoría <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={form.categoriaId}
                  onChange={(e) => setForm(f => ({ ...f, categoriaId: e.target.value }))}
                  disabled={!pais || loadingCategorias}
                  className={inputBaseClass}
                  style={{ ...styles.input, opacity: (!pais || loadingCategorias) ? 0.5 : 1 }}
                >
                  <option value="">
                    {!pais ? 'Selecciona primero el país' : loadingCategorias ? 'Cargando...' : 'Selecciona una categoría'}
                  </option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* === COLUMNA DERECHA === */}
            <div className="space-y-5">
              <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{ color: styles.text.primary, borderColor: 'rgba(148, 163, 184, 0.2)' }}>
                Detalles del Caso
              </h2>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Descripción <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Detalles completos del caso..."
                  rows={6}
                  className={inputBaseClass + ' resize-none'}
                  style={styles.input}
                  maxLength={2000}
                />
              </div>

              {/* Contacto principal */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Contacto Principal <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.contactoPrincipal}
                  onChange={(e) => setForm(f => ({ ...f, contactoPrincipal: e.target.value }))}
                  placeholder="Nombre del contacto"
                  className={inputBaseClass}
                  style={styles.input}
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Teléfono <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))}
                  placeholder={pais === 'GT' ? '+502 12345678' : '+503 12345678'}
                  className={inputBaseClass}
                  style={styles.input}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="cliente@empresa.com"
                  className={inputBaseClass}
                  style={styles.input}
                />
              </div>

              {/* Email de notificaciones (opcional) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Email para notificaciones
                  <span className="ml-1 text-xs font-normal" style={{ color: styles.text.tertiary }}>(opcional)</span>
                </label>
                <input
                  type="email"
                  value={form.emailNotificacion}
                  onChange={(e) => setForm(f => ({ ...f, emailNotificacion: e.target.value }))}
                  placeholder="recibe-avisos@ejemplo.com"
                  className={inputBaseClass}
                  style={styles.input}
                />
                <p className="text-xs mt-1" style={{ color: styles.text.tertiary }}>
                  Te enviaremos un correo confirmando que tu caso fue registrado.
                </p>
              </div>

              {/* Canal de contacto y notificación (unificado) */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: styles.text.secondary }}>
                  Medio de contacto y notificación <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={form.canalContacto}
                  onChange={(e) => setForm(f => ({ ...f, canalContacto: e.target.value as Channel }))}
                  className={inputBaseClass}
                  style={styles.input}
                >
                  <option value="">Seleccionar una opción</option>
                  {Object.values(Channel).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t" style={{ borderColor: 'rgba(148, 163, 184, 0.2)' }}>
            <button
              type="button"
              onClick={handleNuevo}
              className="flex-1 px-6 py-3 rounded-xl font-semibold text-sm border transition-all"
              style={{
                backgroundColor: 'transparent',
                color: styles.text.primary,
                borderColor: styles.input.borderColor
              }}
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={submitting || !pais}
              className="flex-1 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#107ab4',
                color: '#ffffff'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Registrar Caso'
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="text-xs text-center mt-6" style={{ color: styles.text.tertiary }}>
        Al enviar este formulario, aceptas que tu información sea procesada para atender tu solicitud.
      </p>
    </div>
  );
};

export default NuevoCasoPublico;