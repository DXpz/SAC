import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Cargando...' }) => {
  const { theme } = useTheme();

  const styles = {
    container: {
      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
      minHeight: '100vh'
    },
    text: {
      tertiary: theme === 'dark' ? '#94a3b8' : '#64748b'
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={styles.container}>
      <div className="flex flex-col items-center gap-4">
        <div className="inline-flex items-center justify-center">
          <img 
            src="https://static.wixstatic.com/media/98a19d_504d5e7478054d2484448813ac235267~mv2.png/v1/fill/w_192,h_176,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/red256.png"
            alt="INTELFON Logo"
            className="w-24 h-24 object-contain"
            style={{
              filter: 'drop-shadow(0 12px 30px rgba(200, 21, 27, 0.25))',
              animation: 'logoPulse 1.5s ease-in-out infinite'
            }}
          />
        </div>
        <p className="font-medium tracking-normal text-xs" style={{color: styles.text.tertiary}}>{message}</p>
      </div>
      <style>{`
        @keyframes logoPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
            filter: drop-shadow(0 12px 30px rgba(200, 21, 27, 0.25));
          }
          50% { 
            transform: scale(1.1);
            opacity: 0.9;
            filter: drop-shadow(0 12px 40px rgba(200, 21, 27, 0.4));
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
