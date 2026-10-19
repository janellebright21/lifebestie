import { useState } from 'react';
import { Pause, Play, Gauge } from 'lucide-react';
import type { MovementActivity } from '../hooks/useMovement';

export type Motion = 'squat' | 'walk' | 'reach' | 'push' | 'row' | 'march' | 'rest' | 'calf' | 'ankle' | 'hip' | 'shoulders' | 'pull-apart';
function motionFor(id: string): Motion {
  if (id === 'mod-bodyweight' || id === 'high-strength' || id === 'high-full') return 'squat';
  if (id === 'low-stretch' || id === 'low-mobility') return 'reach';
  if (id === 'mod-bands') return 'row';
  if (id === 'high-cardio' || id === 'mod-fastwalk' || id === 'low-walk') return 'walk';
  return 'push';
}

/**
 * Lightweight SVG demonstration, independent of Emma's character assets.
 * These are illustrative motions, not individualized form assessments.
 */
export default function StickFigureDemo({ activity, motion, caption }: { activity: MovementActivity; motion?: Motion; caption?: string }) {
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const selectedMotion = motion ?? motionFor(activity.id);
  const duration = slow ? '3.6s' : '1.8s';
  const animation = (name: string) => ({
    animation: `${name} ${duration} ease-in-out infinite`,
    animationPlayState: playing ? 'running' as const : 'paused' as const,
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3 space-y-3">
      <style>{`
        @keyframes bestie-squat {0%,100%{transform:translateY(0)} 50%{transform:translateY(23px)}}
        @keyframes bestie-knees {0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-24deg)}}
        @keyframes bestie-walk-a {0%,100%{transform:rotate(25deg)} 50%{transform:rotate(-25deg)}}
        @keyframes bestie-walk-b {0%,100%{transform:rotate(-25deg)} 50%{transform:rotate(25deg)}}
        @keyframes bestie-reach {0%,100%{transform:rotate(0deg)} 50%{transform:rotate(-40deg)}}
        @keyframes bestie-push {0%,100%{transform:translateX(0)} 50%{transform:translateX(18px)}}
        @keyframes bestie-march {0%,100%{transform:rotate(22deg)} 50%{transform:rotate(-22deg)}}
        @keyframes bestie-row {0%,100%{transform:translateX(0)} 50%{transform:translateX(-16px)}}
      `}</style>
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold text-slate-600">Movement preview</p>
        <span className="text-[11px] text-slate-500">{caption ?? selectedMotion.replace('-', ' ')}</span>
      </div>
      {selectedMotion === 'rest' && <p className="text-xs text-slate-600 text-center">Preparation or recovery step — follow the instructions above.</p>}
      <svg viewBox="0 0 280 180" role="img" aria-label={`Animated stick-figure ${selectedMotion} demonstration for ${activity.label}`} className="w-full h-44">
        <line x1="18" y1="162" x2="262" y2="162" stroke="#cbd5e1" strokeWidth="2" />
        {selectedMotion === 'push' && <line x1="226" y1="15" x2="226" y2="162" stroke="#94a3b8" strokeWidth="5" />}
        <g stroke="#334155" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {selectedMotion === 'squat' ? (
            <g style={animation('bestie-squat')}>
              <circle cx="140" cy="39" r="14" fill="#fff" />
              <path d="M140 53 L140 105 M140 70 L114 92 L99 83 M140 70 L165 92 L180 83" />
              <path d="M140 105 L117 137 L111 155 M140 105 L164 137 L170 155" />
            </g>
          ) : (selectedMotion === 'walk' || selectedMotion === 'march') ? (
            <g>
              <circle cx="140" cy="38" r="14" fill="#fff" />
              <path d="M140 52 L140 108" />
              <g style={{transformOrigin:'140px 71px',...animation(selectedMotion === 'march' ? 'bestie-march' : 'bestie-walk-a')}}><path d="M140 71 L120 101" /></g>
              <g style={{transformOrigin:'140px 71px',...animation(selectedMotion === 'march' ? 'bestie-march' : 'bestie-walk-b')}}><path d="M140 71 L160 101" /></g>
              <g style={{transformOrigin:'140px 108px',...animation('bestie-walk-a')}}><path d="M140 108 L140 151" /></g>
              <g style={{transformOrigin:'140px 108px',...animation('bestie-walk-b')}}><path d="M140 108 L140 151" /></g>
            </g>
          ) : selectedMotion === 'reach' ? (
            <g>
              <circle cx="140" cy="38" r="14" fill="#fff" />
              <path d="M140 52 L140 108 M140 108 L122 154 M140 108 L158 154 M140 72 L160 105" />
              <g style={{transformOrigin:'140px 72px',...animation('bestie-reach')}}><path d="M140 72 L110 40" /></g>
            </g>
          ) : (
            <g>
              <circle cx="120" cy="38" r="14" fill="#fff" />
              <path d="M120 52 L120 108 M120 108 L105 155 M120 108 L137 155" />
              <g style={animation(selectedMotion === 'row' ? 'bestie-row' : 'bestie-push')}>
                <path d="M120 70 L150 78 L183 78 M120 70 L150 94 L183 94" />
              </g>
              {selectedMotion === 'row' && <path d="M183 78 L214 86 L183 94" stroke="#e11d48" strokeWidth="2" />}
            </g>
          )}
        </g>
      </svg>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause demonstration' : 'Play demonstration'} className="flex-1 rounded-xl bg-white border border-slate-200 text-slate-700 py-2 flex items-center justify-center gap-2 text-xs font-semibold">{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => setSlow(v => !v)} aria-pressed={slow} className="flex-1 rounded-xl bg-white border border-slate-200 text-slate-700 py-2 flex items-center justify-center gap-2 text-xs font-semibold"><Gauge size={15}/>{slow ? 'Slow · On' : 'Slow down'}</button>
      </div>
      <p className="text-[11px] text-slate-500">Simplified illustrative motion. Follow the written step for positioning and technique; this preview cannot verify your form.</p>
    </div>
  );
}
