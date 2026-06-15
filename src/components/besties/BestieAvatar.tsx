import { useMemo, useState } from 'react';
import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { resolveExpressionSrc } from '../../lib/characterAssets';

export type BestieMotionState = 'idle' | 'wave' | 'lean' | 'thinking' | 'celebrating' | 'calm';

export interface BestieAvatarProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  outfit?: OutfitId;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showSpeechBubble?: boolean;
  message?: string;
  className?: string;
  motionOverride?: BestieMotionState;
  onMotionEnd?: () => void;
}

const SIZES: Record<NonNullable<BestieAvatarProps['size']>, number> = {
  sm:   50,
  md:   70,
  lg:  100,
  full: 140,
};

const MOTION_BY_EXPRESSION: Record<AvatarExpression, BestieMotionState> = {
  happy:        'idle',
  encouraging: 'lean',
  proud:        'celebrating',
  calm:         'calm',
  thinking:     'thinking',
  tired:        'calm',
};

const ONE_SHOT_MOTIONS = new Set<BestieMotionState>(['wave', 'celebrating']);

function SpeechBubble({ message, primaryColor }: { message: string; primaryColor: string }) {
  return (
    <div
      className="rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm max-w-[220px] self-start"
      style={{
        backgroundColor: `${primaryColor}14`,
        border: `1px solid ${primaryColor}33`,
      }}
    >
      <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
    </div>
  );
}

function Sparkles({ primaryColor }: { primaryColor: string }) {
  return (
    <>
      <span className="bestie-sparkle-dot" style={{ left: '8%', top: '18%', background: primaryColor }} />
      <span className="bestie-sparkle-dot" style={{ right: '6%', top: '10%', background: primaryColor, animationDelay: '0.08s' }} />
      <span className="bestie-sparkle-dot" style={{ right: '12%', bottom: '20%', background: primaryColor, animationDelay: '0.16s' }} />
    </>
  );
}

export default function BestieAvatar({
  characterId,
  expression = 'happy',
  size       = 'md',
  showSpeechBubble = false,
  message,
  className  = '',
  motionOverride,
  onMotionEnd,
}: BestieAvatarProps) {
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const dim  = SIZES[size];
  const src  = resolveExpressionSrc(characterId, expression);
  const [failed, setFailed] = useState(false);

  const motion = motionOverride ?? MOTION_BY_EXPRESSION[expression] ?? 'idle';
  const stateClass = `ba-state-${motion}`;

  const blinkStyle = useMemo<React.CSSProperties>(() => ({
    position: 'absolute',
    left: '24%',
    right: '24%',
    top: '39%',
    height: Math.max(2, Math.round(dim * 0.035)),
    borderRadius: 999,
    background: 'rgba(55, 65, 81, 0.85)',
    transformOrigin: 'center',
    transform: 'scaleY(0)',
    opacity: 0,
    pointerEvents: 'none',
  }), [dim]);

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    if (ONE_SHOT_MOTIONS.has(motion)) onMotionEnd?.();
  };

  const avatarEl = (
    <div className={`${stateClass} relative`} style={{ flexShrink: 0, width: dim }}>
      <div
        className="ba-body relative"
        onAnimationEnd={handleAnimationEnd}
        style={{
          width:        dim,
          height:       dim,
          borderRadius: '50%',
          overflow:     'hidden',
          boxShadow:    `0 0 0 2px ${char.primaryColor}55, 0 4px 14px ${char.primaryColor}22`,
          background:   `${char.primaryColor}22`,
          transformOrigin: 'bottom center',
          position: 'relative',
        }}
      >
        <div className="ba-head" style={{ width: '100%', height: '100%', transformOrigin: 'bottom center' }}>
          {!failed ? (
            <img
              src={src}
              alt={`${char.name} ${expression}`}
              draggable={false}
              onError={() => setFailed(true)}
              style={{
                width:      '100%',
                height:     '100%',
                objectFit:  'cover',
                display:    'block',
                userSelect: 'none',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#ef4444', textAlign: 'center', padding: 4,
              }}
            >
              Failed
            </div>
          )}
        </div>

        {!failed && <div className="ba-blink" style={blinkStyle} />}
      </div>

      {motion === 'celebrating' && <Sparkles primaryColor={char.primaryColor} />}

      {import.meta.env.DEV && (
        <div style={{ fontSize: 8, color: '#6b7280', marginTop: 2, maxWidth: dim, wordBreak: 'break-all' }}>
          {failed ? `FAILED: ${src}` : src.slice(-30)}
        </div>
      )}
    </div>
  );

  if (!showSpeechBubble && !message) {
    return <div className={className}>{avatarEl}</div>;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {avatarEl}
      {message && <SpeechBubble message={message} primaryColor={char.primaryColor} />}
    </div>
  );
}
