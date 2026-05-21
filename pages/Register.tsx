import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserPlus, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingLogo from '../components/LoadingLogo';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pais, setPais] = useState('El Salvador');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{email: string; password: string; nombre: string} | null>(null);
  const navigate = useNavigate();
  const { theme } = useTheme();

  

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Crear cuenta pasando password vacío para que el backend genere
      const result = await api.createAccount(email, '', name, {
        pais: pais,
        rol: 'AGENTE',
        estado: 'ACTIVO'
      });

      // Mostrar modal de credenciales después de crear exitosamente
      const creds = {
        email: email.trim(),
        password: result.passwordTemporal || 'N/A',
        nombre: name.trim()
      };
      setCreatedUserCredentials(creds);
      setShowCredentialsModal(true);
    } catch (err: any) {
      // Mejorar mensajes de error para indicar problemas con n8n
      const errorMessage = err.message || 'Error al crear la cuenta. Intenta de nuevo.';
      if (errorMessage.includes('ya existe') || errorMessage.includes('409')) {
        setError('El usuario ya existe. Este correo electrónico ya está registrado en el sistema.');
      } else if (errorMessage.includes('no pudo ser almacenado') || errorMessage.includes('almacenado')) {
        setError('Error al almacenar el usuario. Verifica que el webhook esté configurado correctamente.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Estilos dinámicos basados en el tema (igual que GestionAgentes)
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
      borderColor: theme === 'dark' ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.3)',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    }
  };

  return (
    <div className="w-full h-full flex flex-col" style={{...styles.container}}>
      {/* Header con botón volver - estilo igual a GestionAgentes */}
      <div className="p-4 rounded-xl border flex-shrink-0 mb-4" style={{...styles.card}}>
        <button
          onClick={() => navigate('/app/agentes')}
          className="flex items-center gap-2 text-xs font-semibold transition-all"
          style={{color: styles.text.secondary}}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = styles.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = styles.text.secondary;
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Gestión de Agentes
        </button>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="mb-4 p-4 rounded-xl flex items-start gap-3 border-2" style={{
          backgroundColor: theme === 'dark' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(220, 38, 38, 0.05)',
          borderColor: 'rgba(220, 38, 38, 0.3)',
        }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{color: '#dc2626'}} />
          <p className="text-xs font-semibold" style={{color: '#dc2626'}}>{error}</p>
        </div>
      )}

      {/* Formulario - estilo igual a AdminUsers */}
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md" style={{...styles.card}}>
          <form onSubmit={handleRegister}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold" style={{color: styles.text.primary}}>Información del Agente</h2>
            </div>
            <div className="space-y-4">
              {/* Campo Nombre Completo */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>
                  Nombre Completo <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                />
              </div>

              {/* Campo Correo */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>
                  Correo <span style={{color: '#ef4444'}}>*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@intelfon.com"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                />
              </div>

              {/* Campo País */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>
                  País <span style={{color: '#ef4444'}}>*</span>
                </label>
                <select
                  required
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderColor: 'rgba(148, 163, 184, 0.3)',
                    color: styles.text.primary
                  }}
                >
                  <option value="El Salvador">El Salvador</option>
                  <option value="Guatemala">Guatemala</option>
                  <option value="Honduras">Honduras</option>
                  <option value="Nicaragua">Nicaragua</option>
                  <option value="Costa Rica">Costa Rica</option>
                  <option value="Panamá">Panamá</option>
                </select>
              </div>
            </div>

            {/* Botones de acción - estilo igual a AdminUsers */}
            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
              >
                {loading ? (
                  <LoadingLogo size="small" />
                ) : (
                  <>
                    Crear Cuenta <UserPlus className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/agentes')}
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
          </form>
        </div>
      </div>

      {/* Modal de credenciales */}
      {showCredentialsModal && createdUserCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)'}}>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold mb-2" style={{color: styles.text.primary}}>
              Credenciales del Agente
            </h3>
            <p className="text-sm mb-4" style={{color: styles.text.secondary}}>
              Las credenciales fueron creadas exitosamente. Compártelas con el agente.
            </p>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Nombre</label>
                <div className="px-3 py-2 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                  <span style={{color: styles.text.primary}}>{createdUserCredentials.nombre}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Correo</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                  <span style={{color: styles.text.primary}} className="flex-1 break-all">{createdUserCredentials.email}</span>
                  <button onClick={() => navigator.clipboard.writeText(createdUserCredentials.email)} className="text-xs font-semibold px-2 py-1 rounded" style={{backgroundColor: 'rgba(16, 122, 180, 0.1)', color: '#107ab4'}}>Copiar</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{color: styles.text.secondary}}>Contraseña Temporal</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{backgroundColor: styles.input.backgroundColor, borderColor: styles.input.borderColor}}>
                  <span className="font-mono flex-1 break-all" style={{color: styles.text.primary}}>{createdUserCredentials.password}</span>
                  <button onClick={() => navigator.clipboard.writeText(createdUserCredentials.password)} className="text-xs font-semibold px-2 py-1 rounded" style={{backgroundColor: 'rgba(16, 122, 180, 0.1)', color: '#107ab4'}}>Copiar</button>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setShowCredentialsModal(false);
                window.dispatchEvent(new CustomEvent('agente-creado'));
                navigate('/app/agentes');
              }}
              className="w-full px-4 py-2 text-white text-sm font-semibold rounded-lg"
              style={{background: 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))'}}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
