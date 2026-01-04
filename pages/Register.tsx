import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserPlus, Loader2, AlertCircle, ArrowLeft, ChevronRight } from 'lucide-react';

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pais, setPais] = useState('El Salvador');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
      // Mostrar mensaje de éxito antes de redirigir
      setError('');
      
      // Después de crear la cuenta, volver a gestión de agentes
      setTimeout(() => {
        navigate('/app/agentes');
      }, 500);
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

  return (
    <div className="w-full h-full flex flex-col space-y-5">
          <button
            onClick={() => navigate('/app/agentes')}
        className="flex items-center gap-2 text-xs font-bold transition-all px-4 py-2 rounded-xl group"
        style={{color: '#64748b'}}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#475569';
          e.currentTarget.style.backgroundColor = '#f8fafc';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#64748b';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
          >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Volver a Gestión de Agentes
          </button>

          {error && (
        <div className="mb-5 p-4 rounded-xl flex items-start gap-3 border-2 animate-in slide-in-from-top duration-300" style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          borderColor: 'rgba(220, 38, 38, 0.3)',
          color: '#dc2626'
        }}>
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{color: '#dc2626'}} />
          <p className="text-xs font-semibold" style={{color: '#dc2626'}}>{error}</p>
            </div>
          )}

      {/* Formulario */}
      <div className="rounded-3xl shadow-xl border overflow-hidden flex-1 flex flex-col" style={{backgroundColor: '#ffffff', borderColor: 'rgba(148, 163, 184, 0.2)', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'}}>
        <form onSubmit={handleRegister} className="p-6 flex-1 flex flex-col">
          <div className="max-w-2xl mx-auto w-full space-y-5 flex-1">
            <h2 className="text-sm font-semibold mb-3 pb-2 border-b" style={{color: '#1e293b', borderColor: 'rgba(148, 163, 184, 0.2)'}}>
              Información del Agente
            </h2>

              <div>
                <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                  className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
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

              <div>
                <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>
                  Correo <span className="text-red-500">*</span>
                </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@intelfon.com"
                  className="w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md"
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

              <div className="relative">
                <label className="block text-xs font-semibold tracking-normal mb-1.5" style={{color: '#475569'}}>
                  País <span className="text-red-500">*</span>
                </label>
                <select
                required
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 border rounded-xl outline-none focus:ring-4 transition-all font-medium text-xs shadow-sm hover:shadow-md appearance-none cursor-pointer"
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
                >
                  <option value="El Salvador">El Salvador</option>
                  <option value="Guatemala">Guatemala</option>
                </select>
                <ChevronRight className="absolute right-3 top-9 w-4 h-4 pointer-events-none transition-all duration-200" style={{color: '#64748b', transform: 'rotate(90deg)'}} />
            </div>
            </div>

          {/* Botones de acción */}
          <div className="mt-5 pt-4 border-t flex gap-3" style={{borderColor: 'rgba(148, 163, 184, 0.2)'}}>
            <button
              type="button"
              onClick={() => navigate('/app/agentes')}
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
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Crear Cuenta
                  <UserPlus className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
