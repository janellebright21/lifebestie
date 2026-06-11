import { useState } from 'react';
import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { getManifest, getAssetPath } from '../../lib/characterAssets';

export interface BestieAvatarProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  outfit?: OutfitId;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showSpeechBubble?: boolean;
  message?: string;
  className?: string;
}

// Portrait dimensions for each size
const PORTRAIT_DIM: Record<NonNullable<BestieAvatarProps['size']>, string> = {
  sm:   'w-10 h-10',
  md:   'w-14 h-14',
  lg:   'w-20 h-20',
  full: 'w-28 h-28',
};

// Expression-specific emoji overlays
const EXPRESSION_EMOJI: Record<AvatarExpression, string> = {
  happy:       '😊',
  encouraging: '🤗',
  proud:       '🥹',
  calm:        '😌',
  thinking:    '🤔',
  tired:       '😴',
};

// Subtle background pattern per character using their gradient
function CharacterCard({
  char,
  expression,
  size,
  imgSrc,
  onImgError,
}: {
  char: ReturnType<typeof CHARACTERS['find']> & object;
  expression: AvatarExpression;
  size: NonNullable<BestieAvatarProps['size']>;
  imgSrc: string | null;
  onImgError: () => void;
}) {
  const dim = PORTRAIT_DIM[size];
  const isFull = size === 'full';
  const fontSize = isFull ? 'text-4xl' : size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg';
  const initialsSize = isFull ? 'text-xl' : size === 'lg' ? 'text-lg' : 'text-base';

  return (
    <div
      className={`relative ${dim} rounded-full shrink-0 overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, ${char.primaryColor}33 0%, ${char.primaryColor}88 50%, ${char.primaryColor}cc 100%)`,
        boxShadow: `0 0 0 3px ${char.primaryColor}44, 0 4px 12px ${char.primaryColor}33`,
      }}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={char.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={onImgError}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {/* Decorative top arc */}
          <div
            className="absolute top-0 inset-x-0 h-1/2 opacity-30"
            style={{ background: `radial-gradient(ellipse at 50% -20%, white, transparent 70%)` }}
          />
          {/* Character emoji expression */}
          <span className={`${fontSize} leading-none select-none relative z-10`}>
            {EXPRESSION_EMOJI[expression]}
          </span>
          {/* Character name initial chip */}
          <div
            className="relative z-10 px-1.5 py-0.5 rounded-full mt-0.5"
            style={{ backgroundColor: `${char.primaryColor}cc` }}
          >
            <span className={`${initialsSize} font-black text-white leading-none`}>
              {char.name[0]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SpeechBubble({ message, primaryColor }: { message: string; primaryColor: string }) {
  return (
    <div
      className="relative rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm max-w-[220px] self-start"
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
  outfit = 'classic',
  size = 'md',
  showSpeechBubble = false,
  message,
  className = '',
}: BestieAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;

  // Resolve real asset path if available
  let imgSrc: string | null = null;
  if (!imgFailed) {
    const manifest = getManifest(characterId);
    if (manifest.hasPortrait) {
      imgSrc = getAssetPath(characterId, 'portrait', expression, outfit);
    }
  }

  const avatarEl = (
    <CharacterCard
      char={char}
      expression={expression}
      size={size}
      imgSrc={imgSrc}
      onImgError={() => setImgFailed(true)}
    />
  );

  if (!showSpeechBubble && !message) {
    return <div className={className}>{avatarEl}</div>;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {avatarEl}
      {(showSpeechBubble || message) && message && (
        <SpeechBubble message={message} primaryColor={char.primaryColor} />
      )}
    </div>
  );
}
