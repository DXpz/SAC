import React, { useEffect, useState } from 'react';

const AnimatedBackground: React.FC = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return (
    <div 
      className="fixed inset-0 overflow-hidden pointer-events-none"
      style={{ 
        zIndex: 0,
        width: '100%',
        height: '100%',
        background: prefersReducedMotion
          ? 'radial-gradient(ellipse at center, rgba(200, 21, 27, 0.4) 0%, rgba(200, 21, 27, 0.2) 30%, rgba(200, 21, 27, 0.1) 50%, rgba(0, 0, 0, 0.8) 70%, #000000 100%)'
          : undefined
      }}
    >
      {!prefersReducedMotion && (
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(200, 21, 27, 0.4) 0%, rgba(200, 21, 27, 0.2) 30%, rgba(200, 21, 27, 0.1) 50%, rgba(0, 0, 0, 0.8) 70%, #000000 100%)',
            animation: 'redPulse 4s ease-in-out infinite',
            willChange: 'opacity'
          }}
        />
      )}
    </div>
  );
};

export default AnimatedBackground;

