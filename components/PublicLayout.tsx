import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
}

const PublicLayout: React.FC<Props> = ({ children }) => {
  const { theme } = useTheme();

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9',
      color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
    },
    header: {
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff',
      borderBottom: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.15)' : '1px solid rgba(148, 163, 184, 0.3)',
      padding: '1rem 2rem'
    },
    content: {
      padding: '2rem 1rem',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    footer: {
      padding: '1.5rem 2rem',
      textAlign: 'center' as const,
      fontSize: '12px',
      color: theme === 'dark' ? '#64748b' : '#94a3b8',
      borderTop: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.15)' : '1px solid rgba(148, 163, 184, 0.3)',
      backgroundColor: theme === 'dark' ? '#020617' : '#ffffff'
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg"
              style={{ background: 'linear-gradient(135deg, #107ab4 0%, #0c5a8a 100%)' }}
            >
              SAC
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight" style={{ color: styles.container.color }}>
                INTELFON SAC
              </h1>
              <p className="text-xs" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                Sistema de Atención al Cliente
              </p>
            </div>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}
          >
            Formulario Público
          </div>
        </div>
      </header>

      <main style={styles.content}>
        {children}
      </main>

      <footer style={styles.footer}>
        <p>© {new Date().getFullYear()} INTELFON — Sistema de Atención al Cliente</p>
        <p className="mt-1">Si necesitas ayuda, contacta a soporte: <a href="mailto:soporte@intelfon.com" className="underline">soporte@intelfon.com</a></p>
      </footer>
    </div>
  );
};

export default PublicLayout;