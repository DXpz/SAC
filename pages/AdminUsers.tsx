import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Sun, 
  ChevronLeft, 
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { Agente } from '../types';

// ==================================================
// TIPOS
// ==================================================

type UserRole = 'ADMIN' | 'AGENTE' | 'SUPERVISOR' | 'GERENTE';
type UserStatus = 'activo' | 'inactivo' | 'vacaciones';

interface DemoUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  enVacaciones?: boolean;
}

type RoleFilter = 'todos' | 'AGENTE' | 'SUPERVISOR' | 'GERENTE' | 'ADMIN';

// ==================================================
// COMPONENTE PRINCIPAL
// ==================================================

const AdminUsers: React.FC = () => {
  const { theme } = useTheme();
  const location = useLocation();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Estados para búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestionIndex, setFocusedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: 'AGENTE' as UserRole,
    activo: true,
    enVacaciones: false
  });

  // Función para cargar usuarios desde el webhook
  const loadUsers = async () => {
    setLoading(true);
    try {
      console.log('🔄 [AdminUsers] Cargando usuarios desde webhook de usuarios...');
      
      // Obtener usuarios del webhook de crear usuario (que también lista usuarios)
      // El webhook devuelve todos los usuarios creados desde ese flujo
      const usuariosWebhook = await api.getUsuarios();
      console.log('📊 [AdminUsers] Datos recibidos del webhook:', usuariosWebhook.length);
      console.log('📊 [AdminUsers] Primer usuario (ejemplo):', usuariosWebhook[0]);
      console.log('📊 [AdminUsers] Todos los usuarios recibidos:', JSON.stringify(usuariosWebhook, null, 2));
      
      // Mapear todos los usuarios del webhook
      // El webhook puede devolver usuarios con diferentes roles (agentes, gerentes, supervisores, admin)
      const usuariosMapeados: DemoUser[] = usuariosWebhook.map((usuario: any) => {
        // Determinar el rol: el webhook puede tener diferentes campos para el rol
        let rol: UserRole = 'AGENTE'; // Por defecto es agente
        
        // Buscar el rol en diferentes campos posibles del webhook
        const rolRaw = usuario.rol || 
                      usuario.role || 
                      usuario.rol_usuario || 
                      usuario.tipo_usuario ||
                      usuario.tipo ||
                      usuario.cargo ||
                      usuario.position ||
                      '';
        
        console.log('🔍 [AdminUsers] Usuario:', usuario.nombre || usuario.name, 'Rol raw:', rolRaw);
        
        if (rolRaw) {
          const rolUpper = String(rolRaw).toUpperCase().trim();
          if (rolUpper === 'ADMIN' || rolUpper === 'ADMINISTRADOR' || rolUpper === 'ADMINISTRATOR') {
            rol = 'ADMIN';
          } else if (rolUpper === 'SUPERVISOR' || rolUpper === 'SUPERVISORA') {
            rol = 'SUPERVISOR';
          } else if (rolUpper === 'GERENTE' || rolUpper === 'MANAGER' || rolUpper === 'GERENTA') {
            rol = 'GERENTE';
          } else if (rolUpper === 'AGENTE' || rolUpper === 'AGENT' || rolUpper === 'AGENTA') {
            rol = 'AGENTE';
          } else {
            // Si no coincide con ningún rol conocido, mantener como AGENTE por defecto
            console.warn('⚠️ [AdminUsers] Rol desconocido:', rolRaw, 'para usuario:', usuario.nombre || usuario.name);
            rol = 'AGENTE';
          }
        } else {
          // Si no hay campo de rol, intentar inferirlo del email o nombre
          const email = (usuario.email || '').toLowerCase();
          const nombre = (usuario.nombre || usuario.name || '').toLowerCase();
          
          if (email.includes('gerente') || email.includes('manager') || nombre.includes('gerente')) {
            rol = 'GERENTE';
          } else if (email.includes('supervisor') || nombre.includes('supervisor')) {
            rol = 'SUPERVISOR';
          } else if (email.includes('admin') || nombre.includes('admin')) {
            rol = 'ADMIN';
          }
        }
        
        // Mapear estado
        const estado = usuario.estado || usuario.state || usuario.status || 'Inactivo';
        const activo = estado === 'Activo' || estado === 'ACTIVO' || estado === 'active' || estado === 'ACTIVE';
        const enVacaciones = estado === 'Vacaciones' || estado === 'VACACIONES' || estado === 'vacations' || estado === 'VACATIONS';
        
        return {
          id: usuario.idAgente || usuario.id_agente || usuario.id || usuario.id_usuario || `U-${usuario.email || Date.now()}`,
          nombre: usuario.nombre || usuario.name || 'Sin nombre',
          email: usuario.email || '',
          rol: rol,
          activo: activo,
          enVacaciones: enVacaciones
        };
      });
      
      console.log('✅ [AdminUsers] Usuarios mapeados:', usuariosMapeados.length);
      console.log('📋 [AdminUsers] Distribución por rol:', {
        AGENTE: usuariosMapeados.filter(u => u.rol === 'AGENTE').length,
        SUPERVISOR: usuariosMapeados.filter(u => u.rol === 'SUPERVISOR').length,
        GERENTE: usuariosMapeados.filter(u => u.rol === 'GERENTE').length,
        ADMIN: usuariosMapeados.filter(u => u.rol === 'ADMIN').length
      });
      
      // Mostrar detalles de cada usuario para debug
      usuariosMapeados.forEach((u, idx) => {
        console.log(`👤 [AdminUsers] Usuario ${idx + 1}:`, {
          nombre: u.nombre,
          email: u.email,
          rol: u.rol,
          activo: u.activo,
          enVacaciones: u.enVacaciones
        });
      });
      
      setUsers(usuariosMapeados);
    } catch (error) {
      console.error('❌ [AdminUsers] Error al cargar usuarios:', error);
      // En caso de error, mantener array vacío
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar usuarios al montar el componente o cuando cambia la vista
  useEffect(() => {
    loadUsers();
    // Ya no usamos setInterval, solo actualizamos cuando cambia la vista
  }, [location.pathname]);

  // Calcular items por vista según el ancho
  const itemsPerView = useMemo(() => {
    if (typeof window === 'undefined') return 3;
    const width = window.innerWidth;
    if (width < 640) return 1;
    if (width < 1024) return 2;
    return 3;
  }, []);

  // Filtrar usuarios por término de búsqueda
  const filteredUsersBySearch = useMemo(() => {
    if (!searchTerm.trim()) {
      return users;
    }
    const term = searchTerm.toLowerCase().trim();
    return users.filter(user => 
      user.nombre.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Filtrar usuarios por rol (aplicado después de la búsqueda)
  const filteredUsers = useMemo(() => {
    let filtered = filteredUsersBySearch;
    if (roleFilter !== 'todos') {
      filtered = filtered.filter(u => u.rol === roleFilter);
    }
    return filtered;
  }, [filteredUsersBySearch, roleFilter]);

  // Generar sugerencias de autocompletado
  const suggestions = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 1) {
      return [];
    }
    const term = searchTerm.toLowerCase().trim();
    return users
      .filter(user => 
        (user.nombre.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)) &&
        user.nombre.toLowerCase() !== term &&
        user.email.toLowerCase() !== term
      )
      .slice(0, 5) // Máximo 5 sugerencias
      .map(user => user.nombre);
  }, [users, searchTerm]);

  // Manejar selección de sugerencia
  const handleSelectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setFocusedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  // Manejar teclado en sugerencias
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggestionIndex >= 0 && focusedSuggestionIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[focusedSuggestionIndex]);
      } else if (suggestions.length === 1) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setFocusedSuggestionIndex(-1);
      searchInputRef.current?.blur();
    }
  };

  // Scroll a sugerencia enfocada
  useEffect(() => {
    if (focusedSuggestionIndex >= 0 && suggestionsRef.current) {
      const focusedElement = suggestionsRef.current.children[focusedSuggestionIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedSuggestionIndex]);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setFocusedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcular total de páginas
  useEffect(() => {
    if (scrollContainerRef.current && filteredUsers.length > 0) {
      const container = scrollContainerRef.current;
      const containerWidth = container.offsetWidth;
      const scrollWidth = container.scrollWidth;
      const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
      setTotalPages(calculatedTotalPages);
    }
  }, [filteredUsers.length, itemsPerView]);

  // Scroll a índice específico
  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const containerWidth = container.offsetWidth;
    const scrollWidth = container.scrollWidth;
    const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
    const maxIndex = Math.max(0, calculatedTotalPages - 1);
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    const scrollPosition = clampedIndex * containerWidth;
    
    container.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
    setCurrentIndex(clampedIndex);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollPosition = container.scrollLeft;
    const containerWidth = container.offsetWidth;
    const scrollWidth = container.scrollWidth;
    
    const calculatedTotalPages = Math.max(1, Math.ceil(scrollWidth / containerWidth));
    if (calculatedTotalPages !== totalPages) {
      setTotalPages(calculatedTotalPages);
    }
    
    const newIndex = Math.round(scrollPosition / containerWidth);
    const clampedIndex = Math.max(0, Math.min(newIndex, calculatedTotalPages - 1));
    setCurrentIndex(clampedIndex);
  };

  const nextPage = () => {
    if (currentIndex < totalPages - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const prevPage = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  // ==================================================
  // FUNCIONES DE ACCIÓN
  // ==================================================

  const createUser = async () => {
    console.log('🔵 [AdminUsers] Función createUser iniciada');
    console.log('📝 [AdminUsers] FormData:', formData);
    
    if (!formData.nombre.trim() || !formData.email.trim()) {
      alert('El nombre y el email son obligatorios');
      return;
    }

    // Validar email único
    if (users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
      alert('El email ya está en uso');
      return;
    }

    try {
      setLoading(true);
      console.log('📤 [AdminUsers] Creando usuario...', formData.nombre, formData.email);
      console.log('🌐 [AdminUsers] Llamando a api.createAccount...');
      
      // Llamar al webhook para crear usuario
      // La contraseña se genera automáticamente (8 caracteres aleatorios)
      const result = await api.createAccount(
        formData.email.trim(),
        '', // Vacío para que se genere automáticamente
        formData.nombre.trim(),
        {
          rol: formData.rol // Se enviará como 'role' en el payload
        }
      );
      
      console.log('✅ [AdminUsers] Usuario creado:', result);
      
      // Recargar la lista de usuarios desde el webhook
      // El webhook debe devolver todos los usuarios
      await loadUsers();
      
      setShowCreateModal(false);
      setFormData({ nombre: '', email: '', rol: 'AGENTE', activo: true, enVacaciones: false });
      showSuccessFeedback();
    } catch (error: any) {
      console.error('❌ [AdminUsers] Error al crear usuario:', error);
      console.error('❌ [AdminUsers] Error completo:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Mensaje de error más detallado para debugging
      let errorMessage = error.message || 'Error desconocido al crear el usuario';
      
      if (errorMessage.includes('Unexpected end of JSON input')) {
        errorMessage = '❌ El webhook no devolvió una respuesta válida.\n\n' +
                      '🔍 Posibles causas:\n' +
                      '• El flujo de n8n no está devolviendo datos\n' +
                      '• El webhook no tiene un nodo "Respond to Webhook" al final\n' +
                      '• El flujo tiene un error y no completa la ejecución\n\n' +
                      '💡 Solución: Verifica el flujo de n8n y asegúrate de que devuelva los datos del usuario.';
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, rol: newRole } : u
    ));
    showSuccessFeedback();
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: userId, rol: newRole });
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, activo: !u.activo, enVacaciones: false } : u
    ));
    showSuccessFeedback();
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: userId, activo: !users.find(u => u.id === userId)?.activo });
  };

  const toggleVacaciones = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    setUsers(users.map(u => 
      u.id === userId ? { ...u, enVacaciones: !u.enVacaciones, activo: u.enVacaciones ? true : u.activo } : u
    ));
    showSuccessFeedback();
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: userId, enVacaciones: !user.enVacaciones });
  };

  const deleteUser = () => {
    if (!selectedUser) return;
    
    setUsers(users.filter(u => u.id !== selectedUser.id));
    setShowDeleteModal(false);
    setSelectedUser(null);
    showSuccessFeedback();
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('delete', { id: selectedUser.id });
  };

  const openEditModal = (user: DemoUser) => {
    setSelectedUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      enVacaciones: user.enVacaciones || false
    });
    setShowEditModal(true);
  };

  const updateUser = () => {
    if (!selectedUser) return;
    if (!formData.nombre.trim() || !formData.email.trim()) {
      alert('El nombre y el email son obligatorios');
      return;
    }

    // Validar email único (excepto el usuario actual)
    if (users.some(u => u.id !== selectedUser.id && u.email.toLowerCase() === formData.email.toLowerCase())) {
      alert('El email ya está en uso');
      return;
    }

    setUsers(users.map(u => 
      u.id === selectedUser.id ? {
        ...u,
        nombre: formData.nombre.trim(),
        email: formData.email.trim(),
        rol: formData.rol,
        activo: formData.activo,
        enVacaciones: formData.enVacaciones
      } : u
    ));
    setShowEditModal(false);
    setSelectedUser(null);
    setFormData({ nombre: '', email: '', rol: 'AGENTE', activo: true, enVacaciones: false });
    showSuccessFeedback();
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: selectedUser.id, ...formData });
  };

  const showSuccessFeedback = () => {
    setShowSuccessAnimation(true);
    setTimeout(() => setShowSuccessAnimation(false), 2000);
  };

  // ==================================================
  // FUNCIÓN PREPARADA PARA WEBHOOK (NO USADA AÚN)
  // ==================================================

  // async function sendUserToWebhook(action: 'create' | 'update' | 'delete', data: any) {
  //   // TODO: cuando exista el webhook de n8n
  //   // const WEBHOOK_URL = process.env.REACT_APP_N8N_USERS_WEBHOOK_URL || '';
  //   // 
  //   // try {
  //   //   await fetch(WEBHOOK_URL, {
  //   //     method: "POST",
  //   //     headers: { 
  //   //       "Content-Type": "application/json",
  //   //       "Authorization": `Bearer ${localStorage.getItem('intelfon_token')}`
  //   //     },
  //   //     body: JSON.stringify({
  //   //       action,
  //   //       ...data
  //   //     })
  //   //   });
  //   // } catch (error) {
  //   //   console.error('Error al enviar al webhook:', error);
  //   // }
  //   console.log('Simulando envío a webhook:', { action, data });
  // }

  // ==================================================
  // ESTILOS
  // ==================================================

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
    }
  };

  const getRoleBadgeColor = (rol: UserRole) => {
    const colors = {
      'ADMIN': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
      'GERENTE': { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)' },
      'SUPERVISOR': { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
      'AGENTE': { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' }
    };
    return colors[rol] || colors.AGENTE;
  };

  const getStatusColor = (user: DemoUser) => {
    if (user.enVacaciones) {
      return { dot: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
    }
    if (user.activo) {
      return { dot: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' };
    }
    return { dot: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' };
  };

  // Resumen de usuarios
  const resumenUsers = {
    total: users.length,
    activos: users.filter(u => u.activo && !u.enVacaciones).length,
    vacaciones: users.filter(u => u.enVacaciones).length,
    inactivos: users.filter(u => !u.activo && !u.enVacaciones).length
  };

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', gap: '1rem', ...styles.container }}>
      {/* Header con resumen y botón crear */}
      <div className="p-4 rounded-xl border flex-shrink-0 flex justify-between items-center" style={{...styles.card}}>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-black mb-1" style={{color: styles.text.primary}}>
              Administración de Usuarios
            </h1>
            <p className="text-xs" style={{color: styles.text.tertiary}}>Gestiona usuarios del sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#22c55e'}}></div>
              <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                {resumenUsers.activos} <span style={{color: styles.text.tertiary}}>Activos</span>
              </span>
            </div>
            {resumenUsers.vacaciones > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#f59e0b'}}></div>
                <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                  {resumenUsers.vacaciones} <span style={{color: styles.text.tertiary}}>Vacaciones</span>
                </span>
              </div>
            )}
            {resumenUsers.inactivos > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{backgroundColor: '#94a3b8'}}></div>
                <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>
                  {resumenUsers.inactivos} <span style={{color: styles.text.tertiary}}>Inactivos</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Botón de recargar */}
            <button
              onClick={loadUsers}
              disabled={loading}
              className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all hover:shadow-md flex items-center gap-2"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'rgba(148, 163, 184, 0.3)',
                color: styles.text.secondary,
                opacity: loading ? 0.5 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              title="Recargar usuarios"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Cargando...' : 'Recargar'}
            </button>
            
            {/* Campo de búsqueda */}
            <div className="relative" style={{ minWidth: '250px' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color: styles.text.tertiary}} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                    setFocusedSuggestionIndex(-1);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) {
                      setShowSuggestions(true);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Buscar usuario por nombre..."
                  className="w-full pl-10 pr-10 py-2 text-xs rounded-lg border transition-all focus:outline-none"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                    borderColor: showSuggestions ? 'rgba(200, 21, 27, 0.4)' : 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setShowSuggestions(false);
                      setFocusedSuggestionIndex(-1);
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-opacity-20 transition-colors"
                    style={{color: styles.text.tertiary}}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              
              {/* Lista de sugerencias */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 rounded-lg border shadow-xl max-h-48 overflow-y-auto"
                  style={{
                    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="w-full px-4 py-2.5 text-left text-xs transition-colors flex items-center gap-2"
                      style={{
                        backgroundColor: focusedSuggestionIndex === index 
                          ? (theme === 'dark' ? 'rgba(200, 21, 27, 0.2)' : 'rgba(200, 21, 27, 0.1)')
                          : 'transparent',
                        color: styles.text.primary
                      }}
                      onMouseEnter={() => setFocusedSuggestionIndex(index)}
                      onMouseLeave={() => setFocusedSuggestionIndex(-1)}
                    >
                      <Search className="w-3 h-3 flex-shrink-0" style={{color: styles.text.tertiary}} />
                      <span className="truncate">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 hover:-translate-y-0.5"
              style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))', boxShadow: '0 4px 12px rgba(200, 21, 27, 0.2)'}}
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Usuario
            </button>
          </div>
        </div>
      </div>

      {/* Filtros por rol */}
      <div className="p-4 rounded-xl border flex-shrink-0 flex items-center gap-3" style={{...styles.card}}>
        <Filter className="w-4 h-4" style={{color: styles.text.tertiary}} />
        <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Filtrar por rol:</span>
        <div className="flex gap-2">
          {(['todos', 'ADMIN', 'GERENTE', 'SUPERVISOR', 'AGENTE'] as RoleFilter[]).map(rol => (
            <button
              key={rol}
              onClick={() => setRoleFilter(rol)}
              className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                roleFilter === rol 
                  ? '' 
                  : 'border-slate-600 hover:border-slate-500'
              }`}
              style={roleFilter === rol ? {
                backgroundColor: 'rgba(200, 21, 27, 0.15)',
                borderColor: 'rgba(200, 21, 27, 0.4)',
                color: '#f87171'
              } : {
                backgroundColor: 'transparent',
                color: styles.text.secondary
              }}
            >
              {rol === 'todos' ? 'Todos' : rol}
            </button>
          ))}
        </div>
        {roleFilter !== 'todos' && (
          <button
            onClick={() => setRoleFilter('todos')}
            className="ml-auto px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
            style={{color: styles.text.tertiary}}
          >
            <X className="w-3 h-3" />
            Limpiar
          </button>
        )}
      </div>

      {/* Contenedor del carrusel */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="rounded-2xl border-2 p-16 text-center" style={{...styles.card}}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
            }}>
              <RefreshCw className="w-10 h-10 animate-spin" style={{color: styles.text.tertiary}} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>Cargando usuarios...</h3>
            <p className="text-sm" style={{color: styles.text.tertiary}}>
              Extrayendo usuarios
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="rounded-2xl border-2 p-16 text-center" style={{...styles.card}}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
            }}>
              <Users className="w-10 h-10" style={{color: styles.text.tertiary}} />
            </div>
            <h3 className="text-base font-bold mb-2" style={{color: styles.text.primary}}>No hay usuarios disponibles</h3>
            <p className="text-sm mb-6" style={{color: styles.text.tertiary}}>
              {roleFilter !== 'todos' ? `No hay usuarios con rol ${roleFilter}` : 'Los usuarios aparecerán aquí cuando estén registrados'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 text-white font-semibold rounded-xl hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
              style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
            >
              <UserPlus className="w-4 h-4" />
              Crear primer usuario
            </button>
          </div>
        ) : (
          <div className="relative w-full flex-1" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%' }}>
            {/* Mensaje de resultados de búsqueda */}
            {searchTerm && filteredUsers.length > 0 && (
              <p className="text-xs text-center mb-2 flex-shrink-0" style={{color: styles.text.tertiary}}>
                Mostrando {filteredUsers.length} resultado(s) para "{searchTerm}"
              </p>
            )}
            
            {/* Flechas de navegación */}
            {filteredUsers.length > itemsPerView && (
              <>
                <button
                  onClick={prevPage}
                  disabled={currentIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-30 rounded-full p-3 shadow-xl hover:shadow-2xl transition-all duration-200 border-2"
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderColor: currentIndex === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    opacity: currentIndex === 0 ? 0.4 : 1,
                    cursor: currentIndex === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronLeft className="w-6 h-6" style={{color: currentIndex === 0 ? styles.text.tertiary : styles.text.secondary}} />
                </button>
                <button
                  onClick={nextPage}
                  disabled={currentIndex >= totalPages - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-30 rounded-full p-3 shadow-xl hover:shadow-2xl transition-all duration-200 border-2"
                  style={{
                    backgroundColor: '#f1f5f9',
                    borderColor: currentIndex >= totalPages - 1 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    opacity: currentIndex >= totalPages - 1 ? 0.4 : 1,
                    cursor: currentIndex >= totalPages - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <ChevronRight className="w-6 h-6" style={{color: currentIndex >= totalPages - 1 ? styles.text.tertiary : styles.text.secondary}} />
                </button>
              </>
            )}

            {/* Scroll Container */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="scrollbar-hide snap-x snap-mandatory"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitScrollbar: { display: 'none' },
                overflowX: 'auto',
                overflowY: 'hidden',
                paddingTop: '20px',
                paddingBottom: '20px',
                scrollBehavior: 'smooth',
                width: '100%',
                flex: '1 1 auto',
                minHeight: 0,
                maxHeight: '100%',
                height: '100%'
              } as React.CSSProperties}
            >
              <div className="flex gap-4 items-stretch" style={{ minHeight: '100%', alignItems: 'stretch' }}>
                <div style={{ minWidth: 'calc(50% - 140px)', flexShrink: 0 }}></div>
                {filteredUsers.map((user) => {
                  const isHovered = hoveredUserId === user.id;
                  const isAnyHovered = hoveredUserId !== null;
                  const roleBadge = getRoleBadgeColor(user.rol);
                  const statusColor = getStatusColor(user);
                  const statusText = user.enVacaciones ? 'Vacaciones' : user.activo ? 'Activo' : 'Inactivo';

                  return (
                    <div
                      key={user.id}
                      className="snap-center flex-shrink-0 rounded-2xl border-2 shadow-sm overflow-visible group flex flex-col"
                      style={{
                        ...styles.card,
                        width: `calc((100% - ${(itemsPerView - 1) * 16}px) / ${itemsPerView})`,
                        minWidth: '280px',
                        maxWidth: '280px',
                        opacity: isAnyHovered && !isHovered ? 0.5 : 1,
                        transform: isHovered ? 'scale(1.03) translateY(-4px)' : isAnyHovered ? 'scale(0.95)' : 'scale(1)',
                        transformOrigin: 'center center',
                        zIndex: isHovered ? 50 : 1,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isHovered ? '0 20px 40px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.2)'
                      }}
                      onMouseEnter={() => setHoveredUserId(user.id)}
                      onMouseLeave={() => setHoveredUserId(null)}
                    >
                      <div className="p-4 w-full flex flex-col">
                        {/* Header: Avatar y nombre */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-base shadow-md">
                              {user.nombre.charAt(0)}
                            </div>
                            <div className="absolute -inset-0.5 rounded-xl border-2" style={{borderColor: statusColor.dot}}></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm mb-1 truncate" style={{color: styles.text.primary}}>{user.nombre}</h4>
                            <p className="text-xs truncate" style={{color: styles.text.tertiary}}>{user.email}</p>
                          </div>
                        </div>

                        {/* Badges: Rol y Estado */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 text-[10px] font-semibold rounded-lg border" style={{
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.text,
                            borderColor: roleBadge.border
                          }}>
                            {user.rol}
                          </span>
                          <span className="px-2 py-1 text-[10px] font-semibold rounded-lg border" style={{
                            backgroundColor: statusColor.bg,
                            color: statusColor.text,
                            borderColor: statusColor.border
                          }}>
                            {statusText}
                          </span>
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-wrap gap-2 mt-auto">
                          <button
                            onClick={() => openEditModal(user)}
                            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-all hover:shadow-md"
                            style={{
                              backgroundColor: 'transparent',
                              borderColor: 'rgba(148, 163, 184, 0.3)',
                              color: styles.text.secondary
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Edit className="w-3 h-3 inline mr-1" />
                            Editar
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all hover:shadow-md"
                            style={{
                              backgroundColor: user.activo ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                              borderColor: user.activo ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                              color: user.activo ? '#ef4444' : '#22c55e'
                            }}
                            title={user.activo ? 'Desactivar' : 'Activar'}
                          >
                            {user.activo ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => toggleVacaciones(user.id)}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all hover:shadow-md"
                            style={{
                              backgroundColor: user.enVacaciones ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                              borderColor: user.enVacaciones ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.3)',
                              color: user.enVacaciones ? '#f59e0b' : styles.text.secondary
                            }}
                            title={user.enVacaciones ? 'Quitar vacaciones' : 'Marcar en vacaciones'}
                          >
                            <Sun className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                            className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all hover:shadow-md"
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              color: '#ef4444'
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div style={{ minWidth: 'calc(50% - 140px)', flexShrink: 0 }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" style={{...styles.card}} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{color: styles.text.primary}}>Crear Usuario</h2>
              <button onClick={() => setShowCreateModal(false)} style={{color: styles.text.tertiary}}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({...formData, rol: e.target.value as UserRole})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                >
                  <option value="AGENTE">AGENTE</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="GERENTE">GERENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-xs" style={{color: styles.text.secondary}}>Activo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enVacaciones}
                    onChange={(e) => setFormData({...formData, enVacaciones: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-xs" style={{color: styles.text.secondary}}>En vacaciones</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={createUser}
                className="flex-1 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
                style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
              >
                Crear
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                  color: styles.text.secondary
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" style={{...styles.card}} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{color: styles.text.primary}}>Editar Usuario</h2>
              <button onClick={() => setShowEditModal(false)} style={{color: styles.text.tertiary}}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Nombre</label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({...formData, rol: e.target.value as UserRole})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                >
                  <option value="AGENTE">AGENTE</option>
                  <option value="SUPERVISOR">SUPERVISOR</option>
                  <option value="GERENTE">GERENTE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({...formData, activo: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-xs" style={{color: styles.text.secondary}}>Activo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.enVacaciones}
                    onChange={(e) => setFormData({...formData, enVacaciones: e.target.checked})}
                    className="w-4 h-4"
                  />
                  <span className="text-xs" style={{color: styles.text.secondary}}>En vacaciones</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={updateUser}
                className="flex-1 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
                style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
              >
                Guardar
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                  color: styles.text.secondary
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar Usuario */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" style={{...styles.card}} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{color: styles.text.primary}}>Eliminar Usuario</h2>
              <button onClick={() => setShowDeleteModal(false)} style={{color: styles.text.tertiary}}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm mb-6" style={{color: styles.text.secondary}}>
              ¿Estás seguro de que deseas eliminar a <strong>{selectedUser.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteUser}
                className="flex-1 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
                style={{backgroundColor: '#ef4444'}}
              >
                Eliminar
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                  color: styles.text.secondary
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animación de éxito */}
      {showSuccessAnimation && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-slide-in">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold">Operación exitosa</span>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;

