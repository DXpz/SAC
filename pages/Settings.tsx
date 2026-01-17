import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  List, 
  Zap, 
  Bell, 
  Users, 
  Calendar, 
  ShieldAlert,
  Plus,
  Trash2,
  Edit,
  GripVertical,
  UserPlus,
  Eye,
  Briefcase,
  CheckCircle2,
  Key,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  X
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';

const Settings: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('configuracion');
  const [hasChanges, setHasChanges] = useState(false);
  
  const [slaSettings, setSlaSettings] = useState({
    defaultSlaDays: 5,
    supervisorAlertDays: 1,
    managerAlertDays: 3
  });

  const [categories, setCategories] = useState([
    { id: '1', name: 'Soporte Técnico', slaDays: 5 },
    { id: '2', name: 'Facturación', slaDays: 5 },
    { id: '3', name: 'Reclamos', slaDays: 3 },
    { id: '4', name: 'Consultas Comerciales', slaDays: 2 }
  ]);

  const [newCategory, setNewCategory] = useState({
    name: '',
    slaDays: 3
  });

  const [states, setStates] = useState([
    { id: '1', name: 'Nuevo', order: 1, isFinal: false },
    { id: '2', name: 'En Proceso', order: 2, isFinal: false },
    { id: '3', name: 'Pendiente Cliente', order: 3, isFinal: false },
    { id: '4', name: 'Escalado', order: 4, isFinal: false },
    { id: '5', name: 'Resuelto', order: 5, isFinal: true },
    { id: '6', name: 'Cerrado', order: 6, isFinal: true }
  ]);

  const [newState, setNewState] = useState({
    name: '',
    order: 10,
    isFinal: false
  });

  const [transitions, setTransitions] = useState<Record<string, Record<string, boolean>>>({
    '1': { '2': true, '3': false, '4': false, '5': false, '6': false },
    '2': { '1': false, '3': true, '4': true, '5': true, '6': false },
    '3': { '1': false, '2': true, '4': false, '5': false, '6': false },
    '4': { '1': false, '2': true, '3': true, '5': true, '6': false },
    '5': { '1': false, '2': true, '3': false, '4': false, '6': true },
    '6': { '1': false, '2': false, '3': false, '4': false, '5': false }
  });

  const [draggedStateId, setDraggedStateId] = useState<string | null>(null);
  const [dragOverStateId, setDragOverStateId] = useState<string | null>(null);
  const [editingStateId, setEditingStateId] = useState<string | null>(null);
  const [editingStateName, setEditingStateName] = useState<string>('');

  const [settingsUsers, setSettingsUsers] = useState<Array<{
    id: string;
    code: string;
    name: string;
    fullName: string;
    role: string;
    email: string;
    roundRobinOrder: number;
    status: string;
  }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Función para generar código de usuario (iniciales)
  const generateUserCode = (nombre: string): string => {
    const palabras = nombre.trim().split(/\s+/);
    if (palabras.length >= 2) {
      return (palabras[0][0] + palabras[1][0]).toUpperCase();
    } else if (palabras.length === 1 && palabras[0].length >= 2) {
      return palabras[0].substring(0, 2).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase() || 'U';
  };

  // Función para cargar usuarios desde el webhook
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const usuariosWebhook = await api.getUsuarios();
      
      // Mapear usuarios del webhook a la estructura de Settings
      const usuariosMapeados = usuariosWebhook.map((usuario: any, index: number) => {
        // Determinar el rol
        let rol: string = 'Agente';
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
            rol = 'Admin';
          } else if (rolUpper === 'SUPERVISOR' || rolUpper === 'SUPERVISORA') {
            rol = 'Supervisor';
          } else if (rolUpper === 'GERENTE' || rolUpper === 'MANAGER' || rolUpper === 'GERENTA') {
            rol = 'Gerente';
          } else if (rolUpper === 'AGENTE' || rolUpper === 'AGENT' || rolUpper === 'AGENTA') {
            rol = 'Agente';
          }
        }
        
        // Mapear estado
        const estado = usuario.estado || usuario.state || usuario.status || 'Inactivo';
        const activo = estado === 'Activo' || estado === 'ACTIVO' || estado === 'active' || estado === 'ACTIVE';
        const status = activo ? 'Activo' : (estado === 'Vacaciones' || estado === 'VACACIONES' ? 'Vacaciones' : 'Inactivo');
        
        // Obtener nombre
        const nombre = usuario.nombre || usuario.name || 'Sin nombre';
        const code = generateUserCode(nombre);
        
        // Generar fullName (formato: CODE Nombre AGT-XXX)
        const idAgente = usuario.idAgente || usuario.id_agente || usuario.id || usuario.id_usuario || String(index + 1);
        const agenteCode = `AGT-${String(idAgente).padStart(3, '0')}`;
        const fullName = `${code} ${nombre} ${agenteCode}`;
        
        // Round Robin Order (por defecto 0 para no agentes, o el orden si existe)
        const roundRobinOrder = usuario.roundRobinOrder || usuario.orden_rr || usuario.orden || 
                                (rol === 'Agente' ? index + 1 : 0);
        
        return {
          id: usuario.idAgente || usuario.id_agente || usuario.id || usuario.id_usuario || `U-${usuario.email || Date.now()}`,
          code: code,
          name: nombre,
          fullName: fullName,
          role: rol,
          email: usuario.email || '',
          roundRobinOrder: roundRobinOrder,
          status: status
        };
      });
      
      setSettingsUsers(usuariosMapeados);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setSettingsUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Cargar usuarios al montar el componente
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers();
    }
  }, [activeTab]);

  const handleSlaChange = (key: string, value: number) => {
    setSlaSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Implementar guardado de configuración
    console.log('Guardando configuración SLA:', slaSettings);
    setHasChanges(false);
    // Aquí se podría mostrar un toast de éxito
  };

  const handleAddCategory = () => {
    if (!newCategory.name.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }
    
    const newId = String(Date.now());
    setCategories([...categories, {
      id: newId,
      name: newCategory.name.trim(),
      slaDays: newCategory.slaDays
    }]);
    
    setNewCategory({ name: '', slaDays: 3 });
    // TODO: Guardar en backend
  };

  const handleDeleteCategory = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta categoría?')) {
      setCategories(categories.filter(cat => cat.id !== id));
      // TODO: Eliminar en backend
    }
  };

  const handleAddState = () => {
    if (!newState.name.trim()) {
      alert('El nombre del estado es obligatorio');
      return;
    }
    
    const newId = String(Date.now());
    const maxOrder = Math.max(...states.map(s => s.order), 0);
    const newOrder = newState.order || maxOrder + 1;
    
    const newStateObj = {
      id: newId,
      name: newState.name.trim(),
      order: newOrder,
      isFinal: newState.isFinal
    };
    
    setStates([...states, newStateObj]);
    
    // Inicializar transiciones para el nuevo estado
    const newTransitions: Record<string, Record<string, boolean>> = {};
    states.forEach(state => {
      if (!newTransitions[state.id]) {
        newTransitions[state.id] = {};
      }
      newTransitions[state.id][newId] = false;
    });
    newTransitions[newId] = {};
    states.forEach(state => {
      newTransitions[newId][state.id] = false;
    });
    
    setTransitions({ ...transitions, ...newTransitions });
    setNewState({ name: '', order: 10, isFinal: false });
    setHasChanges(true);
  };

  const handleDeleteState = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este estado?')) {
      setStates(states.filter(s => s.id !== id));
      const newTransitions = { ...transitions };
      delete newTransitions[id];
      Object.keys(newTransitions).forEach(fromId => {
        delete newTransitions[fromId][id];
      });
      setTransitions(newTransitions);
      setHasChanges(true);
    }
  };

  const handleToggleFinalState = (id: string) => {
    setStates(states.map(s => s.id === id ? { ...s, isFinal: !s.isFinal } : s));
    setHasChanges(true);
  };

  const handleEditState = (id: string) => {
    const state = states.find(s => s.id === id);
    if (state) {
      setEditingStateId(id);
      setEditingStateName(state.name);
    }
  };

  const handleSaveEditState = (id: string) => {
    if (!editingStateName.trim()) {
      alert('El nombre del estado no puede estar vacío');
      return;
    }
    
    setStates(states.map(s => 
      s.id === id ? { ...s, name: editingStateName.trim() } : s
    ));
    setEditingStateId(null);
    setEditingStateName('');
    setHasChanges(true);
  };

  const handleCancelEditState = () => {
    setEditingStateId(null);
    setEditingStateName('');
  };

  const handleDragStart = (e: React.DragEvent, stateId: string) => {
    setDraggedStateId(stateId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stateId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStateId(stateId);
  };

  const handleDragLeave = () => {
    setDragOverStateId(null);
  };

  const handleDrop = (e: React.DragEvent, targetStateId: string) => {
    e.preventDefault();
    
    if (!draggedStateId || draggedStateId === targetStateId) {
      setDraggedStateId(null);
      setDragOverStateId(null);
      return;
    }

    const draggedState = states.find(s => s.id === draggedStateId);
    const targetState = states.find(s => s.id === targetStateId);
    
    if (!draggedState || !targetState) return;

    const newStates = [...states];
    const draggedIndex = newStates.findIndex(s => s.id === draggedStateId);
    const targetIndex = newStates.findIndex(s => s.id === targetStateId);

    // Reordenar
    newStates.splice(draggedIndex, 1);
    newStates.splice(targetIndex, 0, draggedState);

    // Actualizar órdenes
    const reorderedStates = newStates.map((state, index) => ({
      ...state,
      order: index + 1
    }));

    setStates(reorderedStates);
    setDraggedStateId(null);
    setDragOverStateId(null);
    setHasChanges(true);
  };

  const handleTransitionChange = (fromId: string, toId: string, checked: boolean) => {
    setTransitions({
      ...transitions,
      [fromId]: {
        ...transitions[fromId],
        [toId]: checked
      }
    });
    setHasChanges(true);
  };

  const handleSaveStates = () => {
    // TODO: Implementar guardado
    console.log('Guardando estados y transiciones:', { states, transitions });
    setHasChanges(false);
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
      setSettingsUsers(settingsUsers.filter(u => u.id !== id));
      // TODO: Eliminar en backend
    }
  };

  const [holidays, setHolidays] = useState<Date[]>([
    new Date('2025-12-25'),
    new Date('2025-01-01'),
    new Date('2025-05-01')
  ]);

  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [bulkDates, setBulkDates] = useState('2025-12-24\n2025-12-31');

  const formatDateToSpanish = (date: Date): string => {
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${dayName}, ${day} de ${month} de ${year}`;
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate.trim()) {
      alert('Por favor ingrese una fecha');
      return;
    }

    // Intentar parsear fecha en formato dd/mm/yyyy
    const dateParts = newHolidayDate.split('/');
    if (dateParts.length !== 3) {
      alert('Formato de fecha inválido. Use dd/mm/yyyy');
      return;
    }

    const day = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Los meses en JS son 0-indexed
    const year = parseInt(dateParts[2]);

    const date = new Date(year, month, day);
    
    if (isNaN(date.getTime())) {
      alert('Fecha inválida');
      return;
    }

    // Verificar si la fecha ya existe
    const dateStr = date.toISOString().split('T')[0];
    const exists = holidays.some(h => h.toISOString().split('T')[0] === dateStr);
    
    if (exists) {
      alert('Esta fecha ya está registrada');
      return;
    }

    setHolidays([...holidays, date].sort((a, b) => a.getTime() - b.getTime()));
    setNewHolidayDate('');
  };

  const handleDeleteHoliday = (date: Date) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta fecha?')) {
      setHolidays(holidays.filter(h => h.getTime() !== date.getTime()));
    }
  };

  const handleBulkImport = () => {
    if (!bulkDates.trim()) {
      alert('Por favor ingrese al menos una fecha');
      return;
    }

    // Separar por comas o saltos de línea
    const dateStrings = bulkDates
      .split(/[,\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const newDates: Date[] = [];
    const errors: string[] = [];

    dateStrings.forEach(dateStr => {
      // Validar formato YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        errors.push(`Formato inválido: ${dateStr}`);
        return;
      }

      const date = new Date(dateStr + 'T00:00:00');
      if (isNaN(date.getTime())) {
        errors.push(`Fecha inválida: ${dateStr}`);
        return;
      }

      // Verificar si ya existe
      const dateStrFormatted = date.toISOString().split('T')[0];
      const exists = holidays.some(h => h.toISOString().split('T')[0] === dateStrFormatted);
      
      if (!exists) {
        newDates.push(date);
      }
    });

    if (errors.length > 0) {
      alert(`Errores encontrados:\n${errors.join('\n')}`);
    }

    if (newDates.length > 0) {
      setHolidays([...holidays, ...newDates].sort((a, b) => a.getTime() - b.getTime()));
      setBulkDates('');
      alert(`${newDates.length} fecha(s) agregada(s) correctamente`);
    } else if (errors.length === 0) {
      alert('Todas las fechas ya están registradas');
    }
  };

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = () => {
    if (!passwordData.newPassword.trim()) {
      alert('Por favor ingrese una nueva contraseña');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    // TODO: Implementar cambio de contraseña en backend
    console.log('Cambiando contraseña...');
    alert('Contraseña actualizada correctamente');
    setPasswordData({ newPassword: '', confirmPassword: '' });
  };

  const getRoleBadgeStyle = (role: string) => {
    const roleStyles: Record<string, { bg: string; text: string; border: string }> = {
      'Admin': { 
        bg: theme === 'dark' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)', 
        text: '#8b5cf6', 
        border: 'rgba(139, 92, 246, 0.3)' 
      },
      'Agente': { 
        bg: theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.1)', 
        text: '#94a3b8', 
        border: 'rgba(148, 163, 184, 0.3)' 
      },
      'Supervisor': { 
        bg: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)', 
        text: '#3b82f6', 
        border: 'rgba(59, 130, 246, 0.3)' 
      },
      'Gerente': { 
        bg: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
        text: '#ef4444', 
        border: 'rgba(239, 68, 68, 0.3)' 
      }
    };
    return roleStyles[role] || roleStyles['Agente'];
  };

  // Componente de input numérico personalizado
  const NumberInput: React.FC<{
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    label: string;
    description?: string;
  }> = ({ value, onChange, min = 0, max, label, description }) => {
    const handleIncrement = () => {
      const newValue = value + 1;
      if (max === undefined || newValue <= max) {
        onChange(newValue);
      }
    };

    const handleDecrement = () => {
      const newValue = value - 1;
      if (newValue >= min) {
        onChange(newValue);
      }
    };

    return (
      <div>
        <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
          {label}
        </label>
        <div className="relative inline-block" style={{ width: '120px' }}>
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => {
              const numValue = parseInt(e.target.value) || min;
              onChange(Math.max(min, max !== undefined ? Math.min(numValue, max) : numValue));
            }}
            className="w-full px-3 py-2 pr-10 rounded-lg border text-sm number-input-custom"
            style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(148, 163, 184, 0.4)',
              color: styles.text.primary,
              appearance: 'none',
              MozAppearance: 'textfield',
              WebkitAppearance: 'none'
            }}
            onWheel={(e) => e.currentTarget.blur()}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)';
            }}
          />
          <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l rounded-r-lg" style={{
            borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
            backgroundColor: theme === 'dark' ? '#0f172a' : '#e2e8f0',
            width: '24px'
          }}>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={max !== undefined && value >= max}
              className="flex-1 flex items-center justify-center transition-colors"
              style={{
                cursor: (max !== undefined && value >= max) ? 'not-allowed' : 'pointer',
                backgroundColor: 'transparent',
                color: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (max === undefined || value < max) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronUp 
                className="w-3 h-3" 
                style={{
                  color: (max !== undefined && value >= max) 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#475569' : '#64748b'),
                  stroke: (max !== undefined && value >= max) 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#475569' : '#64748b'),
                  strokeWidth: 2.5,
                  fill: 'none'
                }}
              />
            </button>
            <div className="h-px" style={{ backgroundColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)' }} />
            <button
              type="button"
              onClick={handleDecrement}
              disabled={value <= min}
              className="flex-1 flex items-center justify-center transition-colors"
              style={{
                cursor: value <= min ? 'not-allowed' : 'pointer',
                backgroundColor: 'transparent',
                color: 'transparent'
              }}
              onMouseEnter={(e) => {
                if (value > min) {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <ChevronDown 
                className="w-3 h-3" 
                style={{
                  color: value <= min 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#475569' : '#64748b'),
                  stroke: value <= min 
                    ? (theme === 'dark' ? '#334155' : '#94a3b8')
                    : (theme === 'dark' ? '#475569' : '#64748b'),
                  strokeWidth: 2.5,
                  fill: 'none'
                }}
              />
            </button>
          </div>
        </div>
        {description && (
          <p className="text-xs mt-2" style={{ color: styles.text.tertiary }}>
            {description}
          </p>
        )}
      </div>
    );
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
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      boxShadow: theme === 'dark' 
        ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
        : '0 1px 3px rgba(0, 0, 0, 0.1)'
    },
    text: {
      primary: theme === 'dark' ? '#f1f5f9' : '#0f172a',
      secondary: theme === 'dark' ? '#cbd5e1' : '#475569',
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  const tabs = [
    {
      id: 'configuracion',
      name: 'Configuración',
      icon: SettingsIcon
    },
    {
      id: 'categorias',
      name: 'Categorías',
      icon: List
    },
    {
      id: 'estados-flujo',
      name: 'Estados y Flujo',
      icon: Zap
    },
    {
      id: 'usuarios',
      name: 'Usuarios',
      icon: Users
    },
    {
      id: 'asuetos',
      name: 'Asuetos',
      icon: Calendar
    },
    {
      id: 'seguridad',
      name: 'Seguridad',
      icon: ShieldAlert
    }
  ];

  return (
    <div className="flex flex-col h-full" style={{ overflow: 'hidden', ...styles.container }}>
      {/* Header con título */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <SettingsIcon 
            className="w-6 h-6" 
            style={{ color: theme === 'dark' ? '#3b82f6' : '#2563eb' }}
          />
          <h1 className="text-xl font-bold" style={{ color: styles.text.primary }}>
            Administración del Sistema
          </h1>
        </div>

        {/* Menú de tabs horizontal */}
        <div className="flex items-center gap-1 border-b" style={{ 
          borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative"
                style={{
                  color: isActive 
                    ? (theme === 'dark' ? '#3b82f6' : '#2563eb')
                    : styles.text.secondary,
                  borderBottom: isActive 
                    ? `2px solid ${theme === 'dark' ? '#3b82f6' : '#2563eb'}`
                    : '2px solid transparent'
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido según tab activo */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {activeTab === 'configuracion' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            {/* Sección: Parámetros Globales SLA */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                Parámetros Globales SLA
              </h2>
              <p className="text-sm mb-4" style={{ color: styles.text.tertiary }}>
                Defina los tiempos y alertas para el cumplimiento de acuerdos de nivel de servicio.
              </p>

              {/* Días SLA por Defecto */}
              <NumberInput
                value={slaSettings.defaultSlaDays}
                onChange={(value) => handleSlaChange('defaultSlaDays', value)}
                min={1}
                label="Días SLA por Defecto"
                description="Tiempo estándar para resolución de casos si la categoría no especifica uno propio."
              />
            </div>

            {/* Sección: Reglas de Escalamiento */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4" style={{ color: styles.text.primary }}>
                Reglas de Escalamiento
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Alerta Supervisor */}
                <NumberInput
                  value={slaSettings.supervisorAlertDays}
                  onChange={(value) => handleSlaChange('supervisorAlertDays', value)}
                  min={0}
                  label="Alerta Supervisor (Días antes de vencer)"
                  description='Genera una advertencia de "Próximo a Vencer" (Nivel 1).'
                />

                {/* Alerta Gerente */}
                <NumberInput
                  value={slaSettings.managerAlertDays}
                  onChange={(value) => handleSlaChange('managerAlertDays', value)}
                  min={0}
                  label="Alerta Gerente (Días después de vencido)"
                  description="Escala el caso a Gerencia si persiste vencido por esta cantidad de días (Nivel 3)."
                />
              </div>
            </div>

            {/* Botón Guardar Parámetros */}
            <div className="flex justify-end pt-4 border-t" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <button
                onClick={handleSave}
                className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                <Save className="w-4 h-4" />
                Guardar Parámetros
              </button>
            </div>
          </div>
        )}

        {activeTab === 'categorias' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            {/* Título y descripción */}
            <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
              Mantenimiento de Categorías
            </h2>
            <p className="text-sm mb-6" style={{ color: styles.text.tertiary }}>
              Gestione los tipos de casos y sus tiempos de respuesta (SLA).
            </p>

            {/* Formulario para agregar categoría */}
            <div className="mb-8 p-4 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label 
                    className="block text-sm font-semibold mb-2" 
                    style={{ color: styles.text.primary }}
                  >
                    Nombre Categoría
                  </label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="Ej. Soporte Redes"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
                <div className="w-32">
                  <label 
                    className="block text-sm font-semibold mb-2" 
                    style={{ color: styles.text.primary }}
                  >
                    SLA (Días)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCategory.slaDays}
                    onChange={(e) => setNewCategory({ ...newCategory, slaDays: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
                <button
                  onClick={handleAddCategory}
                  className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#22c55e' : '#16a34a',
                    boxShadow: theme === 'dark' 
                      ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                      : '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#16a34a' : '#15803d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#22c55e' : '#16a34a';
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Agregar
                </button>
              </div>
            </div>

            {/* Tabla de categorías */}
            <div className="rounded-lg border overflow-hidden" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                  }}>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      NOMBRE
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      SLA DÍAS
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => (
                    <tr
                      key={category.id}
                      style={{
                        backgroundColor: index % 2 === 0
                          ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                          : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                        borderBottom: index < categories.length - 1
                          ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                          : 'none'
                      }}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                          {category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm" style={{ color: styles.text.secondary }}>
                          {category.slaDays}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-2 rounded-lg transition-all hover:shadow-md"
                            style={{
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }}
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'estados-flujo' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            {/* Header con botón guardar */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                  Flujo de Estados y Transiciones
                </h2>
                <p className="text-sm" style={{ color: styles.text.tertiary }}>
                  Defina qué cambios de estado están permitidos y el orden del flujo.
                </p>
              </div>
              {hasChanges && (
                <button
                  onClick={handleSaveStates}
                  className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                    boxShadow: theme === 'dark' 
                      ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                      : '0 4px 12px rgba(220, 38, 38, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                  }}
                >
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </button>
              )}
            </div>

            {/* Formulario para agregar nuevo estado */}
            <div className="mb-8 p-4 rounded-lg" style={{
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
            }}>
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Agregar Nuevo Estado
              </h3>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
                    Nombre Estado
                  </label>
                  <input
                    type="text"
                    value={newState.name}
                    onChange={(e) => setNewState({ ...newState, name: e.target.value })}
                    placeholder="Ej. Validación Técnica"
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-semibold mb-2" style={{ color: styles.text.primary }}>
                    Orden
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newState.order}
                    onChange={(e) => setNewState({ ...newState, order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                      color: styles.text.primary
                    }}
                  />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="relative group" style={{ display: 'inline-block' }}>
                    <HelpCircle 
                      className="w-5 h-5 cursor-help transition-colors" 
                      style={{ color: styles.text.tertiary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = styles.text.tertiary;
                      }}
                    />
                    <div 
                      className="absolute px-3 py-2 rounded-lg text-xs font-medium whitespace-normal max-w-xs text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                        color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                        border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                        boxShadow: theme === 'dark' 
                          ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                          : '0 4px 12px rgba(0, 0, 0, 0.3)',
                        left: '50%',
                        bottom: 'calc(100% + 8px)',
                        transform: 'translateX(-50%)',
                        width: 'max-content',
                        maxWidth: '280px'
                      }}
                    >
                      <div className="font-semibold mb-1">Estado Final</div>
                      <div className="text-xs leading-relaxed">
                        Si está marcado, este estado detiene el conteo del SLA. Los casos que lleguen a este estado no se considerarán vencidos, independientemente del tiempo transcurrido.
                      </div>
                      <div 
                        className="absolute w-0 h-0"
                        style={{
                          left: '50%',
                          top: '100%',
                          transform: 'translateX(-50%)',
                          borderLeft: '4px solid transparent',
                          borderRight: '4px solid transparent',
                          borderTop: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                        }}
                      />
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={newState.isFinal}
                    onChange={(e) => setNewState({ ...newState, isFinal: e.target.checked })}
                    className="w-5 h-5 rounded cursor-pointer transition-all"
                    style={{
                      backgroundColor: newState.isFinal 
                        ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                        : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                      borderColor: newState.isFinal
                        ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                        : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                      borderWidth: '2px',
                      borderStyle: 'solid'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddState}
                  className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: theme === 'dark' ? '#22c55e' : '#16a34a',
                    boxShadow: theme === 'dark' 
                      ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                      : '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#16a34a' : '#15803d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme === 'dark' ? '#22c55e' : '#16a34a';
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Crear
                </button>
              </div>
            </div>

            {/* Lista de estados con drag and drop */}
            <div className="mb-8">
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Gestión de Estados
              </h3>
              <div className="space-y-2">
                {states
                  .sort((a, b) => a.order - b.order)
                  .map((state) => (
                    <div
                      key={state.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, state.id)}
                      onDragOver={(e) => handleDragOver(e, state.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, state.id)}
                      className="flex items-center gap-4 p-4 rounded-lg border cursor-move transition-all"
                      style={{
                        backgroundColor: draggedStateId === state.id
                          ? (theme === 'dark' ? '#1e3a8a' : '#dbeafe')
                          : dragOverStateId === state.id
                          ? (theme === 'dark' ? '#1e40af' : '#bfdbfe')
                          : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                        opacity: draggedStateId === state.id ? 0.5 : 1
                      }}
                    >
                      <GripVertical 
                        className="w-5 h-5 flex-shrink-0" 
                        style={{ color: styles.text.tertiary, cursor: 'grab' }}
                      />
                      <div className="w-16 text-sm font-semibold" style={{ color: styles.text.secondary }}>
                        Orden {state.order}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        {editingStateId === state.id ? (
                          <input
                            type="text"
                            value={editingStateName}
                            onChange={(e) => setEditingStateName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditState(state.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEditState();
                              }
                            }}
                            onBlur={() => handleSaveEditState(state.id)}
                            className="flex-1 px-2 py-1 rounded border text-sm font-medium"
                            style={{
                              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                              borderColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.5)',
                              color: styles.text.primary
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                            {state.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div className="relative group" style={{ display: 'inline-block' }}>
                            <HelpCircle 
                              className="w-4 h-4 cursor-help transition-colors" 
                              style={{ color: styles.text.tertiary }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = theme === 'dark' ? '#94a3b8' : '#64748b';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = styles.text.tertiary;
                              }}
                            />
                            <div 
                              className="absolute px-3 py-2 rounded-lg text-xs font-medium whitespace-normal max-w-xs text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none"
                              style={{
                                backgroundColor: theme === 'dark' ? '#1e293b' : '#0f172a',
                                color: theme === 'dark' ? '#f1f5f9' : '#ffffff',
                                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`,
                                boxShadow: theme === 'dark' 
                                  ? '0 4px 12px rgba(0, 0, 0, 0.5)' 
                                  : '0 4px 12px rgba(0, 0, 0, 0.3)',
                                right: 'calc(100% + 8px)',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 'max-content',
                                maxWidth: '300px'
                              }}
                            >
                              <div className="font-semibold mb-1">Estado Final - Detiene SLA</div>
                              <div className="text-xs leading-relaxed">
                                Cuando un estado está marcado como "Final", el sistema detiene completamente el conteo del tiempo de SLA (Service Level Agreement) para los casos que se encuentren en este estado. Esto significa que:
                              </div>
                              <ul className="text-xs leading-relaxed mt-2 text-left list-disc list-inside space-y-1" style={{ paddingLeft: '8px' }}>
                                <li>El caso no se considerará vencido, sin importar cuánto tiempo haya transcurrido.</li>
                                <li>No se generarán alertas de SLA vencido para este caso.</li>
                                <li>El tiempo de respuesta se congela en el momento en que el caso llega a este estado.</li>
                                <li>Útil para estados como "Resuelto", "Cerrado" o "Cancelado".</li>
                              </ul>
                              <div 
                                className="absolute w-0 h-0"
                                style={{
                                  left: '100%',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  borderTop: '4px solid transparent',
                                  borderBottom: '4px solid transparent',
                                  borderLeft: `4px solid ${theme === 'dark' ? '#1e293b' : '#0f172a'}`
                                }}
                              />
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={state.isFinal}
                            onChange={() => handleToggleFinalState(state.id)}
                            className="w-5 h-5 rounded cursor-pointer transition-all"
                            style={{
                              backgroundColor: state.isFinal 
                                ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                                : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                              borderColor: state.isFinal
                                ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                                : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                              borderWidth: '2px',
                              borderStyle: 'solid'
                            }}
                          />
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => editingStateId === state.id ? handleCancelEditState() : handleEditState(state.id)}
                          className="p-2 rounded-lg transition-all hover:shadow-md"
                          style={{
                            backgroundColor: editingStateId === state.id 
                              ? 'rgba(239, 68, 68, 0.1)'
                              : 'transparent',
                            color: editingStateId === state.id 
                              ? '#ef4444'
                              : styles.text.secondary,
                            border: editingStateId === state.id 
                              ? 'none'
                              : `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)'}`
                          }}
                          onMouseEnter={(e) => {
                            if (editingStateId === state.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                            } else {
                              e.currentTarget.style.backgroundColor = theme === 'dark' ? '#334155' : '#f1f5f9';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (editingStateId === state.id) {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            } else {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                          title={editingStateId === state.id ? "Cancelar edición" : "Editar estado"}
                        >
                          {editingStateId === state.id ? (
                            <X className="w-4 h-4" />
                          ) : (
                            <Edit className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteState(state.id)}
                          className="p-2 rounded-lg transition-all hover:shadow-md"
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                          }}
                          title="Eliminar estado"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Matriz de transiciones */}
            <div>
              <h3 className="text-sm font-bold mb-4 uppercase" style={{ color: styles.text.primary }}>
                Matriz de Transiciones Permitidas
              </h3>
              <p className="text-xs mb-4 italic" style={{ color: styles.text.tertiary }}>
                * Marque las casillas de la matriz para permitir que un usuario cambie un caso desde el estado de la fila hacia el estado de la columna.
              </p>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="mb-2">
                    <div className="text-xs font-semibold mb-1" style={{ color: styles.text.secondary }}>
                      ESTADO ACTUAL (DESDE)
                    </div>
                    <div className="text-xs italic" style={{ color: styles.text.tertiary }}>
                      CHECK = PUEDE CAMBIAR A...
                    </div>
                  </div>
                  <table className="w-full border-collapse" style={{
                    border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                      }}>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase" style={{
                          color: styles.text.secondary,
                          borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                        }}>
                          Desde
                        </th>
                        {states
                          .sort((a, b) => a.order - b.order)
                          .map((state) => (
                            <th
                              key={state.id}
                              className="px-3 py-2 text-center text-xs font-bold uppercase"
                              style={{
                                color: styles.text.secondary,
                                borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                              }}
                            >
                              {state.name.toUpperCase()}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {states
                        .sort((a, b) => a.order - b.order)
                        .map((fromState, rowIndex) => (
                          <tr
                            key={fromState.id}
                            style={{
                              backgroundColor: rowIndex % 2 === 0
                                ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                                : (theme === 'dark' ? '#0f172a' : '#f8fafc')
                            }}
                          >
                            <td
                              className="px-3 py-2 text-sm font-medium"
                              style={{
                                color: styles.text.primary,
                                borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                              }}
                            >
                              {fromState.name}
                            </td>
                            {states
                              .sort((a, b) => a.order - b.order)
                              .map((toState) => (
                                <td
                                  key={toState.id}
                                  className="px-3 py-2 text-center"
                                  style={{
                                    borderRight: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={transitions[fromState.id]?.[toState.id] || false}
                                    onChange={(e) => handleTransitionChange(fromState.id, toState.id, e.target.checked)}
                                    disabled={fromState.id === toState.id}
                                    className="w-5 h-5 rounded transition-all"
                                    style={{
                                      backgroundColor: (transitions[fromState.id]?.[toState.id] || false)
                                        ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                                        : (theme === 'dark' ? '#1e293b' : '#ffffff'),
                                      borderColor: (transitions[fromState.id]?.[toState.id] || false)
                                        ? (theme === 'dark' ? '#22c55e' : '#16a34a')
                                        : (theme === 'dark' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.5)'),
                                      borderWidth: '2px',
                                      borderStyle: 'solid',
                                      cursor: fromState.id === toState.id ? 'not-allowed' : 'pointer',
                                      opacity: fromState.id === toState.id ? 0.4 : 1
                                    }}
                                  />
                                </td>
                              ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'usuarios' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            {/* Header con título, descripción y botón */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                  Directorio de Usuarios
                </h2>
                <p className="text-sm" style={{ color: styles.text.tertiary }}>
                  Usuarios con acceso al sistema en la empresa actual.
                </p>
              </div>
              <button
                className="px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                <UserPlus className="w-4 h-4" />
                Nuevo Usuario
              </button>
            </div>

            {/* Tabla de usuarios */}
            <div className="rounded-lg border overflow-hidden" style={{
              borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
            }}>
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                  }}>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      USUARIO
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ROL
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      EMAIL
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ORDEN R.R.
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ESTADO
                    </th>
                    <th 
                      className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                      style={{ 
                        color: styles.text.secondary,
                        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                      }}
                    >
                      ACCIONES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                        Cargando usuarios...
                      </td>
                    </tr>
                  ) : settingsUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                        No hay usuarios registrados
                      </td>
                    </tr>
                  ) : (
                    settingsUsers.map((user, index) => {
                      const roleStyle = getRoleBadgeStyle(user.role);
                      return (
                        <tr
                          key={user.id}
                          style={{
                            backgroundColor: index % 2 === 0
                              ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                              : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                            borderBottom: index < settingsUsers.length - 1
                              ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                              : 'none'
                          }}
                        >
                        {/* USUARIO */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{
                                backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb'
                              }}
                            >
                              {user.code}
                            </div>
                            <span className="text-sm font-medium" style={{ color: styles.text.primary }}>
                              {user.fullName}
                            </span>
                          </div>
                        </td>
                        
                        {/* ROL */}
                        <td className="px-4 py-3">
                          <span 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border"
                            style={{
                              backgroundColor: roleStyle.bg,
                              color: roleStyle.text,
                              borderColor: roleStyle.border
                            }}
                          >
                            {user.role === 'Supervisor' && <Eye className="w-3 h-3" />}
                            {user.role === 'Gerente' && <Briefcase className="w-3 h-3" />}
                            {user.role}
                          </span>
                        </td>
                        
                        {/* EMAIL */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: styles.text.secondary }}>
                            {user.email}
                          </span>
                        </td>
                        
                        {/* ORDEN R.R. */}
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: styles.text.secondary }}>
                            {user.roundRobinOrder}
                          </span>
                        </td>
                        
                        {/* ESTADO */}
                        <td className="px-4 py-3">
                          <span 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border"
                            style={{
                              backgroundColor: theme === 'dark' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                              color: '#22c55e',
                              borderColor: 'rgba(34, 197, 94, 0.3)'
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {user.status}
                          </span>
                        </td>
                        
                        {/* ACCIONES */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 rounded-lg transition-all hover:shadow-md"
                              style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                              }}
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'asuetos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel Izquierdo: Calendario de Asuetos */}
            <div className="p-6 rounded-lg border" style={{...styles.card}}>
              <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                Calendario de Asuetos
              </h2>
              <p className="text-sm mb-6" style={{ color: styles.text.tertiary }}>
                Fechas excluidas del conteo de días hábiles para SLA.
              </p>

              {/* Formulario para agregar fecha */}
              <div className="mb-6 p-4 rounded-lg" style={{
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                border: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
              }}>
                <div className="text-xs font-bold uppercase mb-3" style={{ color: styles.text.secondary }}>
                  Agregar Fecha
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      placeholder="dd/mm/aaaa"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                        borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                        color: styles.text.primary
                      }}
                    />
                  </div>
                  <button
                    onClick={handleAddHoliday}
                    className="px-6 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    style={{
                      backgroundColor: theme === 'dark' ? '#22c55e' : '#16a34a',
                      boxShadow: theme === 'dark' 
                        ? '0 4px 12px rgba(34, 197, 94, 0.3)' 
                        : '0 4px 12px rgba(22, 163, 74, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#16a34a' : '#15803d';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme === 'dark' ? '#22c55e' : '#16a34a';
                    }}
                  >
                    <Calendar className="w-4 h-4" />
                    <Plus className="w-4 h-4" />
                    Agregar
                  </button>
                </div>
              </div>

              {/* Tabla de asuetos */}
              <div className="rounded-lg border overflow-hidden" style={{
                borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'
              }}>
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'
                    }}>
                      <th 
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                        }}
                      >
                        FECHA
                      </th>
                      <th 
                        className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider"
                        style={{ 
                          color: styles.text.secondary,
                          borderBottom: `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)'}`
                        }}
                      >
                        ACCIÓN
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-sm" style={{ color: styles.text.tertiary }}>
                          No hay asuetos registrados
                        </td>
                      </tr>
                    ) : (
                      holidays.map((holiday, index) => (
                        <tr
                          key={holiday.getTime()}
                          style={{
                            backgroundColor: index % 2 === 0
                              ? (theme === 'dark' ? '#1e293b' : '#ffffff')
                              : (theme === 'dark' ? '#0f172a' : '#f8fafc'),
                            borderBottom: index < holidays.length - 1
                              ? `1px solid ${theme === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(148, 163, 184, 0.2)'}`
                              : 'none'
                          }}
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm" style={{ color: styles.text.primary }}>
                              {formatDateToSpanish(holiday)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <button
                                onClick={() => handleDeleteHoliday(holiday)}
                                className="p-2 rounded-lg transition-all hover:shadow-md"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                }}
                                title="Eliminar fecha"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Panel Derecho: Carga Masiva */}
            <div className="p-6 rounded-lg border" style={{...styles.card}}>
              <h2 className="text-lg font-bold mb-2" style={{ color: styles.text.primary }}>
                Carga Masiva
              </h2>
              <p className="text-sm mb-6" style={{ color: styles.text.tertiary }}>
                Pegue fechas en formato YYYY-MM-DD separadas por coma o salto de línea.
              </p>

              <div className="mb-4">
                <textarea
                  value={bulkDates}
                  onChange={(e) => setBulkDates(e.target.value)}
                  placeholder="2025-12-24&#10;2025-12-31"
                  rows={12}
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                    color: styles.text.primary,
                    resize: 'vertical'
                  }}
                />
              </div>

              <button
                onClick={handleBulkImport}
                className="w-full px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                <Calendar className="w-4 h-4" />
                Importar Fechas
              </button>
            </div>
          </div>
        )}

        {activeTab === 'seguridad' && (
          <div className="flex justify-center">
            <div className="w-full max-w-md p-6 rounded-lg border" style={{...styles.card}}>
              {/* Título con icono */}
              <div className="flex items-center gap-3 mb-6">
                <Key 
                  className="w-6 h-6" 
                  style={{ color: theme === 'dark' ? '#3b82f6' : '#2563eb' }}
                />
                <h2 className="text-lg font-bold" style={{ color: styles.text.primary }}>
                  Cambio de Contraseña
                </h2>
              </div>

              {/* Campo Nueva Contraseña */}
              <div className="mb-4">
                <label 
                  className="block text-sm font-semibold mb-2" 
                  style={{ color: styles.text.primary }}
                >
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                    color: styles.text.primary
                  }}
                  placeholder="Ingrese su nueva contraseña"
                />
              </div>

              {/* Campo Confirmar Contraseña */}
              <div className="mb-6">
                <label 
                  className="block text-sm font-semibold mb-2" 
                  style={{ color: styles.text.primary }}
                >
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.4)',
                    color: styles.text.primary
                  }}
                  placeholder="Confirme su nueva contraseña"
                />
              </div>

              {/* Botón Actualizar Contraseña */}
              <button
                onClick={handlePasswordChange}
                className="w-full px-6 py-3 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
                style={{
                  backgroundColor: theme === 'dark' ? '#ef4444' : '#dc2626',
                  boxShadow: theme === 'dark' 
                    ? '0 4px 12px rgba(239, 68, 68, 0.3)' 
                    : '0 4px 12px rgba(220, 38, 38, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#dc2626' : '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme === 'dark' ? '#ef4444' : '#dc2626';
                }}
              >
                Actualizar Contraseña
              </button>
            </div>
          </div>
        )}

        {/* Placeholder para otras secciones - se completarán con las siguientes imágenes */}
        {activeTab !== 'configuracion' && activeTab !== 'categorias' && activeTab !== 'estados-flujo' && activeTab !== 'usuarios' && activeTab !== 'asuetos' && activeTab !== 'seguridad' && (
          <div className="p-6 rounded-lg border" style={{...styles.card}}>
            <p className="text-sm" style={{ color: styles.text.tertiary }}>
              Sección "{tabs.find(t => t.id === activeTab)?.name}" - Pendiente de implementar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
