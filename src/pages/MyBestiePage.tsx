import type { ComponentProps } from 'react';
import { Heart, Sparkles, Star, TrendingUp } from 'lucide-react';
import CoreMyBestiePage from './MyBestiePageCore';
import BestieAvatar from '../components/besties/BestieAvatar';
import { CHARACTERS } from '../lib/supabase';

type MyBestiePageProps = ComponentProps<typeof CoreMyBestiePage>;

const EXPRESSIONS = ['happy', 'thinking', 'encouraging', 'proud', 'calm'] as const;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function MyBestiePage(props: MyBestiePageProps) {
  const character = props.character ?? 'emma';
  const charDef = CHARACTERS.find((item) => item.id === character) ?? CHARACTERS[0]!;
  const relationship = props.relationship;

  const greeting = props.preferredName
    ? `Hey ${props.preferredName}! I'm glad you're here.`
    : `Hey there, bestie! I'm glad you're here.`;

  return (
    <div className="bestie-profile-shell min-h-[100dvh] theme-app-bg pb-24">
      <div className="bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-primary-light)' }}
          >
            <Heart size={18} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-800 leading-none">My Bestie</h1>
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
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {charDef.tagline}
              </p>
              <p className="text-xs italic mt-2 leading-relaxed" style={{ color: 'var(--theme-primary)' }}>
                “{charDef.catchphrase}”
              </p>
            </div>
            <div className="shrink-0 -mr-2 -mt-2">
              <BestieAvatar
                characterId={character}
                expression="happy"
                size="full"
                enableTilt={false}
              />
            </div>
          </div>

          <div className="px-5 pb-5 pt-3">
            <div
              className="rounded-2xl bg-white/80 border px-4 py-4"
              style={{ borderColor: 'var(--theme-primary-mid)' }}
            >
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
                <div
                  className="rounded-full p-0.5"
                  style={{ backgroundColor: 'var(--theme-primary-mid)' }}
                >
                  <BestieAvatar
                    characterId={character}
                    expression={expression}
                    size="sm"
                    enableTilt={false}
                  />
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
      `}</style>
    </div>
  );
}
