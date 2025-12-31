import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
}

const Carousel: React.FC<CarouselProps> = ({
  children,
  autoPlay = false,
  interval = 5000,
  showDots = true,
  showArrows = true,
  className = ''
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (autoPlay && children.length > 1) {
      const timer = setInterval(() => {
        nextSlide();
      }, interval);
      return () => clearInterval(timer);
    }
  }, [autoPlay, interval, currentIndex, children.length]);

  const nextSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % children.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const prevSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + children.length) % children.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  if (children.length === 0) return null;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <div 
        className="flex transition-transform duration-300 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {children.map((child, index) => (
          <div key={index} className="min-w-full flex-shrink-0">
            {child}
          </div>
        ))}
      </div>

      {showArrows && children.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-200 z-10 hover:scale-110"
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderColor: 'rgba(148, 163, 184, 0.2)',
              border: '1px solid'
            }}
            onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
            }}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-200 z-10 hover:scale-110"
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              borderColor: 'rgba(148, 163, 184, 0.2)',
              border: '1px solid'
            }}
            onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
            }}
            aria-label="Slide siguiente"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {showDots && children.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {children.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: index === currentIndex ? '2rem' : '0.5rem',
                backgroundColor: index === currentIndex ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)',
                boxShadow: index === currentIndex ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.75)';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentIndex) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                }
              }}
              aria-label={`Ir al slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Carousel;
