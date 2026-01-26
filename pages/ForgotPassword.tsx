
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Sun, Moon } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';
import { useTheme } from '../contexts/ThemeContext';
import LoadingLogo from '../components/LoadingLogo';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');
    try {
      await api.requestPasswordReset(email);
      setStatus('success');
      setTimeout(() => navigate(`/verify-code?email=${encodeURIComponent(email)}`), 2000);
    } catch (err) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Estilos específicos por tema
  if (theme === 'dark') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden bg-black">
        {/* Fondo dinámico animado */}
        <AnimatedBackground />
        
        {/* Contenedor del formulario con overlay para legibilidad */}
        <div className="max-w-md w-full relative z-10">
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
            <Link 
              to="/login" 
              className="inline-flex items-center text-sm font-bold text-slate-300 hover:text-slate-100 mb-8 transition-colors px-3 py-2 rounded-xl hover:bg-slate-800/50 animate-in fade-in slide-in-from-left"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
            </Link>

            <div className="mb-8 animate-in fade-in slide-in-from-top">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{
                background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
                boxShadow: '0 12px 30px rgba(200, 21, 27, 0.25)'
              }}>
                <Mail className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-semibold text-slate-100 leading-tight mb-3 animate-in slide-in-from-bottom fade-in" style={{animationDelay: '100ms'}}>¿Problemas para entrar?</h2>
              <p className="text-slate-300 mt-2 font-medium leading-relaxed animate-in slide-in-from-bottom fade-in" style={{animationDelay: '200ms'}}>
                Ingresa tu correo y te enviaremos un código para restablecer tu contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-300 tracking-normal mb-2">Correo </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@intelfon.com"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border text-white placeholder:text-slate-500 focus:outline-none transition-all font-medium"
                    style={{
                      background: 'rgba(30, 30, 30, 0.9)',
                      borderColor: 'rgb(71, 85, 105)'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(200, 21, 27, 0.6)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(200, 21, 27, 0.15), 0 0 12px rgba(200, 21, 27, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgb(71, 85, 105)';
                      e.target.style.boxShadow = '';
                    }}
                  />
                </div>
              </div>

              {status === 'success' && (
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 text-green-300 p-4 rounded-2xl flex items-center gap-3 border-2 border-green-500/30 animate-in fade-in duration-300 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
                  <p className="text-sm font-bold text-center flex-1">Código enviado. Redirigiendo...</p>
                </div>
              )}

              {status === 'error' && (
                <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 border-2 border-red-500/30 shadow-sm">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                  <p className="text-sm font-bold">No pudimos procesar la solicitud. Intenta de nuevo.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || status === 'success'}
                className="w-full text-white font-semibold py-5 rounded-2xl transition-all flex items-center justify-center disabled:cursor-not-allowed"
                style={{
                  background: loading || status === 'success'
                    ? 'linear-gradient(to right, rgba(100, 100, 100, 0.4), rgba(120, 120, 120, 0.4))'
                    : 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))',
                  boxShadow: loading || status === 'success'
                    ? 'none'
                    : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)',
                  opacity: loading || status === 'success' ? 0.5 : 1,
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
                    e.currentTarget.style.boxShadow = loading || status === 'success'
                      ? 'none'
                      : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)';
                  }
                }}
              >
                {loading ? <LoadingLogo size="medium" /> : 'Enviar Código de Recuperación'}
              </button>
            </form>
          </div>
        </div>

        {/* Botón flotante de cambio de tema */}
        <button
          onClick={toggleTheme}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            backgroundColor: '#1e293b',
            border: '2px solid rgba(148, 163, 184, 0.2)',
            color: '#f1f5f9',
            zIndex: 9999,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 15px 50px rgba(0, 0, 0, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
          }}
          title="Cambiar a modo claro"
        >
          <Sun className="w-6 h-6" />
        </button>
      </div>
    );
  }

  // Modo claro
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{background: 'linear-gradient(135deg, var(--color-brand-blue) 0%, var(--color-brand-blue) 75%, var(--color-accent-darkred) 100%)'}}>
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-slate-200/50 animate-in zoom-in-95 fade-in">
          <Link 
            to="/login" 
            className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-slate-700 mb-8 transition-colors px-3 py-2 rounded-xl hover:bg-slate-50 animate-in fade-in slide-in-from-left"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
          </Link>

          <div className="mb-8 animate-in fade-in slide-in-from-top">
            <div className="w-16 h-16 bg-gradient-brand-blue rounded-2xl flex items-center justify-center mb-6 shadow-brand-blue-lg animate-in scale-in fade-in animate-float">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-semibold text-slate-900 leading-tight mb-3 animate-in slide-in-from-bottom fade-in" style={{animationDelay: '100ms'}}>¿Problemas para entrar?</h2>
            <p className="text-slate-600 mt-2 font-medium leading-relaxed animate-in slide-in-from-bottom fade-in" style={{animationDelay: '200ms'}}>
              Ingresa tu correo y te enviaremos un código para restablecer tu contraseña.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-400 tracking-normal mb-2">Correo </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@intelfon.com"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-accent-light bg-accent-light focus:outline-none focus:bg-white transition-all font-medium"
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-accent-blue)';
                    e.target.style.boxShadow = '0 0 0 4px rgba(16, 122, 180, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--color-accent-light)';
                    e.target.style.boxShadow = '';
                  }}
                />
              </div>
            </div>

            {status === 'success' && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 p-4 rounded-2xl flex items-center gap-3 border-2 border-green-200 animate-in fade-in duration-300 shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" style={{color: 'var(--color-accent-blue-2)'}} />
                <p className="text-sm font-bold text-center flex-1">Código enviado. Redirigiendo...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 text-red-700 p-4 rounded-2xl flex items-center gap-3 border-2 border-red-200 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0" style={{color: 'var(--color-brand-red)'}} />
                <p className="text-sm font-bold">No pudimos procesar la solicitud. Intenta de nuevo.</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || status === 'success'}
              className="w-full text-white font-semibold py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center disabled:opacity-50 hover:-translate-y-0.5 hover:shadow-2xl"
              style={{background: 'linear-gradient(to right, var(--color-brand-blue) 0%, var(--color-brand-blue) 75%, var(--color-accent-darkred) 100%)'}}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.background = 'linear-gradient(to right, var(--color-accent-blue-2), var(--color-accent-blue))';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(to right, var(--color-brand-blue) 0%, var(--color-brand-blue) 75%, var(--color-accent-darkred) 100%)';
              }}
            >
              {loading ? <LoadingLogo size="medium" /> : 'Enviar Código de Recuperación'}
            </button>
          </form>
        </div>
      </div>

      {/* Botón flotante de cambio de tema */}
      <button
        onClick={toggleTheme}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{
          backgroundColor: '#ffffff',
          border: '2px solid rgba(148, 163, 184, 0.2)',
          color: '#0f172a',
          zIndex: 9999,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = '0 15px 50px rgba(0, 0, 0, 0.25)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.15)';
        }}
        title="Cambiar a modo oscuro"
      >
        <Moon className="w-6 h-6" />
      </button>
    </div>
  );
};

export default ForgotPassword;
