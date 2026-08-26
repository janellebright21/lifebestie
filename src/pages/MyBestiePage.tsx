import { useState } from 'react';
import type { ComponentProps } from 'react';
import { Heart, Sparkles, Star, TrendingUp } from 'lucide-react';
import CoreMyBestiePage from './MyBestiePageCore';
import BestieAvatar from '../components/besties/BestieAvatar';
import { CHARACTERS } from '../lib/supabase';

type MyBestiePageProps = ComponentProps<typeof CoreMyBestiePage>;
type MotionState = 'idle' | 'thinking' | 'encouraging' | 'calm' | 'celebrating';

const EXPRESSIONS = ['happy', 'thinking', 'encouraging', 'proud', 'calm'] as const;
const LAB_MOTIONS: Array<{ id: MotionState; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'thinking', label: 'Thinking' },
  { id: 'encouraging', label: 'Encouraging' },
  { id: 'calm', label: 'Calm' },
  { id: 'celebrating', label: 'Celebrate' },
];

const EMMA_MOTION_IMAGE: Record<MotionState, string> = {
  idle: '/assets/emma/expressions/emma-happy-app.png',
  thinking: '/assets/emma/expressions/emma-thinking-app.png',
  encouraging: '/assets/emma/expressions/emma-encouraging-app.png',
  calm: '/assets/emma/expressions/emma-calm-app.png',
  celebrating: '/assets/emma/expressions/emma-proud-app.png',
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function MyBestiePage(props: MyBestiePageProps) {
  const character = props.character ?? 'emma';
  const charDef = CHARACTERS.find((item) => item.id === character) ?? CHARACTERS[0]!;
  const relationship = props.relationship;
  const [labMotion, setLabMotion] = useState<MotionState>('idle');

  const greeting = props.preferredName
    ? `Hey ${props.preferredName}! I'm glad you're here.`
    : `Hey there, bestie! I'm glad you're here.`;

  return (
    <div className="bestie-profile-shell min-h-[100dvh] theme-app-bg pb-24">
      <div className="border-b px-4 pt-12 pb-4 sticky top-0 z-10" style={{ backgroundColor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-primary-light)' }}
          >
            <Heart size={18} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="bl-page-title leading-none">My Bestie</h1>
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--theme-primary)' }}>
              {charDef.name} · {relationship.levelLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        <section
          className="rounded-3xl overflow-hidden border shadow-sm"
          style={{
            borderColor: 'var(--theme-primary-mid)',
            background: 'linear-gradient(135deg, var(--theme-primary-light) 0%, rgba(255,255,255,0.96) 72%)',
          }}
        >
          <div className="px-5 pt-5 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-primary)' }}>
                {charDef.role}
              </p>
              <h2 className="text-xl font-bold text-gray-800 mt-1">{greeting}</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{charDef.tagline}</p>
              <p className="text-xs italic mt-2 leading-relaxed" style={{ color: 'var(--theme-primary)' }}>
                “{charDef.catchphrase}”
              </p>
            </div>
            <div className="shrink-0 -mr-2 -mt-2 min-w-[140px] flex justify-end">
              {character === 'emma' ? (
                <div className={`emma-motion-prototype emma-motion-${labMotion}`}>
                  <img
                    src={EMMA_MOTION_IMAGE[labMotion]}
                    alt={`Emma ${labMotion}`}
                    className="emma-motion-image"
                    draggable={false}
                  />
                </div>
              ) : (
                <BestieAvatar characterId={character} expression="happy" size="full" enable3D={false} />
              )}
            </div>
          </div>

          <div className="px-5 pb-5 pt-3">
            <div className="rounded-2xl bg-white/80 border px-4 py-4" style={{ borderColor: 'var(--theme-primary-mid)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bestie level</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{relationship.levelLabel}</p>
                </div>
                <div
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}
                >
                  <Star size={11} fill="currentColor" />
                  {relationship.score} pts
                </div>
              </div>

              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--theme-primary-light)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${relationship.progressToNext}%`, backgroundColor: 'var(--theme-primary)' }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 mt-2">
                <p className="text-[10px] text-gray-400">Growing together</p>
                {relationship.nextLevelLabel ? (
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--theme-primary)' }}>
                    <TrendingUp size={9} className="inline mr-0.5 -mt-px" />
                    {relationship.pointsToNext} pts to {relationship.nextLevelLabel}
                  </p>
                ) : (
                  <p className="text-[10px] font-semibold" style={{ color: 'var(--theme-primary)' }}>Top level</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {character === 'emma' && (
          <section
            className="bg-white rounded-3xl border shadow-sm px-4 py-4"
            style={{ borderColor: 'var(--theme-primary-mid)' }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--theme-primary)' }}>
                  Motion Prototype · Stable
                </p>
                <p className="text-xs text-gray-400 mt-1">Known-good Emma images with reliable motion states</p>
              </div>
              <Sparkles size={16} style={{ color: 'var(--theme-primary)' }} />
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(34,197,94,.12)', color: 'rgb(21,128,61)' }}>
                No layered assets required
              </span>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}>
                Blink: deferred to true rig
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {LAB_MOTIONS.map((motion) => {
                const active = labMotion === motion.id;
                return (
                  <button
                    key={motion.id}
                    type="button"
                    onClick={() => setLabMotion(motion.id)}
                    className="text-[11px] font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95"
                    style={{
                      borderColor: active ? 'var(--theme-primary)' : 'var(--theme-primary-mid)',
                      backgroundColor: active ? 'var(--theme-primary)' : 'var(--theme-primary-light)',
                      color: active ? 'white' : 'var(--theme-primary)',
                    }}
                  >
                    {motion.label}
                  </button>
                );
              })}
            </div>

            <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
              This prototype intentionally stops using the unreliable body/head layer files. First we are validating Emma's motion personality and expression changes. True independent blinking, hair and arm motion will be rebuilt as a separate rig after this visual behavior is approved.
            </p>
          </section>
        )}

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Expressions</p>
              <p className="text-xs text-gray-400 mt-1">How {charDef.name} shows up in different moments</p>
            </div>
            <Sparkles size={16} style={{ color: 'var(--theme-primary)' }} />
          </div>

          <div className="grid grid-cols-5 gap-2">
            {EXPRESSIONS.map((expression) => (
              <div key={expression} className="flex flex-col items-center gap-1.5 min-w-0">
                <div className="rounded-full p-0.5" style={{ backgroundColor: 'var(--theme-primary-mid)' }}>
                  <BestieAvatar characterId={character} expression={expression} size="sm" enable3D={false} />
                </div>
                <span className="text-[9px] font-semibold text-gray-500 text-center leading-tight truncate w-full">
                  {titleCase(expression)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="bestie-profile-core">
        <CoreMyBestiePage {...props} />
      </div>

      <style>{`
        .bestie-profile-core > div > div:first-child { display: none; }
        .bestie-profile-core > div > div:nth-child(2) > :nth-child(-n+4) { display: none; }
        .bestie-profile-core > div > div:nth-child(2) { padding-top: 0 !important; }
        .bestie-profile-core > div > div:nth-child(2) > :nth-child(5) { margin-top: 0 !important; }

        .emma-motion-prototype {
          width: 140px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: 50% 85%;
          will-change: transform;
        }
        .emma-motion-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          user-select: none;
        }
        @keyframes emmaIdle {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2px) scale(1.008); }
        }
        @keyframes emmaThink {
          0%,100% { transform: translateY(0) rotate(0deg); }
          45% { transform: translateY(-1px) rotate(-1.2deg); }
          70% { transform: translateY(0) rotate(-0.4deg); }
        }
        @keyframes emmaEncourage {
          0%,100% { transform: translateX(0) rotate(0deg) scale(1); }
          45% { transform: translateX(-2px) rotate(-0.8deg) scale(1.012); }
        }
        @keyframes emmaCalm {
          0%,100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(1px) scale(0.996); }
        }
        @keyframes emmaCelebrate {
          0% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-7px) scale(1.035); }
          65% { transform: translateY(0) scale(.995); }
          100% { transform: translateY(0) scale(1); }
        }
        .emma-motion-idle { animation: emmaIdle 4.8s ease-in-out infinite; }
        .emma-motion-thinking { animation: emmaThink 3.6s ease-in-out infinite; }
        .emma-motion-encouraging { animation: emmaEncourage 3.2s ease-in-out infinite; }
        .emma-motion-calm { animation: emmaCalm 5.8s ease-in-out infinite; }
        .emma-motion-celebrating { animation: emmaCelebrate .85s cubic-bezier(.2,.8,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .emma-motion-prototype { animation: none !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
