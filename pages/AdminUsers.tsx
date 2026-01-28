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
  X,
  CheckCircle2,
  AlertCircle,
  Filter,
  Search,
  Download
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { Agente } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import LoadingLogo from '../components/LoadingLogo';
import Toast, { ToastType } from '../components/Toast';

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
  pais?: string;
}

type RoleFilter = 'todos' | 'AGENTE' | 'SUPERVISOR' | 'GERENTE' | 'ADMIN';
type EstadoFilter = 'todos' | 'activos' | 'inactivos' | 'vacaciones';

type SortField = 'nombre' | 'email' | 'rol' | 'pais' | 'estado';
type SortDirection = 'asc' | 'desc';

// ==================================================
// COMPONENTE PRINCIPAL
// ==================================================

const AdminUsers: React.FC = () => {
  const { theme } = useTheme();
  const location = useLocation();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('todos');
  const [adminCountry, setAdminCountry] = useState<'SV' | 'GT' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('todos');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE);
  
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
  
  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    rol: 'AGENTE' as UserRole,
    pais: 'El_Salvador',
    activo: true,
    enVacaciones: false
  });

  // Función helper para obtener y normalizar el país del admin
  const getAdminCountry = async (): Promise<'SV' | 'GT' | null> => {
    try {
      // Primero intentar desde api.getUser() que puede tener datos más actualizados
      const currentUser = api.getUser();
      let pais = currentUser?.pais || '';
      
      // Si el país es string vacío, tratarlo como undefined
      if (pais && String(pais).trim() !== '') {
        const paisNormalizado = String(pais).trim().toUpperCase();
        
        if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
          console.log('[AdminUsers] ✅ País del admin desde api.getUser(): SV');
          return 'SV';
        }
        if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
          console.log('[AdminUsers] ✅ País del admin desde api.getUser(): GT');
          return 'GT';
        }
      }
      
      // Fallback: leer desde localStorage directamente
      const userStr = localStorage.getItem('intelfon_user');
      if (!userStr) {
        console.error('[AdminUsers] No se encontró usuario en localStorage');
        return null;
      }
      
      const user = JSON.parse(userStr);
      pais = user.pais || user.country || '';
      
      // Si el país es string vacío, intentar obtenerlo desde la lista de usuarios
      if (!pais || String(pais).trim() === '') {
        console.log('[AdminUsers] 🔍 País no encontrado en localStorage, buscando en lista de usuarios...');
        try {
          const usuarios = await api.getUsuarios();
          const usuarioCompleto = usuarios.find((u: any) => 
            u.id === user.id || 
            u.idAgente === user.id || 
            u.id_agente === user.id ||
            u.id_usuario === user.id ||
            u.email === user.email ||
            (u.nombre && u.nombre.toUpperCase() === user.name.toUpperCase())
          );
          
          if (usuarioCompleto) {
            pais = usuarioCompleto.pais || usuarioCompleto.country || usuarioCompleto.país || '';
            console.log('[AdminUsers] ✅ País encontrado en lista de usuarios:', {
              usuarioId: usuarioCompleto.id || usuarioCompleto.idAgente,
              usuarioNombre: usuarioCompleto.nombre || usuarioCompleto.name,
              pais: pais
            });
            
            // Si encontramos el país, actualizar el usuario en localStorage
            if (pais && String(pais).trim() !== '') {
              const updatedUser = { ...user, pais: pais };
              localStorage.setItem('intelfon_user', JSON.stringify(updatedUser));
              console.log('[AdminUsers] ✅ País actualizado en localStorage');
            }
          } else {
            console.warn('[AdminUsers] ⚠️ Usuario no encontrado en lista de usuarios');
          }
        } catch (error) {
          console.error('[AdminUsers] Error obteniendo lista de usuarios:', error);
        }
      }
      
      // Validar que el país no sea string vacío
      if (!pais || String(pais).trim() === '') {
        console.error('[AdminUsers] ⚠️ Admin NO tiene país definido!', user);
        return null;
      }
      
      // Normalizar a códigos de 2 letras
      const paisNormalizado = String(pais).trim().toUpperCase();
      
      // El Salvador: SV, El_Salvador, El Salvador, etc.
      if (paisNormalizado === 'SV' || 
          paisNormalizado === 'EL_SALVADOR' || 
          paisNormalizado === 'EL SALVADOR' ||
          paisNormalizado.includes('SALVADOR')) {
        console.log('[AdminUsers] ✅ País normalizado: SV');
        return 'SV';
      }
      
      // Guatemala: GT, Guatemala, etc.
      if (paisNormalizado === 'GT' || 
          paisNormalizado === 'GUATEMALA' ||
          paisNormalizado.includes('GUATEMALA')) {
        console.log('[AdminUsers] ✅ País normalizado: GT');
        return 'GT';
      }
      
      console.error('[AdminUsers] ⚠️ País no reconocido:', paisNormalizado);
      return null;
    } catch (error) {
      console.error('[AdminUsers] ❌ Error obteniendo país del admin:', error);
      return null;
    }
  };

  // Función helper para normalizar el país de un usuario
  const normalizeUserCountry = (pais: string | undefined): 'SV' | 'GT' | null => {
    // Si no hay país o es string vacío, retornar null
    if (!pais || String(pais).trim() === '') {
      return null;
    }
    
    const paisNormalizado = String(pais).trim().toUpperCase();
    
    // El Salvador
    if (paisNormalizado === 'SV' || 
        paisNormalizado === 'EL_SALVADOR' || 
        paisNormalizado === 'EL SALVADOR' ||
        paisNormalizado.includes('SALVADOR')) {
      return 'SV';
    }
    
    // Guatemala
    if (paisNormalizado === 'GT' || 
        paisNormalizado === 'GUATEMALA' ||
        paisNormalizado.includes('GUATEMALA')) {
      return 'GT';
    }
    
    return null;
  };

  // Función para cargar usuarios desde el webhook
  const loadUsers = async () => {
    setLoading(true);
    try {
      // Cargar el país del admin si es necesario
      const currentUser = api.getUser();
      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'ADMINISTRADOR') {
        if (!adminCountry) {
          const country = await getAdminCountry();
          setAdminCountry(country);
          console.log('[AdminUsers] País del admin cargado:', country);
        }
      }
      
      // Obtener usuarios del webhook de crear usuario (que también lista usuarios)
      // El webhook devuelve todos los usuarios creados desde ese flujo
      const usuariosWebhook = await api.getUsuarios();
      
      // Mapear todos los usuarios del webhook
      // El webhook puede devolver usuarios con diferentes roles (agentes, gerentes, supervisores, admin)
      let usuariosMapeados: DemoUser[] = usuariosWebhook.map((usuario: any, index: number) => {
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
        
        // Generar ID único: usar el ID del webhook o generar uno único basado en email + índice
        // IMPORTANTE: El índice garantiza unicidad incluso si varios usuarios no tienen ID del webhook
        const userId = usuario.idAgente || 
                      usuario.id_agente || 
                      usuario.id || 
                      usuario.id_usuario || 
                      usuario.user_id ||
                      `U-${index}-${usuario.email || 'unknown'}-${Date.now()}`;
        
        // Validar que el ID sea único (no debería pasar, pero por seguridad)
        const idFinal = userId || `U-FALLBACK-${index}-${Date.now()}`;
        
        return {
          id: idFinal,
          nombre: usuario.nombre || usuario.name || 'Sin nombre',
          email: usuario.email || '',
          rol: rol,
          activo: activo,
          enVacaciones: enVacaciones,
          pais: usuario.pais || usuario.country || undefined
        };
      });
      
      // Admin ve todos los usuarios de ambos países (sin filtrar por país)
      if (currentUser?.role === 'ADMIN' || currentUser?.role === 'ADMINISTRADOR') {
        console.log('[AdminUsers] Admin detectado, mostrando TODOS los usuarios de ambos países');
      }
      
      // Validar que todos los IDs sean únicos antes de establecer el estado
      const ids = usuariosMapeados.map(u => u.id);
      const uniqueIds = new Set(ids);
      
      if (ids.length !== uniqueIds.size) {
        console.warn('[WARNING] Se detectaron IDs duplicados. Regenerando IDs únicos...');
        // Si hay IDs duplicados, regenerar usando índice
        const usuariosConIdsUnicos = usuariosMapeados.map((u, idx) => ({
          ...u,
          id: u.id && !ids.slice(0, idx).includes(u.id) 
            ? u.id 
            : `U-${idx}-${u.email || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        setUsers(usuariosConIdsUnicos);
      } else {
        setUsers(usuariosMapeados);
      }
    } catch (error) {
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


  // Filtrar usuarios por término de búsqueda
  const filteredUsersBySearch = useMemo(() => {
    // Resetear a primera página cuando cambian los resultados
    setCurrentPage(1);
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

    if (estadoFilter !== 'todos') {
      filtered = filtered.filter(u => {
        const esVacaciones = !!u.enVacaciones;
        const esActivo = !!u.activo && !u.enVacaciones;
        const esInactivo = !u.activo && !u.enVacaciones;

        if (estadoFilter === 'vacaciones') return esVacaciones;
        if (estadoFilter === 'activos') return esActivo;
        if (estadoFilter === 'inactivos') return esInactivo;
        return true;
      });
    }
    // Ordenar resultados
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      const getValue = (user: DemoUser) => {
        switch (sortField) {
          case 'email':
            return user.email.toLowerCase();
          case 'rol':
            return user.rol.toLowerCase();
          case 'pais':
            return (user.pais || '').toLowerCase();
          case 'estado':
            // Priorizar vacaciones > activos > inactivos en orden lógico
            if (user.enVacaciones) return '1';
            if (user.activo) return '2';
            return '3';
          case 'nombre':
          default:
            return user.nombre.toLowerCase();
        }
      };
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [filteredUsersBySearch, roleFilter, sortField, sortDirection]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  }, [filteredUsers.length, pageSize]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handleChangeSort = (field: SortField) => {
    setCurrentPage(1);
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('asc');
      return field;
    });
  };

  const handleExportCsv = () => {
    if (!filteredUsers.length) {
      setToast({ message: 'No hay usuarios para exportar con los filtros actuales', type: 'warning' });
      return;
    }

    const headers = ['Nombre', 'Email', 'Rol', 'Pais', 'Estado'];
    const rows = filteredUsers.map(user => {
      const estado = user.enVacaciones
        ? 'Vacaciones'
        : user.activo
        ? 'Activo'
        : 'Inactivo';

      return [
        user.nombre || '',
        user.email || '',
        user.rol || '',
        user.pais || '',
        estado,
      ];
    });

    const escapeCsv = (value: string) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'usuarios_filtrados.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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


  // ==================================================
  // FUNCIONES DE ACCIÓN
  // ==================================================

  const createUser = async () => {
    if (!formData.nombre.trim() || !formData.email.trim()) {
      setToast({ message: 'El nombre y el email son obligatorios', type: 'warning' });
      return;
    }

    // Validar email único
    if (users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
      setToast({ message: 'El email ya está en uso', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      
      // Llamar al webhook para crear usuario
      // La contraseña se genera automáticamente (8 caracteres aleatorios)
      // Por defecto el usuario se crea activo
      const result = await api.createAccount(
        formData.email.trim(),
        '', // Vacío para que se genere automáticamente
        formData.nombre.trim(),
        {
          rol: formData.rol, // Se enviará como 'role' en el payload
          pais: formData.pais // Incluir país
        }
      );
      
      
      // Recargar la lista de usuarios desde el webhook
      // El webhook debe devolver todos los usuarios
      await loadUsers();
      
      setShowCreateModal(false);
      setFormData({ nombre: '', email: '', rol: 'AGENTE', pais: 'El_Salvador', activo: true, enVacaciones: false });
    } catch (error: any) {
      let errorMessage = error.message || 'Error desconocido al crear el usuario';
      if (typeof errorMessage === 'string' && errorMessage.includes('Unexpected end of JSON input')) {
        errorMessage = 'El webhook no devolvió una respuesta válida. Verifica el flujo de n8n y asegúrate de que responda correctamente.';
      }
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = (userId: string, newRole: UserRole) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, rol: newRole } : u
    ));
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: userId, rol: newRole });
  };

  const toggleUserStatus = (userId: string) => {
    // Validar que userId no esté vacío o undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('[ERROR] toggleUserStatus recibió un userId inválido:', userId);
      return;
    }
    
    // Usar función de actualización para garantizar que usamos el estado más reciente
    setUsers(prevUsers => {
      // Buscar el usuario específico primero
      const userToUpdate = prevUsers.find(u => {
        const uId = String(u.id || '').trim();
        const targetId = String(userId || '').trim();
        return uId === targetId && uId !== '';
      });
      
      if (!userToUpdate) {
        console.error('[ERROR] No se encontró usuario con ID:', userId);
        console.log('[DEBUG] IDs disponibles:', prevUsers.map(u => ({ id: u.id, nombre: u.nombre })));
        return prevUsers; // No hacer cambios si no se encuentra el usuario
      }
      
      // Actualizar solo el usuario encontrado
      return prevUsers.map(u => {
        const uId = String(u.id || '').trim();
        const targetId = String(userId || '').trim();
        
        // Comparación estricta: solo actualizar si el ID coincide exactamente
        if (uId === targetId && uId !== '') {
          return { ...u, activo: !u.activo, enVacaciones: false };
        }
        return u; // Mantener sin cambios
      });
    });
    
    // TODO: Preparar para webhook n8n
    // const user = users.find(u => u.id === userId);
    // if (user) {
    //   await sendUserToWebhook('update', { id: userId, activo: !user.activo });
    // }
  };

  const toggleVacaciones = (userId: string) => {
    // Validar que userId no esté vacío o undefined
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('[ERROR] toggleVacaciones recibió un userId inválido:', userId);
      return;
    }
    
    // Usar función de actualización para garantizar que usamos el estado más reciente
    setUsers(prevUsers => {
      // Buscar el usuario específico primero
      const userToUpdate = prevUsers.find(u => {
        const uId = String(u.id || '').trim();
        const targetId = String(userId || '').trim();
        return uId === targetId && uId !== '';
      });
      
      if (!userToUpdate) {
        console.error('[ERROR] No se encontró usuario con ID:', userId);
        return prevUsers; // No hacer cambios si no se encuentra el usuario
      }
      
      // Actualizar solo el usuario encontrado
      return prevUsers.map(u => {
        const uId = String(u.id || '').trim();
        const targetId = String(userId || '').trim();
        
        // Comparación estricta: solo actualizar si el ID coincide exactamente
        if (uId === targetId && uId !== '') {
          return { ...u, enVacaciones: !u.enVacaciones, activo: u.enVacaciones ? true : u.activo };
        }
        return u; // Mantener sin cambios
      });
    });
    
    // TODO: Preparar para webhook n8n
    // const user = users.find(u => u.id === userId);
    // if (user) {
    //   await sendUserToWebhook('update', { id: userId, enVacaciones: !user.enVacaciones });
    // }
  };

  const deleteUser = () => {
    if (!selectedUser) return;
    
    setUsers(users.filter(u => u.id !== selectedUser.id));
    setShowDeleteModal(false);
    setSelectedUser(null);
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('delete', { id: selectedUser.id });
  };

  const openEditModal = (user: DemoUser) => {
    setSelectedUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      pais: 'El_Salvador', // Por defecto, se puede agregar campo de país al usuario si es necesario
      activo: user.activo,
      enVacaciones: user.enVacaciones || false
    });
    setShowEditModal(true);
  };

  const updateUser = () => {
    if (!selectedUser) return;
    if (!formData.nombre.trim() || !formData.email.trim()) {
      setToast({ message: 'El nombre y el email son obligatorios', type: 'warning' });
      return;
    }

    // Validar email único (excepto el usuario actual)
    if (users.some(u => u.id !== selectedUser.id && u.email.toLowerCase() === formData.email.toLowerCase())) {
      setToast({ message: 'El email ya está en uso', type: 'warning' });
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
    setFormData({ nombre: '', email: '', rol: 'AGENTE', pais: 'El_Salvador', activo: true, enVacaciones: false });
    
    // TODO: Preparar para webhook n8n
    // await sendUserToWebhook('update', { id: selectedUser.id, ...formData });
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
  //   // }
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

  if (loading && users.length === 0) {
    return <LoadingScreen message="Cargando Administración de Usuarios..." />;
  }

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', gap: '1rem', ...styles.container }}>
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
      {/* Header con resumen, búsqueda, acciones y filtros */}
      <div 
        className="p-4 rounded-xl border flex-shrink-0 flex flex-col gap-3" 
        style={{
          ...styles.card,
          animation: 'fadeInSlide 0.3s ease-out'
        }}
      >
        {/* Fila superior: título, resumen, búsqueda, acciones */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-black mb-1" style={{color: styles.text.primary}}>
                Administración de Usuarios
              </h1>
              <p className="text-xs" style={{color: styles.text.tertiary}}>Gestiona usuarios del sistema</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
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
          </div>
          <div className="flex items-center gap-3">
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
                    backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc',
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
                    backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                    animation: 'fadeInSlide 0.2s ease-out'
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
                        color: styles.text.primary,
                        animation: `fadeInSlide 0.2s ease-out ${index * 0.03}s both`
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
              className="px-4 py-2 text-white text-xs font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              style={{
                background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))', 
                boxShadow: '0 4px 12px rgba(200, 21, 27, 0.2)',
                transform: 'scale(1)',
                transition: 'all 0.2s ease-in-out',
                animation: 'fadeInSlide 0.3s ease-out'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(200, 21, 27, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(200, 21, 27, 0.2)';
              }}
            >
              <UserPlus className="w-4 h-4" />
              Nuevo Usuario
            </button>
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-2"
              style={{
                backgroundColor: 'transparent',
                borderColor: 'rgba(148, 163, 184, 0.3)',
                color: styles.text.secondary,
              }}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Fila inferior: filtros por rol y estado */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t" style={{ borderColor: 'rgba(148, 163, 184, 0.15)' }}>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{color: styles.text.tertiary}} />
            <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Rol:</span>
            <div className="flex flex-wrap gap-2">
              {(['todos', 'ADMIN', 'GERENTE', 'SUPERVISOR', 'AGENTE'] as RoleFilter[]).map((rol, idx) => (
                <button
                  key={rol}
                  onClick={() => setRoleFilter(rol)}
                  className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                    roleFilter === rol 
                      ? '' 
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={{
                    ...(roleFilter === rol ? {
                      backgroundColor: 'rgba(200, 21, 27, 0.15)',
                      borderColor: 'rgba(200, 21, 27, 0.4)',
                      color: '#f87171'
                    } : {
                      backgroundColor: 'transparent',
                      color: styles.text.secondary
                    }),
                    animation: `fadeInSlide 0.3s ease-out ${idx * 0.05}s both`,
                    transform: 'scale(1)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    if (roleFilter !== rol) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {rol === 'todos' ? 'Todos' : rol}
                </button>
              ))}
            </div>
            {roleFilter !== 'todos' && (
              <button
                onClick={() => setRoleFilter('todos')}
                className="px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                style={{color: styles.text.tertiary}}
              >
                <X className="w-3 h-3" />
                Limpiar rol
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" style={{color: styles.text.tertiary}} />
            <span className="text-xs font-semibold" style={{color: styles.text.secondary}}>Estado:</span>
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'todos', label: 'Todos' },
                { id: 'activos', label: 'Activos' },
                { id: 'vacaciones', label: 'Vacaciones' },
                { id: 'inactivos', label: 'Inactivos' },
              ] as { id: EstadoFilter; label: string }[]).map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => setEstadoFilter(item.id)}
                  className={`px-3 py-1 text-[10px] font-semibold rounded-lg transition-all border ${
                    estadoFilter === item.id 
                      ? '' 
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={{
                    ...(estadoFilter === item.id ? {
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      borderColor: 'rgba(34, 197, 94, 0.4)',
                      color: '#22c55e'
                    } : {
                      backgroundColor: 'transparent',
                      color: styles.text.secondary
                    }),
                    animation: `fadeInSlide 0.3s ease-out ${idx * 0.04}s both`,
                    transform: 'scale(1)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    if (estadoFilter !== item.id) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {estadoFilter !== 'todos' && (
              <button
                onClick={() => setEstadoFilter('todos')}
                className="px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
                style={{color: styles.text.tertiary}}
              >
                <X className="w-3 h-3" />
                Limpiar estado
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="flex-1 overflow-y-auto overflow-x-auto" style={{ minHeight: 0 }}>
        {loading ? (
          <div className="rounded-2xl border-2 p-16 text-center" style={{...styles.card}}>
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
            }}>
              <LoadingLogo size="large" />
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
          <div 
            className="rounded-xl border overflow-hidden" 
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out 0.1s both'
            }}
          >
            {/* Mensaje de resultados de búsqueda */}
            {searchTerm && filteredUsers.length > 0 && (
              <div 
                className="p-3 border-b" 
                style={{
                  borderColor: 'rgba(148, 163, 184, 0.2)',
                  animation: 'fadeInSlide 0.3s ease-out'
                }}
              >
                <p className="text-xs text-center" style={{color: styles.text.tertiary}}>
                  Mostrando {filteredUsers.length} resultado(s) para "{searchTerm}"
                </p>
              </div>
            )}
            
            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                    animation: 'fadeInSlide 0.3s ease-out'
                  }}>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                      style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}
                      onClick={() => handleChangeSort('nombre')}
                    >
                      Usuario{' '}
                      {sortField === 'nombre' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                      style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}
                      onClick={() => handleChangeSort('email')}
                    >
                      Email{' '}
                      {sortField === 'email' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                      style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}
                      onClick={() => handleChangeSort('rol')}
                    >
                      Rol{' '}
                      {sortField === 'rol' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                      style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}
                      onClick={() => handleChangeSort('pais')}
                    >
                      Empresa{' '}
                      {sortField === 'pais' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none"
                      style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}
                      onClick={() => handleChangeSort('estado')}
                    >
                      Estado{' '}
                      {sortField === 'estado' && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{color: styles.text.secondary, borderBottom: '1px solid rgba(148, 163, 184, 0.2)'}}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user, index) => {
                    const roleBadge = getRoleBadgeColor(user.rol);
                    const statusColor = getStatusColor(user);
                    const statusText = user.enVacaciones ? 'Vacaciones' : user.activo ? 'Activo' : 'Inactivo';

                    return (
                      <tr 
                        key={user.id}
                        className="hover:opacity-90 transition-opacity"
                        style={{
                          backgroundColor: index % 2 === 0 
                            ? (theme === 'dark' ? '#020617' : '#ffffff')
                            : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                          borderBottom: index < paginatedUsers.length - 1 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                          animation: `fadeInSlide 0.3s ease-out ${index * 0.03}s both`,
                          transform: 'translateY(0)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(2px)';
                          e.currentTarget.style.transition = 'transform 0.2s ease-in-out';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* Usuario */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="relative flex-shrink-0"
                              style={{
                                animation: `fadeInSlide 0.3s ease-out ${index * 0.03 + 0.1}s both`
                              }}
                            >
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all">
                                {user.nombre.charAt(0)}
                              </div>
                              <div className="absolute -inset-0.5 rounded-lg border-2 transition-all" style={{borderColor: statusColor.dot}}></div>
                            </div>
                            <span 
                              className="text-sm font-semibold transition-all" 
                              style={{
                                color: styles.text.primary,
                                animation: `fadeInSlide 0.3s ease-out ${index * 0.03 + 0.15}s both`
                              }}
                            >
                              {user.nombre}
                            </span>
                          </div>
                        </td>
                        
                        {/* Email */}
                        <td className="px-4 py-3">
                          <span 
                            className="text-xs transition-all" 
                            style={{
                              color: styles.text.secondary,
                              animation: `fadeInSlide 0.3s ease-out ${index * 0.03 + 0.2}s both`
                            }}
                          >
                            {user.email}
                          </span>
                        </td>
                        
                        {/* Rol */}
                        <td className="px-4 py-3">
                          <span 
                          className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                          style={{
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.text,
                            borderColor: roleBadge.border,
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          {user.rol}
                        </span>
                        </td>
                        
                        {/* País */}
                        <td className="px-4 py-3">
                          {(() => {
                            const pais = user.pais || '';
                            const paisNormalizado = pais ? String(pais).trim().toUpperCase() : '';
                            let paisDisplay = '';
                            let paisCode = '';
                            
                            if (paisNormalizado === 'SV' || paisNormalizado === 'EL_SALVADOR' || paisNormalizado === 'EL SALVADOR' || paisNormalizado.includes('SALVADOR')) {
                              paisDisplay = 'El Salvador';
                              paisCode = 'SV';
                            } else if (paisNormalizado === 'GT' || paisNormalizado === 'GUATEMALA' || paisNormalizado.includes('GUATEMALA')) {
                              paisDisplay = 'Guatemala';
                              paisCode = 'GT';
                            } else if (pais) {
                              paisDisplay = pais;
                              paisCode = paisNormalizado.substring(0, 2);
                            }
                            
                            if (!paisDisplay) {
                              return (
                                <span className="text-xs" style={{color: styles.text.tertiary}}>
                                  N/A
                                </span>
                              );
                            }
                            
                            return (
                              <span 
                                className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                                style={{
                                  backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
                                  color: styles.text.secondary,
                                  borderColor: 'rgba(148, 163, 184, 0.2)',
                                  transform: 'scale(1)',
                                  transition: 'all 0.2s ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                              >
                                <span className="text-[9px] font-bold opacity-70">{paisCode}</span>
                                {paisDisplay}
                              </span>
                            );
                          })()}
                        </td>
                        
                        {/* Estado */}
                        <td className="px-4 py-3">
                          <span 
                          className="inline-flex px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all"
                          style={{
                            backgroundColor: statusColor.bg,
                            color: statusColor.text,
                            borderColor: statusColor.border,
                            transform: 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          {statusText}
                        </span>
                        </td>
                        
                        {/* Acciones */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: 'transparent',
                                borderColor: 'rgba(148, 163, 184, 0.3)',
                                color: styles.text.secondary,
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleUserStatus(user.id);
                              }}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: user.activo ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                borderColor: user.activo ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
                                color: user.activo ? '#ef4444' : '#22c55e',
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              title={user.activo ? 'Desactivar' : 'Activar'}
                            >
                              {user.activo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleVacaciones(user.id);
                              }}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: user.enVacaciones ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                borderColor: user.enVacaciones ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.3)',
                                color: user.enVacaciones ? '#f59e0b' : styles.text.secondary,
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                              }}
                              title={user.enVacaciones ? 'Quitar vacaciones' : 'Marcar en vacaciones'}
                            >
                              <Sun className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowDeleteModal(true);
                              }}
                              className="p-2 rounded-lg border transition-all hover:shadow-md"
                              style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                transform: 'scale(1)',
                                transition: 'all 0.2s ease-in-out'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              }}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer de paginación */}
            <div
              className="flex items-center justify-between px-4 py-3 border-t text-xs"
              style={{ borderColor: 'rgba(148, 163, 184, 0.2)', color: styles.text.secondary }}
            >
              <div className="flex items-center gap-2">
                <span>
                  Mostrando{' '}
                  <strong>
                    {filteredUsers.length === 0
                      ? 0
                      : (currentPage - 1) * pageSize + 1}
                    {' - '}
                    {Math.min(currentPage * pageSize, filteredUsers.length)}
                  </strong>{' '}
                  de <strong>{filteredUsers.length}</strong> usuarios
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span>Tamaño de página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value) || PAGE_SIZE;
                      setPageSize(newSize);
                      setCurrentPage(1);
                    }}
                    className="border rounded px-2 py-1 bg-transparent text-xs"
                    style={{ borderColor: 'rgba(148, 163, 184, 0.4)' }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="px-2 py-1 border rounded disabled:opacity-40"
                    style={{
                      borderColor: 'rgba(148, 163, 184, 0.4)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    Anterior
                  </button>
                  <span>
                    Página <strong>{currentPage}</strong> de{' '}
                    <strong>{totalPages}</strong>
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    className="px-2 py-1 border rounded disabled:opacity-40"
                    style={{
                      borderColor: 'rgba(148, 163, 184, 0.4)',
                      backgroundColor: 'transparent',
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
          onClick={() => setShowCreateModal(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" 
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
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
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Empresa</label>
                <select
                  value={formData.pais}
                  onChange={(e) => setFormData({...formData, pais: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                >
                  <option value="El_Salvador">El Salvador</option>
                  <option value="Guatemala">Guatemala</option>
                </select>
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
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
          onClick={() => setShowEditModal(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" 
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
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
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
          onClick={() => setShowDeleteModal(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" 
            style={{
              ...styles.card,
              animation: 'fadeInSlide 0.3s ease-out'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
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

    </div>
  );
};

export default AdminUsers;

