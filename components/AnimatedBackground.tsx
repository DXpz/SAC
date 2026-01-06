import React, { useEffect, useRef } from 'react';

const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      baseOpacity: number;
      glowIntensity: number;
      glowPhase: number;
    }

    const particles: Particle[] = [];
    const particleCount = 50; // Número reducido para mejor rendimiento en login
    const connectionDistance = 100; // Distancia reducida para menos conexiones

    // Crear partículas
    for (let i = 0; i < particleCount; i++) {
      const baseOpacity = Math.random() * 0.5 + 0.3;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8, // Movimiento más lento para ahorrar recursos
        vy: (Math.random() - 0.5) * 0.8, // Movimiento más lento para ahorrar recursos
        radius: Math.random() * 1.5 + 0.5, // Puntos más finos
        opacity: baseOpacity,
        baseOpacity: baseOpacity,
        glowIntensity: Math.random() * 0.2 + 0.15, // Variación más sutil para neón
        glowPhase: Math.random() * Math.PI * 2, // Fase inicial aleatoria para variar el destello
      });
    }

    let frameCount = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;

      // Actualizar y dibujar partículas (optimizado)
      particles.forEach((particle, i) => {
        // Movimiento simplificado (sin variaciones complejas para mejor rendimiento)
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Rebote en bordes (simplificado)
        if (particle.x < 0 || particle.x > canvas.width) {
          particle.vx *= -1;
        }
        if (particle.y < 0 || particle.y > canvas.height) {
          particle.vy *= -1;
        }

        // Calcular efecto de destello neón (optimizado: menos cálculos)
        const time = frameCount * 0.01; // Velocidad del destello (más lento para ahorrar recursos)
        const glowVariation = Math.sin(time + particle.glowPhase) * particle.glowIntensity;
        // Mantener opacidad más alta para efecto neón más brillante
        particle.opacity = Math.max(0.5, Math.min(1.0, particle.baseOpacity + 0.3 + glowVariation));

        // Dibujar partícula con efecto neón (optimizado: menos capas)
        ctx.save();
        
        // Capa 1: Glow exterior (combinado para mejor rendimiento)
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(200, 21, 27, ${particle.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 21, 27, ${particle.opacity * 0.5})`;
        ctx.fill();
        
        // Capa 2: Núcleo brillante (combinado)
        ctx.shadowBlur = 6;
        ctx.shadowColor = `rgba(240, 50, 60, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 50, 60, ${Math.min(1.0, particle.opacity * 1.2)})`;
        ctx.fill();
        
        ctx.restore();

        // Dibujar conexiones con efecto neón (optimizado para rendimiento)
        // Solo verificar conexiones con partículas cercanas (optimización)
        const nearbyParticles = particles.slice(i + 1).filter(otherParticle => {
          const dx = Math.abs(particle.x - otherParticle.x);
          const dy = Math.abs(particle.y - otherParticle.y);
          // Verificación rápida de distancia (evita calcular sqrt si está muy lejos)
          return (dx < connectionDistance && dy < connectionDistance);
        });

        nearbyParticles.forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Solo conectar si están relativamente cerca
          if (distance < connectionDistance) {
            // Calcular opacidad basada en distancia (más suave)
            const normalizedDistance = distance / connectionDistance;
            const baseOpacity = Math.pow(1 - normalizedDistance, 1.5); // Curva más suave
            const lineOpacity = Math.max(0, Math.min(1, baseOpacity * 0.6));
            
            // Solo dibujar si la opacidad es suficiente para ser visible
            if (lineOpacity > 0.1) {
              ctx.save();
              
              // Capa 1: Glow exterior (optimizado: menos capas)
              ctx.shadowBlur = 10;
              ctx.shadowColor = `rgba(200, 21, 27, ${lineOpacity * 0.6})`;
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.strokeStyle = `rgba(200, 21, 27, ${lineOpacity * 0.5})`;
              ctx.lineWidth = 1.8;
              ctx.stroke();
              
              // Capa 2: Línea principal brillante (combinado)
              ctx.shadowBlur = 4;
              ctx.shadowColor = `rgba(240, 50, 60, ${lineOpacity})`;
              ctx.beginPath();
              ctx.moveTo(particle.x, particle.y);
              ctx.lineTo(otherParticle.x, otherParticle.y);
              ctx.strokeStyle = `rgba(240, 50, 60, ${lineOpacity})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
              
              ctx.restore();
            }
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ 
        background: 'radial-gradient(ellipse at top, rgba(40, 0, 0, 0.4), transparent 60%), radial-gradient(ellipse at bottom right, rgba(20, 0, 0, 0.3), transparent 60%), #000000',
          }}
        />
  );
};

export default AnimatedBackground;
