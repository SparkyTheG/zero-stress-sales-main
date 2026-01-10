import { useEffect, useMemo, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function toFiniteNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export type AnimatedNumberProps = {
  value: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export default function AnimatedNumber({
  value,
  durationMs = 650,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const target = toFiniteNumber(value);
  const reduced = prefersReducedMotion();

  const [display, setDisplay] = useState<number>(target);
  const displayRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced || durationMs <= 0) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = displayRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      const next = from + (to - from) * eased;
      displayRef.current = next;
      setDisplay(next);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [target, durationMs, reduced]);

  const text = useMemo(() => {
    const d = Math.max(0, Math.min(6, Math.floor(decimals)));
    const factor = Math.pow(10, d);
    const rounded = Math.round(display * factor) / factor;
    return d > 0 ? rounded.toFixed(d) : String(Math.round(rounded));
  }, [display, decimals]);

  return <span className={className}>{prefix}{text}{suffix}</span>;
}

