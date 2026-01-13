import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LogIn, Loader2, AlertCircle, ShieldCheck, Mail, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  // Validación de email
  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  // Validación de contraseña
  const validatePassword = (passwordValue: string): boolean => {
    return passwordValue.length >= 8;
  };

  // Validar formulario completo
  const isFormValid = (): boolean => {
    return validateEmail(email) && validatePassword(password);
  };

  // Manejar cambio de email
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (emailTouched) {
      if (value && !validateEmail(value)) {
        setEmailError('Formato de correo inválido');
      } else {
        setEmailError('');
      }
    }
  };

  // Manejar blur de email
  const handleEmailBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setEmailTouched(true);
    if (e.target.value && !validateEmail(e.target.value)) {
      setEmailError('Formato de correo inválido');
    } else {
      setEmailError('');
    }
  };

  // Manejar cambio de contraseña
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (passwordTouched) {
      if (value && !validatePassword(value)) {
        setPasswordError('La contraseña debe tener al menos 8 caracteres');
      } else {
        setPasswordError('');
      }
    }
  };

  // Manejar blur de contraseña
  const handlePasswordBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setPasswordTouched(true);
    if (e.target.value && !validatePassword(e.target.value)) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
    } else {
      setPasswordError('');
    }
  };

  // Manejar login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar antes de enviar
    setEmailTouched(true);
    setPasswordTouched(true);
    
    if (!validateEmail(email)) {
      setEmailError('Formato de correo inválido');
      return;
    }
    
    if (!validatePassword(password)) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    // Prevenir múltiples envíos
    if (isSubmitting || loading) return;
    
    setIsSubmitting(true);
    setLoading(true);
    setError('');
    setEmailError('');
    setPasswordError('');
    
    try {
      const user = await api.authenticate(email, password);
      
      // Mostrar animación de éxito
      setShowSuccessAnimation(true);
      
      // Mapeo de roles para redirección
      let targetPath = '/app/agente';
      if (user.role === 'SUPERVISOR') targetPath = '/app/supervisor';
      if (user.role === 'GERENTE') targetPath = '/app/gerencia';
      if (user.role === 'ADMIN') targetPath = '/app/admin/usuarios';
      
      // Esperar un momento para mostrar la animación antes de redirigir
      setTimeout(() => {
      navigate(targetPath);
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.message || 'Error de conexión con el servidor corporativo.';
      
      // Determinar mensaje de error
      let errorText = 'Credenciales incorrectas';
      if (errorMessage.includes('no encontrado') || 
          errorMessage.includes('no está almacenado') ||
          errorMessage.includes('no registrada') ||
          errorMessage.includes('404')) {
        errorText = 'Usuario no encontrado';
      } else if (errorMessage.includes('Credenciales inválidas') ||
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('contraseña') ||
          errorMessage.includes('password')) {
        errorText = 'Credenciales incorrectas';
      } else if (errorMessage.includes('desactivada') ||
          errorMessage.includes('inactiva') ||
          errorMessage.includes('deshabilitada')) {
        errorText = 'Cuenta desactivada';
      } else if (errorMessage.includes('Timeout') || errorMessage.includes('tiempo')) {
        errorText = 'Tiempo de espera agotado';
      } else if (errorMessage.includes('conexión') || errorMessage.includes('Error de conexión') || errorMessage.includes('CORS')) {
        errorText = 'Error de conexión';
      } else {
        errorText = 'Error de autenticación';
      }
      
      setError(errorText);
      
      // Mostrar animación de error
      setShowErrorAnimation(true);
      
      // Ocultar animación después de 3.5 segundos (más tiempo que la de éxito)
      setTimeout(() => {
        setShowErrorAnimation(false);
      }, 3500);
      
      // Animación shake en el formulario
      if (formRef.current) {
        formRef.current.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          if (formRef.current) {
            formRef.current.style.animation = '';
          }
        }, 500);
      }
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  // Agregar animación shake al CSS si no existe
  useEffect(() => {
    // Usar un ID único para evitar duplicación de estilos
    const styleId = 'login-animations-styles';
    
    // Solo agregar si no existe
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes logoPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }
    
    // Cleanup: remover estilo solo si fue creado por este componente
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  const handleDemoClick = (demoEmail: string) => {
    setEmail(demoEmail);
    setEmailTouched(false);
    setEmailError('');
    // Enfocar el campo de contraseña después de un breve delay
    setTimeout(() => {
      const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      if (passwordInput) passwordInput.focus();
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-black">
      {/* Fondo dinámico animado */}
      <AnimatedBackground />
      
      {/* Contenedor del formulario con overlay para legibilidad */}
      <div className="max-w-sm w-full relative z-10">
        <div 
          className="rounded-3xl p-6 animate-in zoom-in-95 fade-in"
          style={{
            background: 'rgba(15, 15, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(100, 0, 0, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(200, 21, 27, 0.05)',
          }}
        >
          {/* Logo y Nombre de la Empresa */}
          <div className="text-center mb-8 animate-in fade-in slide-in-from-top">
            <div className="inline-flex items-center justify-center mb-4">
              <img 
                src="https://static.wixstatic.com/media/98a19d_504d5e7478054d2484448813ac235267~mv2.png/v1/fill/w_192,h_176,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/red256.png"
                alt="INTELFON Logo"
                className="w-24 h-24 object-contain animate-in scale-in fade-in"
                style={{
                  filter: 'drop-shadow(0 12px 30px rgba(200, 21, 27, 0.25))',
                  animation: 'logoFloat 3s ease-in-out infinite, logoPulse 2s ease-in-out infinite',
                  animationDelay: '0.2s, 0s'
                }}
              />
            </div>
            <p className="text-slate-300 text-sm font-medium leading-relaxed animate-in slide-in-from-bottom fade-in" style={{animationDelay: '100ms', letterSpacing: '0'}}>
              Sistema de Gestión SAC
            </p>
            {/* Indicador de conexión segura */}
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
              <ShieldCheck className="w-3 h-3 text-green-500" />
              <span>Conexión segura</span>
            </div>
          </div>
          
          <form ref={formRef} onSubmit={handleLogin} className="space-y-5">

            <div>
              <label className="block text-xs font-medium text-slate-300 tracking-normal mb-2">Correo Institucional</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="ejemplo@intelfon.com"
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl border text-white placeholder:text-slate-500 focus:outline-none transition-all font-medium ${
                    emailError ? 'border-red-500' : emailTouched && validateEmail(email) ? 'border-green-500' : 'border-slate-600'
                  }`}
                  style={{
                    background: 'rgba(30, 30, 30, 0.9)',
                  }}
                  onFocus={(e) => {
                    if (!emailError) {
                      e.target.style.borderColor = 'rgba(200, 21, 27, 0.6)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(200, 21, 27, 0.15), 0 0 12px rgba(200, 21, 27, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    handleEmailBlur(e);
                    if (!emailError) {
                      e.target.style.borderColor = emailTouched && validateEmail(email) ? 'rgb(34, 197, 94)' : 'rgb(71, 85, 105)';
                      e.target.style.boxShadow = '';
                    }
                  }}
                  aria-invalid={emailError ? 'true' : 'false'}
                  aria-describedby={emailError ? 'email-error' : undefined}
                />
                {emailTouched && validateEmail(email) && !emailError && (
                  <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              {emailError && (
                <p id="email-error" className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-slate-300 tracking-normal">Contraseña</label>
                <Link to="/forgot-password" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
                  ¿Olvidaste el acceso?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl border text-white placeholder:text-slate-500 focus:outline-none transition-all font-medium ${
                    passwordError ? 'border-red-500' : passwordTouched && validatePassword(password) ? 'border-green-500' : 'border-slate-600'
                  }`}
                  style={{
                    background: 'rgba(30, 30, 30, 0.9)',
                  }}
                  onFocus={(e) => {
                    if (!passwordError) {
                      e.target.style.borderColor = 'rgba(200, 21, 27, 0.6)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(200, 21, 27, 0.15), 0 0 12px rgba(200, 21, 27, 0.1)';
                    }
                  }}
                  onBlur={(e) => {
                    handlePasswordBlur(e);
                    if (!passwordError) {
                      e.target.style.borderColor = passwordTouched && validatePassword(password) ? 'rgb(34, 197, 94)' : 'rgb(71, 85, 105)';
                      e.target.style.boxShadow = '';
                    }
                  }}
                  aria-invalid={passwordError ? 'true' : 'false'}
                  aria-describedby={passwordError ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-800 rounded p-1"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={0}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {passwordTouched && validatePassword(password) && !passwordError && (
                  <CheckCircle2 className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                )}
              </div>
              {passwordError && (
                <p id="password-error" className="mt-2 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isFormValid() || isSubmitting}
              className="w-full text-white font-semibold py-5 rounded-2xl transition-all flex items-center justify-center disabled:cursor-not-allowed"
              style={{
                background: loading || !isFormValid() || isSubmitting
                  ? 'linear-gradient(to right, rgba(100, 100, 100, 0.4), rgba(120, 120, 120, 0.4))'
                  : 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))',
                boxShadow: loading || !isFormValid() || isSubmitting
                  ? 'none'
                  : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)',
                opacity: loading || !isFormValid() || isSubmitting ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled && !loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(200, 21, 27, 0.4), 0 0 25px rgba(200, 21, 27, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = loading || !isFormValid() || isSubmitting
                    ? 'none'
                    : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)';
                }
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Validando...
                </>
              ) : (
                <>
                  Entrar al Sistema
                  <LogIn className="w-4 h-4 ml-3" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 text-center" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.2)' }}>
            <p className="text-xs text-slate-300 font-medium tracking-normal mb-4">Acceso Rápido Demo</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button 
                onClick={() => handleDemoClick('agente@intelfon.com')}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 rounded-full border transition-all relative group"
                style={{
                  background: 'rgba(30, 30, 30, 0.6)',
                  borderColor: 'rgba(100, 116, 139, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(200, 21, 27, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                title="Acceso rápido como Agente - Gestiona casos asignados"
              >
                Agente
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
                  Gestiona casos asignados
                </span>
              </button>
              <button 
                onClick={() => handleDemoClick('supervisor@intelfon.com')}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 rounded-full border transition-all relative group"
                style={{
                  background: 'rgba(30, 30, 30, 0.6)',
                  borderColor: 'rgba(100, 116, 139, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(200, 21, 27, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                title="Acceso rápido como Supervisor - Supervisa equipo y casos"
              >
                Supervisor
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
                  Supervisa equipo y casos
                </span>
              </button>
              <button 
                onClick={() => handleDemoClick('gerente@intelfon.com')}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 rounded-full border transition-all relative group"
                style={{
                  background: 'rgba(30, 30, 30, 0.6)',
                  borderColor: 'rgba(100, 116, 139, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(200, 21, 27, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                title="Acceso rápido como Gerente - Dashboard ejecutivo"
              >
                Gerente
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
                  Dashboard ejecutivo
                </span>
              </button>
              <button 
                onClick={() => handleDemoClick('admin@intelfon.com')}
                className="px-5 py-2.5 text-xs font-medium text-slate-300 rounded-full border transition-all relative group"
                style={{
                  background: 'rgba(30, 30, 30, 0.6)',
                  borderColor: 'rgba(100, 116, 139, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(200, 21, 27, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
                  e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
                title="Acceso rápido como Admin - Administración de usuarios"
              >
                Admin
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-xs text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
                  Administración de usuarios
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Animación de éxito a pantalla completa */}
        {showSuccessAnimation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
            {/* Logo animado */}
            <div
              className="relative mb-6"
              style={{
                animation: 'logoPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.3s both'
              }}
            >
              <img 
                src="https://static.wixstatic.com/media/98a19d_504d5e7478054d2484448813ac235267~mv2.png/v1/fill/w_192,h_176,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/red256.png"
                alt="INTELFON Logo"
                className="w-48 h-48 object-contain"
                style={{
                  filter: 'drop-shadow(0 8px 24px rgba(200, 21, 27, 0.5))',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Animación de error a pantalla completa */}
      {showErrorAnimation && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
            {/* Icono de error animado */}
            <div
              className="relative"
              style={{
                animation: 'errorPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.3s both'
              }}
            >
              <div
                className="w-40 h-40 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                  boxShadow: '0 20px 60px rgba(220, 38, 38, 0.5)'
                }}
              >
                <AlertCircle 
                  className="w-20 h-20 text-white" 
                  style={{
                    strokeWidth: 2.5
                  }}
                />
              </div>
            </div>
            
            {/* Mensaje */}
            <h2
              className="text-xl font-bold mt-6"
              style={{
                color: '#ffffff',
                animation: 'fadeInUp 0.5s ease-out 0.4s both'
              }}
            >
              Credenciales inválidas
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
