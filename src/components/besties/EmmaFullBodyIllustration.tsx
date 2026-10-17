import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import EmmaRigCanvas from './EmmaRigCanvas';
import type { IdleGesture } from './emmaRigMotion';
import './EmmaStanding.css';

export default function EmmaFullBodyIllustration({ expression = 'happy', greetOnArrival = false }: { expression?: AvatarExpression; greetOnArrival?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [ready, setReady] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [idleGesture, setIdleGesture] = useState<IdleGesture | null>(null);
  const [idleTick, setIdleTick] = useState(0);
  const previousGesture = useRef<IdleGesture | null>(null);
  const hasIdled = useRef(false);
  const arrived = useRef(false);
  const idleCount = useRef(0);
  const onReady = useCallback(() => setReady(true), []);
  const finishWave = useCallback(() => setGreeting(false), []);
  const finishIdle = useCallback(() => setIdleGesture(null), []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReduced(media.matches);
      if (media.matches) {
        arrived.current = true;
        setGreeting(false);
        setIdleGesture(null);
      }
    };
    const updateVisibility = () => setVisible(!document.hidden);
    updateMotion();
    document.addEventListener('visibilitychange', updateVisibility);
    media.addEventListener('change', updateMotion);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      media.removeEventListener('change', updateMotion);
    };
  }, []);
  const moving = !paused && !reduced && visible;
  useEffect(() => {
    if (!greetOnArrival || !ready || !moving || arrived.current) return;
    const timer = window.setTimeout(() => {
      arrived.current = true;
      setIdleGesture(null);
      setGreeting(true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [greetOnArrival, ready, moving]);
  useEffect(() => {
    if (!ready || !moving || greeting || idleGesture) return;
    const skipChance = idleCount.current > 0 && idleCount.current % 3 === 0 ? 0.35 : 0.12;
    const willSkip = Math.random() < skipChance;
    const timer = window.setTimeout(() => {
      hasIdled.current = true;
      idleCount.current += 1;
      if (willSkip) {
        // Bump the tick to retrigger this effect for the next interval,
        // without committing a gesture this cycle.
        setIdleTick(t => t + 1);
        return;
      }
      const gesture = previousGesture.current === 'weight-left' ? 'weight-right'
        : previousGesture.current === 'weight-right' ? 'weight-left'
        : Math.random() < .5 ? 'weight-left' : 'weight-right';
      previousGesture.current = gesture;
      setIdleGesture(gesture);
    }, hasIdled.current
      ? 10000 + Math.random() * 16000  // 10-26s: wider, less predictable range
      : 5000 + Math.random() * 3000);  // first gesture comes a bit sooner
    return () => window.clearTimeout(timer);
  }, [ready, moving, greeting, idleGesture, idleTick]);
  return <div className="emma-standing" data-expression={expression}>
    <div className="emma-standing__art">
      <EmmaRigCanvas moving={moving} reduced={reduced} greeting={greeting} gesture={idleGesture}
        onReady={onReady} onWaveComplete={finishWave} onIdleComplete={finishIdle} />
    </div>
    <button type="button" className="emma-standing__pause" aria-pressed={paused} onClick={() => setPaused(value => !value)}>
      {paused ? 'Resume motion' : 'Pause motion'}
    </button>
  </div>;
}
