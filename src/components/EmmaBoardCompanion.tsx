import { useEffect, useRef, useState } from 'react';
import './EmmaBoardCompanion.css';

// Eyelids use each pose's original 1024 × 1536 coordinates, so they stay
// aligned with the face as the illustration scales and breathes.
const eyelids = {
  morning: [
    ['M384 392 Q422 354 464 387 Q424 421 384 392Z', 'M387 389 Q426 409 461 387'],
    ['M517 365 Q532 319 587 324 Q571 366 517 365Z', 'M520 354 Q555 354 582 328'],
  ],
  afternoon: [
    ['M382 379 Q421 342 465 371 Q429 405 382 379Z', 'M386 374 Q425 394 461 371'],
    ['M518 347 Q534 300 589 310 Q572 352 518 347Z', 'M522 338 Q559 340 584 313'],
  ],
  writing: [
    ['M410 411 Q450 395 491 410 Q463 446 410 411Z', 'M414 416 Q453 433 486 414'],
    ['M539 385 Q558 357 600 348 Q587 395 539 385Z', 'M544 382 Q574 389 595 358'],
  ],
  sipping: [
    ['M410 360 Q450 325 493 349 Q463 387 410 360Z', 'M415 357 Q455 376 489 351'],
    ['M540 328 Q550 283 601 291 Q588 331 540 328Z', 'M544 317 Q577 323 596 295'],
  ],
};

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
  return <div className="emma-board-companion">
    <div className={`emma-board-stage ${paused || reduced ? '' : `emma-board-motion ${celebrate ? 'emma-board-celebrate' : `emma-board-${state}`}`}`} role="img" aria-label={`Emma sitting cross-legged, ${state === 'writing' ? 'writing in her notepad' : state === 'sipping' ? 'taking a water break' : morning ? 'with her morning coffee' : 'with her iced drink'}`}>
      {Object.entries(poses).map(([pose, src]) => <div key={pose} className={`emma-board-pose ${pose === state ? 'emma-board-pose-active' : ''}`} aria-hidden="true">
        <img src={src} alt="" draggable={false} />
        <svg className="emma-board-eyelids" viewBox="0 0 1024 1536" focusable="false" aria-hidden="true">
          <g className="emma-board-blink">
            {eyelids[pose === 'idle' ? morning ? 'morning' : 'afternoon' : pose as 'writing' | 'sipping'].map(([skin, lash], index) => <g key={index}>
              <path d={skin} fill="#ffbb7b" />
              <path d={lash} fill="none" stroke="#3d211b" strokeWidth="5" strokeLinecap="round" />
            </g>)}
          </g>
        </svg>
      </div>)}
    </div>
    <button type="button" aria-pressed={paused} onClick={() => setPaused(value => !value)} className="w-full min-h-11 text-xs text-violet-600 rounded-lg focus-visible:ring-2">{paused ? 'Resume Emma’s motion' : 'Pause Emma’s motion'}</button>
  </div>;
}
