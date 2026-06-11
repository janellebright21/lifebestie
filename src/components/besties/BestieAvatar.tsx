import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { resolveExpressionSrc } from '../../lib/characterAssets';

export interface BestieAvatarProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  outfit?: OutfitId;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showSpeechBubble?: boolean;
  message?: string;
  className?: string;
}

const SIZES: Record<NonNullable<BestieAvatarProps['size']>, number> = {
  sm:   50,
  md:   70,
  lg:  100,
  full: 140,
};

const MOTION_CLASS: Record<AvatarExpression, string> = {
  happy:       'bestie-happy',
  thinking:    'bestie-thinking',
  encouraging: 'bestie-encouraging',
  proud:       'bestie-proud',
  calm:        'bestie-calm',
  tired:       'bestie-calm', // no dedicated tired motion; calm float works
};

// Three sparkle dots positioned around the avatar for the proud celebration.
// Offset angles: top-right, top-left, right
const SPARKLE_POSITIONS = [
  { top: '-6px',  right: '-4px',  animationDelay: '0ms'   },
  { top: '-8px',  left:  '-2px',  animationDelay: '80ms'  },
  { top:  '10px', right: '-8px',  animationDelay: '140ms' },
];

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
  const char       = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const dim        = SIZES[size];
  const src        = resolveExpressionSrc(characterId, expression);
  const motionClass = MOTION_CLASS[expression] ?? 'bestie-happy';

  const avatarEl = (
    <div style={{ position: 'relative', flexShrink: 0, width: dim, height: dim }}>
      {/* Sparkle dots — only rendered for proud */}
      {expression === 'proud' && SPARKLE_POSITIONS.map((pos, i) => (
        <span
          key={i}
          className="bestie-sparkle-dot"
          style={{ ...pos, animationDelay: pos.animationDelay }}
        />
      ))}

      <div
        className={motionClass}
        style={{
          width:        '100%',
          height:       '100%',
          borderRadius: '50%',
          overflow:     'hidden',
          boxShadow:    `0 0 0 2px ${char.primaryColor}55, 0 4px 14px ${char.primaryColor}22`,
        }}
      >
        <img
          src={src}
          alt={`${char.name} ${expression}`}
          draggable={false}
          style={{
            width:          '100%',
            height:         '100%',
            objectFit:      'cover',
            objectPosition: 'center 30%',
            display:        'block',
          }}
        />
      </div>
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
