import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import './EmmaStanding.css';

const ARTWORK = '/assets/emma/design/emma-standing-board-style-v2.png';
const WAVE = '/assets/emma/design/emma-standing-wave-v2.png';
type IdleGesture = 'lean-left' | 'lean-right' | 'nod';

export default function EmmaFullBodyIllustration({ expression = 'happy', greetOnArrival = false }: { expression?: AvatarExpression; greetOnArrival?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [waveReady, setWaveReady] = useState(false);
  const [idleGesture, setIdleGesture] = useState<IdleGesture | null>(null);
  const previousGesture = useRef<IdleGesture | 'wave' | null>(null);
  const hasIdled = useRef(false);
  const arrived = useRef(false);
  const id = useId();
  const greetingTimer = useRef<number>();
  useEffect(() => {
    const image = new Image();
    image.onload = () => setWaveReady(true);
    image.src = WAVE;
    return () => { image.onload = null; };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setUnavailable(document.hidden || media.matches);
      setGreeting(false);
      setIdleGesture(null);
      window.clearTimeout(greetingTimer.current);
    };
    update();
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
      window.clearTimeout(greetingTimer.current);
    };
  }, []);
  const moving = !paused && !unavailable;
  const sayHi = useCallback(() => {
    if (!moving || !waveReady) return;
    window.clearTimeout(greetingTimer.current);
    setIdleGesture(null);
    setGreeting(true);
    greetingTimer.current = window.setTimeout(() => setGreeting(false), 2400);
  }, [moving, waveReady]);
  useEffect(() => {
    if (!greetOnArrival || !waveReady || !moving || arrived.current) return;
    const timer = window.setTimeout(() => { arrived.current = true; sayHi(); }, 300);
    return () => window.clearTimeout(timer);
  }, [greetOnArrival, waveReady, moving, sayHi]);
  useEffect(() => {
    if (!moving || greeting) return;
    let next: number;
    let finish: number;
    const schedule = () => {
      next = window.setTimeout(() => {
        if (document.hidden) { schedule(); return; }
        hasIdled.current = true;
        const gestures: (IdleGesture | 'wave')[] = ['lean-left', 'lean-right', 'nod', ...(waveReady ? ['wave' as const] : [])];
        const choices = gestures.filter(gesture => gesture !== previousGesture.current);
        const gesture = choices[Math.floor(Math.random() * choices.length)];
        previousGesture.current = gesture;
        if (gesture === 'wave') { sayHi(); return; }
        setIdleGesture(gesture);
        finish = window.setTimeout(() => { setIdleGesture(null); schedule(); }, gesture === 'nod' ? 2200 : 3400);
      }, hasIdled.current ? 12000 + Math.random() * 12000 : 5000 + Math.random() * 3000);
    };
    schedule();
    return () => { window.clearTimeout(next); window.clearTimeout(finish); setIdleGesture(null); };
  }, [moving, greeting, waveReady, sayHi]);
  return <div className={`emma-standing ${moving ? 'emma-standing--moving' : ''}`} data-expression={expression}>
    <button type="button" className="emma-standing__art" aria-label="Say hi to Emma" title="Tap Emma for a friendly wave" onClick={sayHi}>
      <svg viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMax meet" role="img" aria-label="Emma standing in her lavender sweatshirt, blue jeans and white tennis shoes">
        <defs>
          <clipPath id={`${id}-head`}><rect width="645" height="315" /></clipPath>
          <clipPath id={`${id}-wave-body`}><path d="M0 315H645V0H1024V1536H0Z" /></clipPath>
          <clipPath id={`${id}-hand`}><rect x="660" y="190" width="150" height="224" /></clipPath>
          <mask id={`${id}-without-hand`} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536"><rect width="1024" height="1536" fill="white" /><rect x="660" y="190" width="150" height="216" fill="black" /></mask>
        </defs>
        <g className="emma-standing__sway">
          <g className="emma-standing__breathing">
            <g className={idleGesture && moving ? `emma-standing__${idleGesture}` : undefined} data-idle-gesture={idleGesture ?? 'rest'}>
              <g className={`emma-standing__rest-pose ${greeting && moving ? '' : 'emma-standing__pose-visible'}`} clipPath={`url(#${id}-wave-body)`}><image href={ARTWORK} width="1024" height="1536" /></g>
              {waveReady && <g className={`emma-standing__wave-pose ${greeting && moving ? 'emma-standing__pose-visible' : ''}`} data-wave={greeting && moving ? 'active' : 'rest'}>
                <g clipPath={`url(#${id}-wave-body)`} mask={`url(#${id}-without-hand)`}><image href={WAVE} width="1024" height="1536" /></g>
                <g className={`emma-standing__wave-hand ${greeting && moving ? 'emma-standing__wave-hand-active' : ''}`}><g clipPath={`url(#${id}-hand)`}><image href={WAVE} width="1024" height="1536" /></g></g>
              </g>}
              <g className="emma-standing__head">
                <g clipPath={`url(#${id}-head)`}><image href={ARTWORK} width="1024" height="1536" /></g>
              {/* Lids overlay the original eyes; the rest of the face never swaps. */}
              <g className="emma-standing__blink">
                <path d="M450 204 Q473 181 497 199 Q474 220 450 204Z" fill="#ffbb7b" />
                <path d="M453 201 Q475 213 493 200" fill="none" stroke="#3d211b" strokeWidth="3" strokeLinecap="round" />
                <path d="M519 191 Q530 164 563 175 Q550 199 519 191Z" fill="#ffbb7b" />
                <path d="M523 187 Q544 196 559 177" fill="none" stroke="#3d211b" strokeWidth="3" strokeLinecap="round" />
              </g>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </button>
    <button type="button" className="emma-standing__pause" aria-pressed={paused} onClick={() => { setPaused(value => !value); setGreeting(false); setIdleGesture(null); window.clearTimeout(greetingTimer.current); }}>
      {paused ? 'Resume motion' : 'Pause motion'}
    </button>
  </div>;
}
