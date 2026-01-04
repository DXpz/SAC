
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import AnimatedBackground from '../components/AnimatedBackground';

const VerifyCode: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await api.verifyResetCode(email, code);
      if (response.ok) {
        navigate(`/reset-password?email=${encodeURIComponent(email)}&tempToken=${response.tempToken || 'demo'}`);
      } else {
        setError('Código inválido o expirado.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al verificar el código.');
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
          className="rounded-3xl p-6 animate-in zoom-in-95 fade-in text-center"
          style={{
            background: 'rgba(15, 15, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(100, 0, 0, 0.2)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(200, 21, 27, 0.05)',
          }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{
            background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-accent-red))',
            boxShadow: '0 12px 30px rgba(200, 21, 27, 0.25)'
          }}>
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-semibold text-slate-100 mb-3">Verifica tu identidad</h2>
          <p className="text-slate-300 mt-2 font-medium">Hemos enviado un código a <b className="text-slate-100">{email}</b></p>

          <form onSubmit={handleVerify} className="mt-10 space-y-6 text-left">
            <div>
              <label className="block text-xs font-medium text-slate-300 tracking-normal mb-3 text-center">Código de 6 dígitos</label>
              <input
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center text-4xl font-semibold tracking-[0.5em] py-4 rounded-2xl border-2 text-white placeholder:text-slate-500 focus:outline-none transition-all"
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

            {error && (
              <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 text-red-300 p-4 rounded-xl flex items-center gap-3 border-2 border-red-500/30 shadow-sm">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <p className="text-sm font-bold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full text-white font-semibold py-5 rounded-2xl transition-all flex items-center justify-center disabled:cursor-not-allowed"
              style={{
                background: loading || code.length < 6
                  ? 'linear-gradient(to right, rgba(100, 100, 100, 0.4), rgba(120, 120, 120, 0.4))'
                  : 'linear-gradient(to right, var(--color-brand-red), var(--color-accent-red))',
                boxShadow: loading || code.length < 6
                  ? 'none'
                  : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)',
                opacity: loading || code.length < 6 ? 0.5 : 1,
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
                  e.currentTarget.style.boxShadow = loading || code.length < 6
                    ? 'none'
                    : '0 4px 14px rgba(200, 21, 27, 0.3), 0 0 20px rgba(200, 21, 27, 0.15)';
                }
              }}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Verificar Código'}
            </button>

            <button 
              type="button" 
              onClick={() => navigate('/forgot-password')} 
              className="w-full text-sm font-bold text-slate-300 hover:text-slate-100 py-3 px-4 rounded-xl transition-all"
              style={{
                background: 'rgba(30, 30, 30, 0.6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
              }}
            >
              Solicitar un nuevo código
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VerifyCode;
