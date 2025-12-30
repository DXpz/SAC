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
      bg: 'rgba(34, 197, 94, 0.15)',
      border: 'rgba(34, 197, 94, 0.4)',
      text: '#22c55e',
      icon: '#22c55e',
    },
    error: {
      bg: 'rgba(220, 38, 38, 0.15)',
      border: 'rgba(220, 38, 38, 0.4)',
      text: '#ef4444',
      icon: '#ef4444',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.4)',
      text: '#f59e0b',
      icon: '#f59e0b',
    },
    info: {
      bg: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.4)',
      text: '#3b82f6',
      icon: '#3b82f6',
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
        className="flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[300px] max-w-[500px]"
        style={{
          backgroundColor: colorScheme.bg,
          borderColor: colorScheme.border,
        }}
      >
        <Icon className="w-5 h-5 flex-shrink-0" style={{ color: colorScheme.icon }} />
        <p className="flex-1 text-sm font-semibold" style={{ color: colorScheme.text }}>
          {message}
        </p>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-black/10"
          style={{ color: colorScheme.text }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Toast;

