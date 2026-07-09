import { useState, useEffect, useRef, useCallback } from 'react';

export interface TiltState {
  /** -1 to 1, negative = left */
  x: number;
  /** -1 to 1, negative = up */
  y: number;
}

const ZERO: TiltState = { x: 0, y: 0 };
const LERP = 0.08; // smoothing factor (lower = smoother but slower)

/**
 * Returns a live tilt vector driven by:
 * - Mouse position relative to a target element on desktop
 * - DeviceOrientation (gyroscope) on mobile
 *
 * Values are normalised to [-1, 1] and lerp-smoothed.
 */
export function use3DMotion(enabled = true): {
  tilt: TiltState;
  ref: React.RefObject<HTMLDivElement>;
} {
  const ref        = useRef<HTMLDivElement>(null!);
  const [tilt, setTilt] = useState<TiltState>(ZERO);
  const rawRef     = useRef<TiltState>(ZERO);
  const rafRef     = useRef<number>(0);
  const mounted    = useRef(true);

  // Lerp loop — runs at rAF rate and smooths toward rawRef target
  const startLoop = useCallback(() => {
    function loop() {
      if (!mounted.current) return;
      setTilt((prev) => {
        const nx = prev.x + (rawRef.current.x - prev.x) * LERP;
        const ny = prev.y + (rawRef.current.y - prev.y) * LERP;
        // Skip re-render if movement is negligible
        if (Math.abs(nx - prev.x) < 0.0005 && Math.abs(ny - prev.y) < 0.0005) {
          rafRef.current = requestAnimationFrame(loop);
          return prev;
        }
        rafRef.current = requestAnimationFrame(loop);
        return { x: nx, y: ny };
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) return;

    const hasOrientation = typeof DeviceOrientationEvent !== 'undefined';
    let usingGyro = false;

    // ── Gyroscope (mobile) ────────────────────────────────────────────────────
    function onOrientation(e: DeviceOrientationEvent) {
      if (e.gamma === null || e.beta === null) return;
      usingGyro = true;
      // gamma: left-right tilt (-90 to 90), beta: front-back (-180 to 180)
      rawRef.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 20)),
        y: Math.max(-1, Math.min(1, (e.beta - 30) / 25)),
      };
    }

    // ── Mouse (desktop) ───────────────────────────────────────────────────────
    function onMouse(e: MouseEvent) {
      if (usingGyro) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      // Scale by 2× rect size so full-screen movement gives max tilt
      rawRef.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width * 1.5))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height * 1.5))),
      };
    }

    // ── Pointer leave → return to zero ───────────────────────────────────────
    function onLeave() {
      if (!usingGyro) rawRef.current = ZERO;
    }

    if (hasOrientation) window.addEventListener('deviceorientation', onOrientation, true);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseleave', onLeave);

    startLoop();

    return () => {
      mounted.current = false;
      cancelAnimationFrame(rafRef.current);
      if (hasOrientation) window.removeEventListener('deviceorientation', onOrientation, true);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled, startLoop]);

  return { tilt, ref };
}
