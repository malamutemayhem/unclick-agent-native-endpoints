import { useEffect, useRef, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

const STATIC_BG = 'bg-[#0a0a0a]';

export default function VantaWavesBackground({ children }: Props) {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaEffect = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowPower =
      (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) ||
      window.innerWidth < 768;

    if (reducedMotion || lowPower) return;

    let cancelled = false;

    Promise.all([
      import('three'),
      import('vanta/dist/vanta.waves.min'),
    ]).then(([THREE, VANTA_MOD]) => {
      if (cancelled || !vantaRef.current) return;
      const VANTA = (VANTA_MOD as any).default ?? VANTA_MOD;
      // @ts-ignore
      window.THREE = THREE;
      vantaEffect.current = VANTA({
        el: vantaRef.current,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x0a0a0a,
        shininess: 11.00,
        waveHeight: 5.00,
        waveSpeed: 0.65,
        zoom: 0.85,
        THREE,
      });
    });

    return () => {
      cancelled = true;
      if (vantaEffect.current) {
        vantaEffect.current.destroy();
        vantaEffect.current = null;
      }
    };
  }, []);

  return (
    <div ref={vantaRef} className={`relative min-h-screen ${STATIC_BG}`}>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
