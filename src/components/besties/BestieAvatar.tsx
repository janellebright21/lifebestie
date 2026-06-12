import { useState } from 'react';
import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { resolveExpressionSrc } from '../../lib/characterAssets';

// Motion types kept so call sites don't break, but no animations run yet.
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

export default function BestieAvatar({
  characterId,
  expression = 'happy',
  size       = 'md',
  showSpeechBubble = false,
  message,
  className  = '',
}: BestieAvatarProps) {
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const dim  = SIZES[size];
  const src  = resolveExpressionSrc(characterId, expression);
  const [failed, setFailed] = useState(false);

  const avatarEl = (
    <div style={{ flexShrink: 0 }}>
      <div
        style={{
          width:        dim,
          height:       dim,
          borderRadius: '50%',
          overflow:     'hidden',
          boxShadow:    `0 0 0 2px ${char.primaryColor}55, 0 4px 14px ${char.primaryColor}22`,
          background:   `${char.primaryColor}22`,
        }}
      >
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

      {/* DEV: show resolved src so we can confirm path */}
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
