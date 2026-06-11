import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';

const SUPABASE_STORAGE = 'https://gepozsoziwgroeieudzg.supabase.co/storage/v1/object/public/character-images';

const CHARACTER_IMAGES: Record<CharacterId, string> = {
  emma: `${SUPABASE_STORAGE}/emma.png`,
  ava:  `${SUPABASE_STORAGE}/ava.png`,
  nora: `${SUPABASE_STORAGE}/nora.png`,
  luna: `${SUPABASE_STORAGE}/luna.png`,
};

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
  sm:   40,
  md:   56,
  lg:   80,
  full: 112,
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
  size      = 'md',
  showSpeechBubble = false,
  message,
  className = '',
}: BestieAvatarProps) {
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const dim  = SIZES[size];
  const src  = CHARACTER_IMAGES[characterId];

  const avatarEl = (
    <div
      style={{
        width:        dim,
        height:       dim,
        borderRadius: '50%',
        overflow:     'hidden',
        flexShrink:   0,
        boxShadow:    `0 0 0 2px ${char.primaryColor}55, 0 4px 14px ${char.primaryColor}22`,
      }}
    >
      <img
        src={src}
        alt={char.name}
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
