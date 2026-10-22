import { useState } from 'react';
import { Pause, Play, Gauge } from 'lucide-react';
import type { MovementActivity } from '../hooks/useMovement';

export type Motion = 'walk' | 'march' | 'reach' | 'squat' | 'push' | 'row';

export default function StickFigureDemo({ activity, motion, caption }: {
  activity: MovementActivity;
  motion: Motion;
  caption: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const animation = (name: string, seconds = 2) => ({
    animation: `${name} ${seconds * (slow ? 2 : 1)}s ease-in-out infinite`,
    animationPlayState: playing ? 'running' as const : 'paused' as const,
  });
  const line = { stroke: '#334155', strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3 space-y-3">
      <style>{`
        @keyframes bestie-step-a { 0%,100% { transform: rotate(24deg) } 50% { transform: rotate(-24deg) } }
        @keyframes bestie-step-b { 0%,100% { transform: rotate(-24deg) } 50% { transform: rotate(24deg) } }
        @keyframes bestie-squat-body { 0%,100% { transform: translateY(0) } 50% { transform: translateY(14px) } }
        @keyframes bestie-reach-arm { 0%,100% { transform: rotate(0deg) } 50% { transform: rotate(-32deg) } }
        @keyframes bestie-push-body { 0%,100% { transform: translateX(0) } 50% { transform: translateX(15px) } }
        @keyframes bestie-row-elbow { 0%,100% { transform: translateX(0) } 50% { transform: translateX(-20px) } }
      `}</style>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-600">Movement preview</p>
        <p className="text-[11px] text-slate-500">{caption}</p>
      </div>
      <svg viewBox="0 0 280 180" role="img" aria-label={`Illustrative ${caption} animation for ${activity.label}`} className="w-full h-44">
        <path d="M18 164 H262" stroke="#cbd5e1" strokeWidth="2"/>
        {(motion === 'walk' || motion === 'march') && (
          <g fill="none" {...line}>
            <circle cx="140" cy="37" r="13" fill="#fff"/>
            <path d="M140 50 V108"/>
            <g style={{ transformOrigin: '140px 70px', ...animation('bestie-step-a', motion === 'march' ? 1.6 : 2.2) }}><path d="M140 70 L140 101"/></g>
            <g style={{ transformOrigin: '140px 70px', ...animation('bestie-step-b', motion === 'march' ? 1.6 : 2.2) }}><path d="M140 70 L140 101"/></g>
            <g style={{ transformOrigin: '140px 108px', ...animation('bestie-step-b', motion === 'march' ? 1.6 : 2.2) }}><path d="M140 108 V150"/></g>
            <g style={{ transformOrigin: '140px 108px', ...animation('bestie-step-a', motion === 'march' ? 1.6 : 2.2) }}><path d="M140 108 V150"/></g>
          </g>
        )}
        {motion === 'reach' && (
          <g fill="none" {...line}>
            <circle cx="140" cy="37" r="13" fill="#fff"/>
            <path d="M140 50 V107 L121 157 M140 107 L160 157 M140 70 L165 104"/>
            <g style={{ transformOrigin: '140px 70px', ...animation('bestie-reach-arm', 3.2) }}><path d="M140 70 L115 38"/></g>
          </g>
        )}
        {motion === 'squat' && (
          <g fill="none" {...line}>
            <path d="M90 117 H105 V160 M90 117 V160" stroke="#94a3b8" strokeWidth="3"/>
            <g style={animation('bestie-squat-body', 3)}>
              <circle cx="140" cy="37" r="13" fill="#fff"/>
              <path d="M140 50 L140 95 M140 65 L114 88 M140 65 L164 88"/>
            </g>
            <path d="M140 109 L117 132 L114 158 M140 109 L166 132 L170 158"/>
          </g>
        )}
        {motion === 'push' && (
          <g fill="none" {...line}>
            <path d="M222 14 V164" stroke="#94a3b8" strokeWidth="5"/>
            <g style={animation('bestie-push-body', 3)}>
              <circle cx="112" cy="39" r="13" fill="#fff"/>
              <path d="M112 52 L124 104 L106 158 M124 104 L147 158 M117 75 L165 70 L204 70 M117 75 L165 91 L204 91"/>
            </g>
          </g>
        )}
        {motion === 'row' && (
          <g fill="none" {...line}>
            <path d="M100 145 H180" stroke="#94a3b8" strokeWidth="4"/>
            <circle cx="123" cy="34" r="13" fill="#fff"/>
            <path d="M123 47 V113 L104 145 M123 113 L145 145"/>
            <g style={animation('bestie-row-elbow', 3)}><path d="M123 72 L161 84 L188 84 M123 82 L161 96 L188 96"/></g>
            <path d="M188 84 L231 90 L188 96" stroke="#e11d48" strokeWidth="2"/>
          </g>
        )}
      </svg>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause demonstration' : 'Play demonstration'} className="flex-1 rounded-xl bg-white border border-slate-200 text-slate-700 py-2 flex items-center justify-center gap-2 text-xs font-semibold">{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause' : 'Play'}</button>
        <button type="button" onClick={() => setSlow(v => !v)} aria-pressed={slow} className="flex-1 rounded-xl bg-white border border-slate-200 text-slate-700 py-2 flex items-center justify-center gap-2 text-xs font-semibold"><Gauge size={15}/>{slow ? 'Slow · On' : 'Slow down'}</button>
      </div>
      <p className="text-[11px] text-slate-500">Illustrative preview only; it cannot assess form. Use the step instructions for technique and positioning.</p>
    </div>
  );
}
