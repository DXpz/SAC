import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: {
      bg: 'rgba(34, 197, 94, 0.1)',
      border: '#22c55e',
      text: '#15803d',
      icon: '#22c55e',
      iconBg: 'rgba(34, 197, 94, 0.15)',
    },
    error: {
      bg: 'rgba(220, 38, 38, 0.1)',
      border: '#dc2626',
      text: '#991b1b',
      icon: '#dc2626',
      iconBg: 'rgba(220, 38, 38, 0.15)',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.1)',
      border: '#f59e0b',
      text: '#d97706',
      icon: '#f59e0b',
      iconBg: 'rgba(245, 158, 11, 0.15)',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.1)',
      border: '#3b82f6',
      text: '#1e40af',
      icon: '#3b82f6',
      iconBg: 'rgba(59, 130, 246, 0.15)',
    },
  };

  const Icon = icons[type];
  const colorScheme = colors[type];

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-in slide-in-from-right fade-in"
      style={{ animationDuration: '300ms' }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 shadow-xl min-w-[320px] max-w-[500px] transition-all"
        style={{
          backgroundColor: '#ffffff',
          borderColor: colorScheme.border,
          boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 0 0 1px ${colorScheme.border}40`,
        }}
      >
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: colorScheme.iconBg,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: colorScheme.icon }} />
        </div>
        <p className="flex-1 text-sm font-semibold leading-relaxed" style={{ color: colorScheme.text }}>
          {message}
        </p>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-md transition-all hover:scale-110"
          style={{ 
            color: '#64748b',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f1f5f9';
            e.currentTarget.style.color = '#475569';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#64748b';
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;

