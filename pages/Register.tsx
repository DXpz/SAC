import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserPlus, AlertCircle, ArrowLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import LoadingLogo from '../components/LoadingLogo';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pais, setPais] = useState('El Salvador');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Función para generar contraseña automática: "red" + número + letras random
  const generatePassword = (): string => {
    const randomNumber = Math.floor(Math.random() * 9000) + 1000; // Número de 4 dígitos
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomLetters = '';
    for (let i = 0; i < 4; i++) {
      randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return `red${randomNumber}${randomLetters}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Generar contraseña automática
      const generatedPassword = generatePassword();
      
      // Crear cuenta y almacenarla en n8n con rol AGENTE por defecto
      const user = await api.createAccount(email, generatedPassword, name, {
        pais: pais,
        rol: 'AGENTE', // Siempre AGENTE
        estado: 'ACTIVO'
      });
      
      // Si llegamos aquí, el usuario fue creado y almacenado exitosamente en n8n
      // Mostrar animación de éxito
      setError('');
      setShowSuccessAnimation(true);
      
      // Después de mostrar la animación, volver a gestión de agentes
      setTimeout(() => {
        setShowSuccessAnimation(false);
        // Disparar evento para que GestionAgentes recargue sin auto-recargar
        window.dispatchEvent(new CustomEvent('agente-creado'));
        navigate('/app/agentes');
      }, 2000);
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
              ¡Agente creado exitosamente!
            </h2>
            <p
              className="text-base"
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                animation: 'fadeInUp 0.5s ease-out 0.5s both'
              }}
            >
              Redirigiendo a la gestión de agentes...
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

export default Register;
