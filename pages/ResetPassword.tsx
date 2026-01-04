
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const tempToken = searchParams.get('tempToken') || '';
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      setStatus('error');
      return;
    }
    
    setLoading(true);
    setStatus('idle');
    try {
      await api.finalizePasswordReset(email, tempToken, password);
      setStatus('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al restablecer contraseña.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

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
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{
            background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
            boxShadow: '0 12px 30px rgba(200, 21, 27, 0.25)'
          }}>
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-semibold text-slate-100 leading-tight mb-3">Nueva contraseña</h2>
          <p className="text-slate-300 mt-2 font-medium">Crea una contraseña segura que no hayas usado antes.</p>

          <form onSubmit={handleReset} className="mt-10 space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-300 tracking-normal mb-2">Nueva Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 rounded-2xl border text-white placeholder:text-slate-500 focus:outline-none transition-all font-medium"
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
            <div>
              <label className="block text-xs font-medium text-slate-300 tracking-normal mb-2">Confirmar Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-5 py-4 rounded-2xl border text-white placeholder:text-slate-500 focus:outline-none transition-all font-medium"
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

            {status === 'success' && (
              <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 text-green-300 p-4 rounded-2xl flex items-center gap-3 border-2 border-green-500/30 animate-in fade-in duration-300 shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400" />
                <p className="text-sm font-bold flex-1">¡Contraseña actualizada! Volviendo al login...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 text-red-300 p-4 rounded-2xl flex items-center gap-3 border-2 border-red-500/30 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <p className="text-sm font-bold">{errorMsg}</p>
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
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Restablecer Contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
