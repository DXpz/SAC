import React, { memo, useRef, useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number | string;
  duration?: number;
  className?: string;
  decimals?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1500,
  className = '',
  decimals = 0
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  const previousValueRef = useRef<number | null>(null);
  const lastValidValueRef = useRef<number>(0);

  useEffect(() => {
    if (typeof value === 'string') {
      const strValue = value as any;
      setDisplayValue(strValue);
      previousValueRef.current = strValue;
      return;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      setDisplayValue(0);
      previousValueRef.current = 0;
      return;
    }

    // En el primer render, establecer el valor directamente sin animación
    if (isInitialMount.current) {
      setDisplayValue(numValue);
      previousValueRef.current = numValue;
      if (numValue > 0) {
        lastValidValueRef.current = numValue;
      }
      isInitialMount.current = false;
      return;
    }

    // Si el valor no cambió, no hacer nada
    if (previousValueRef.current === numValue) {
      return;
    }

    // PROTECCIÓN: Ignorar cambios a 0 si el valor anterior era positivo (glitch por hover)
    if (numValue === 0 && previousValueRef.current !== null && previousValueRef.current > 0) {
      return; // Mantener el valor anterior
    }

    // Actualizar el último valor válido si el nuevo valor es mayor que 0
    if (numValue > 0) {
      lastValidValueRef.current = numValue;
    }

    // Cancelar animación anterior si existe
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    const startValue = displayValue;
    const endValue = numValue;
    previousValueRef.current = numValue;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (endValue - startValue) * easeOut;

      // Redondear el valor para evitar decimales
      const roundedValue = Math.round(currentValue);
      
      setDisplayValue(roundedValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        setDisplayValue(endValue);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup: cancelar animación si el componente se desmonta o el valor cambia
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [value, duration]);

  if (typeof value === 'string') {
    return <span className={className}>{value}</span>;
  }

  return (
    <span className={className}>
      {displayValue.toFixed(decimals)}
    </span>
  );
};

// Usar React.memo para evitar re-renders innecesarios cuando el valor no cambia
export default memo(AnimatedNumber);
