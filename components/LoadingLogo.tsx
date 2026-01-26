import React from 'react';

interface LoadingLogoProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const LoadingLogo: React.FC<LoadingLogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-12 h-12'
  };

  return (
    <>
      <img 
        src="https://static.wixstatic.com/media/98a19d_504d5e7478054d2484448813ac235267~mv2.png/v1/fill/w_192,h_176,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/red256.png"
        alt="INTELFON Logo"
        className={`${sizeClasses[size]} object-contain ${className}`}
        style={{
          filter: 'drop-shadow(0 4px 12px rgba(200, 21, 27, 0.3))',
          animation: 'logoPulse 1.5s ease-in-out infinite'
        }}
      />
      <style>{`
        @keyframes logoPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.15);
            opacity: 0.85;
          }
        }
      `}</style>
    </>
  );
};

export default LoadingLogo;
