import { useEffect, useState } from 'react';

interface ParallaxSectionProps {
  children: React.ReactNode;
  className?: string;
  bgImage?: string;
  bgOpacity?: number;
  bgGradient?: string;
  id?: string;
}

export default function ParallaxSection({
  children,
  className = '',
  bgImage,
  bgOpacity = 0.5,
  bgGradient,
  id,
}: ParallaxSectionProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <section id={id} className={`relative overflow-hidden ${className}`}>
      {bgGradient && !bgImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: bgGradient,
            backgroundAttachment: reducedMotion ? 'scroll' : 'fixed',
          }}
        />
      )}
      {bgImage && (
        <>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundAttachment: reducedMotion ? 'scroll' : 'fixed',
              filter: 'saturate(0.5) brightness(0.45)',
              opacity: bgOpacity,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.3) 50%, rgba(15,23,42,0.6) 100%)',
            }}
          />
        </>
      )}
      <div className="relative z-10">{children}</div>
    </section>
  );
}
