import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number | string;
  duration?: number;
  className?: string;
  decimals?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 1000,
  className = '',
  decimals = 0
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);
  const currentValueRef = useRef<number>(0); // Ref para mantener el valor actual de forma estable
  const previousValueRef = useRef<number | null>(null); // Ref para el valor anterior del prop
  const lastChangeTimeRef = useRef<number>(0); // Ref para rastrear cuándo cambió el valor por última vez
  const pendingValueRef = useRef<number | null>(null); // Ref para valores pendientes durante cambios rápidos

  useEffect(() => {
    if (typeof value === 'string') {
      const strValue = value as any;
      setDisplayValue(strValue);
      currentValueRef.current = strValue;
      previousValueRef.current = strValue;
      return;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      setDisplayValue(0);
      currentValueRef.current = 0;
      previousValueRef.current = 0;
      return;
    }

    // En el primer render, establecer el valor directamente sin animación
    if (isInitialMount.current) {
      setDisplayValue(numValue);
      currentValueRef.current = numValue;
      previousValueRef.current = numValue;
      lastChangeTimeRef.current = Date.now();
      isInitialMount.current = false;
      return;
    }

    // Si el valor no cambió, no hacer nada
    if (previousValueRef.current === numValue) {
      return;
    }

    // Ignorar cambios a 0 si el valor anterior era mayor (probablemente un re-render temporal)
    // Esto es especialmente importante durante hover rápido que causa re-renders
    if (numValue === 0 && previousValueRef.current !== null && previousValueRef.current > 0) {
      const now = Date.now();
      const timeSinceLastChange = now - lastChangeTimeRef.current;
      
      // Si el cambio a 0 es muy rápido (menos de 500ms), ignorarlo completamente
      // Aumentamos el tiempo para capturar más casos de hover rápido
      if (timeSinceLastChange < 500) {
        return;
      }
    }
    
    // También ignorar si el valor cambia de un número positivo a 0 y luego vuelve rápidamente
    // Esto captura el caso donde el hover causa: valor -> 0 -> valor
    if (numValue === 0 && currentValueRef.current > 0) {
      const now = Date.now();
      const timeSinceLastChange = now - lastChangeTimeRef.current;
      
      if (timeSinceLastChange < 500) {
        // Mantener el valor actual en lugar de cambiar a 0
        return;
      }
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastChangeTimeRef.current;

    // Si el cambio es muy rápido (menos de 100ms), guardarlo como pendiente
    // pero no animar todavía - esperar a que se estabilice
    if (timeSinceLastChange < 100 && previousValueRef.current !== null) {
      pendingValueRef.current = numValue;
      
      // Programar una verificación después de un breve delay
      const timeoutId = setTimeout(() => {
        if (pendingValueRef.current === numValue && pendingValueRef.current !== null) {
          // El valor se mantuvo estable, proceder con la animación
          pendingValueRef.current = null;
          lastChangeTimeRef.current = Date.now();
          
          // Cancelar animación anterior si existe
          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          const startValue = currentValueRef.current;
          const endValue = numValue;
          previousValueRef.current = numValue;
          const startTime = Date.now();

          const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (endValue - startValue) * easeOut;

            setDisplayValue(currentValue);
            currentValueRef.current = currentValue;

            if (progress < 1) {
              animationFrameRef.current = requestAnimationFrame(animate);
            } else {
              animationFrameRef.current = null;
              setDisplayValue(endValue);
              currentValueRef.current = endValue;
            }
          };

          animationFrameRef.current = requestAnimationFrame(animate);
        }
      }, 150);

      return () => clearTimeout(timeoutId);
    }

    // Si el cambio no es muy rápido, proceder normalmente
    lastChangeTimeRef.current = now;
    pendingValueRef.current = null;

    // Cancelar animación anterior si existe
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Usar el valor actual del ref en lugar del estado (más estable)
    const startValue = currentValueRef.current;
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

      // Actualizar tanto el estado como el ref
      setDisplayValue(currentValue);
      currentValueRef.current = currentValue;

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        animationFrameRef.current = null;
        // Asegurar que termine en el valor exacto
        setDisplayValue(endValue);
        currentValueRef.current = endValue;
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

export default AnimatedNumber;
