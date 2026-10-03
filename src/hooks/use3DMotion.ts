import { useState, useEffect, useRef } from 'react';
export interface TiltState { x: number; y: number }
const ZERO: TiltState = { x: 0, y: 0 };
export function use3DMotion(enabled = true): { tilt: TiltState; ref: React.RefObject<HTMLDivElement> } {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>(ZERO);
  useEffect(() => {
    const element = ref.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, disposed = false;
    let current = ZERO, target = ZERO;
    function tick() {
      frame = 0;
      if (disposed) return;
      const dx = target.x - current.x, dy = target.y - current.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.002) { current = target; setTilt(current); return; }
      current = { x: current.x + dx * 0.12, y: current.y + dy * 0.12 };
      setTilt(current);
      frame = requestAnimationFrame(tick);
    }
    function wake() { if (!frame && !disposed) frame = requestAnimationFrame(tick); }
    function reset() { target = ZERO; wake(); }
    function move(event: PointerEvent) {
      if (!enabled || reduced.matches || document.hidden || event.pointerType !== 'mouse' || !element) return;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) return;
      target = {
        x: Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / box.width)),
        y: Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / box.height)),
      }; wake();
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; target = current = ZERO; setTilt(ZERO); }
    function preferenceChanged() { if (reduced.matches) stop(); }
    function visibilityChanged() { if (document.hidden) stop(); }
    setTilt(ZERO);
    if (enabled && element) {
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerleave', reset);
      reduced.addEventListener('change', preferenceChanged);
      document.addEventListener('visibilitychange', visibilityChanged);
    }
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      element?.removeEventListener('pointermove', move);
      element?.removeEventListener('pointerleave', reset);
      reduced.removeEventListener('change', preferenceChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [enabled]);
  return { tilt, ref };
}
