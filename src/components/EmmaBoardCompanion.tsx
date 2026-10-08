import { useEffect, useRef, useState } from 'react';
import './EmmaBoardCompanion.css';

export default function EmmaBoardCompanion({ typing, morning, noteCount }: { typing: boolean; morning: boolean; noteCount: number }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sip, setSip] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const previousCount = useRef(noteCount);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const added = noteCount > previousCount.current;
    previousCount.current = noteCount;
    if (!added || paused || reduced) return;
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 900);
    return () => { window.clearTimeout(timer); setCelebrate(false); };
  }, [noteCount, paused, reduced]);
  useEffect(() => {
    setSip(false);
    if (typing || paused || reduced) return;
    let finish: number | undefined;
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setSip(true);
      finish = window.setTimeout(() => setSip(false), 2600);
    }, 30000);
    return () => { window.clearInterval(interval); window.clearTimeout(finish); };
  }, [typing, paused, reduced]);
  const state = paused || reduced ? 'idle' : typing ? 'writing' : sip ? 'sipping' : 'idle';
  const poses = {
    idle: `/characters/board/emma-seated-${morning ? 'morning' : 'afternoon'}.png`,
    writing: '/characters/board/emma-water-writing.png',
    sipping: '/characters/board/emma-water-sip.png',
  };
  return <div className="shrink-0 w-36 sm:w-48">
    <div className={`emma-board-stage ${paused || reduced ? '' : celebrate ? 'emma-board-celebrate' : `emma-board-${state}`}`} role="img" aria-label={`Emma sitting cross-legged, ${state === 'writing' ? 'writing in her notepad' : state === 'sipping' ? 'taking a water break' : morning ? 'with her morning coffee' : 'with her iced drink'}`}>
      {Object.entries(poses).map(([pose, src]) => <img key={pose} src={src} alt="" aria-hidden="true" draggable={false} className={`emma-board-pose ${pose === state ? 'emma-board-pose-active' : ''}`} />)}
    </div>
    <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} className="w-full min-h-11 text-xs text-violet-600 rounded-lg focus-visible:ring-2">{paused ? 'Resume Emma’s motion' : 'Pause Emma’s motion'}</button>
  </div>;
}
