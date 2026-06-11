import { useState } from 'react';
import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { getManifest, getAssetPath } from '../../lib/characterAssets';
import referenceSheet from '../../assets/characters/55341C94-210F-4AB5-8298-75CDEC93AC4A.jpeg';

export interface BestieAvatarProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  outfit?: OutfitId;
  size?: 'sm' | 'md' | 'lg' | 'full';
  showSpeechBubble?: boolean;
  message?: string;
  className?: string;
}

// Rendered height of the reference sheet image (px) and x/y offsets (px)
// to crop each character's face+upper-body into the circular container.
// Reference sheet natural size: ~1290 × 968 px
// Emma large figure: leftmost column (~x 0–185, y 60–680 in original)
// Ava: ~x 235–500 | Nora: ~x 505–755 | Luna: ~x 760–1010 | Emma small col: ~x 1020–1290
interface CropConfig {
  imgH: number;  // rendered height of the full sheet inside the container
  x: number;     // left offset (negative = shift image left)
  y: number;     // top offset (negative = shift image up)
}

const CROPS: Record<CharacterId, CropConfig> = {
  // Emma large figure on the far left of the reference sheet.
  // At imgH=460: scale = 460/968 ≈ 0.475 → rendered width ≈ 613px
  // Emma face centre original ≈ (95, 120) → rendered ≈ (45, 57)
  // Shift so face lands near centre of container
  emma: { imgH: 460, x: -10, y: -28 },

  // Ava column starts at original x≈235 → rendered x≈163 at same scale
  // Her face centre original ≈ (340, 120) → rendered ≈ (161, 57) at imgH=460
  ava:  { imgH: 460, x: -126, y: -28 },

  // Nora column starts at original x≈505
  // Face centre original ≈ (610, 120) → rendered ≈ (290, 57)
  nora: { imgH: 460, x: -256, y: -28 },

  // Luna column starts at original x≈760
  // Face centre original ≈ (870, 120) → rendered ≈ (413, 57)
  luna: { imgH: 460, x: -378, y: -28 },
};

const PORTRAIT_DIM: Record<NonNullable<BestieAvatarProps['size']>, number> = {
  sm:   40,
  md:   56,
  lg:   80,
  full: 112,
};

function CroppedCharacter({
  characterId,
  size,
}: {
  characterId: CharacterId;
  size: NonNullable<BestieAvatarProps['size']>;
}) {
  const dim = PORTRAIT_DIM[size];
  const crop = CROPS[characterId];
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;

  // Scale the crop offsets proportionally to the container size
  // Base crop was designed for lg (80px); scale accordingly
  const scale = dim / 80;
  const imgH = crop.imgH * scale;
  const x = crop.x * scale;
  const y = crop.y * scale;

  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: `0 0 0 3px ${char.primaryColor}44, 0 4px 12px ${char.primaryColor}33`,
        flexShrink: 0,
        position: 'relative',
        backgroundColor: `${char.primaryColor}22`,
      }}
    >
      <img
        src={referenceSheet}
        alt={char.name}
        draggable={false}
        style={{
          height: imgH,
          width: 'auto',
          position: 'absolute',
          left: x,
          top: y,
          userSelect: 'none',
        }}
      />
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

  // Check for a dedicated per-character asset (drops in via manifest)
  let dedicatedSrc: string | null = null;
  if (!imgFailed) {
    const manifest = getManifest(characterId);
    if (manifest.hasPortrait) {
      dedicatedSrc = getAssetPath(characterId, 'portrait', expression, outfit);
    }
  }

  const dim = PORTRAIT_DIM[size];

  const avatarEl = dedicatedSrc ? (
    // Once a real per-character PNG exists, use it
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: `0 0 0 3px ${char.primaryColor}44`,
        flexShrink: 0,
      }}
    >
      <img
        src={dedicatedSrc}
        alt={char.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setImgFailed(true)}
        draggable={false}
      />
    </div>
  ) : (
    // Crop from the reference sheet — works for all four characters
    <CroppedCharacter characterId={characterId} size={size} />
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
