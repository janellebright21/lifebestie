import { useState } from 'react';
import {
  AVATAR_THEMES, CHARACTERS,
  AvatarThemeId, AvatarExpression, CharacterId, CharacterVariant, OutfitId,
} from '../lib/supabase';
import { resolveExpressionSrc } from '../lib/characterAssets';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifeBestieAvatarProps {
  size?:       'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?:    CharacterVariant;
  pulse?:      boolean;
  className?:  string;
  avatarTheme?: AvatarThemeId;
  expression?: AvatarExpression;
  character?:  CharacterId;
  outfit?:     OutfitId;
  /** When provided, renders avatar + a speech bubble in a flex row (portrait only) */
  bubble?:     string;
}

// ─── Size maps ────────────────────────────────────────────────────────────────
// Portrait: square.  Full-body: roughly 1 : 1.85 ratio (like a character card).

const PORTRAIT_SIZE: Record<NonNullable<LifeBestieAvatarProps['size']>, string> = {
  sm:   'w-8 h-8',     // 32 × 32
  md:   'w-11 h-11',   // 44 × 44
  lg:   'w-16 h-16',   // 64 × 64
  xl:   'w-24 h-24',   // 96 × 96
  '2xl':'w-32 h-32',   // 128 × 128
};

const FULL_BODY_SIZE: Record<NonNullable<LifeBestieAvatarProps['size']>, string> = {
  sm:   'w-16 h-28',   // 64 × 112
  md:   'w-20 h-36',   // 80 × 144
  lg:   'w-24 h-44',   // 96 × 176
  xl:   'w-32 h-56',   // 128 × 224
  '2xl':'w-40 h-72',   // 160 × 288
};

// ─── Face palette ─────────────────────────────────────────────────────────────

interface FacePalette { eyes: string; mouth: string; blush: string; accent: string; }

const THEME_PALETTES: Record<AvatarThemeId, FacePalette> = {
  classic:      { eyes: '#9f1239', mouth: '#be123c', blush: '#fda4af', accent: '#f59e0b' },
  cozy:         { eyes: '#78350f', mouth: '#b45309', blush: '#fdba74', accent: '#d97706' },
  wellness:     { eyes: '#064e3b', mouth: '#047857', blush: '#6ee7b7', accent: '#059669' },
  professional: { eyes: '#0c4a6e', mouth: '#0369a1', blush: '#7dd3fc', accent: '#0284c7' },
};

// ─── SVG face (portrait placeholder) ─────────────────────────────────────────

function AvatarFace({ expression, palette }: { expression: AvatarExpression; palette: FacePalette }) {
  const { eyes, mouth, blush, accent } = palette;
  const blushOpacity =
    expression === 'proud'       ? 0.55 :
    expression === 'happy'       ? 0.35 :
    expression === 'encouraging' ? 0.20 :
    expression === 'tired'       ? 0.08 :
    0.12;

  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
      <ellipse cx="10" cy="23" rx="4.5" ry="3.5" fill={blush} opacity={blushOpacity} />
      <ellipse cx="30" cy="23" rx="4.5" ry="3.5" fill={blush} opacity={blushOpacity} />

      {/* Eyes */}
      {(expression === 'happy' || expression === 'encouraging') && (<>
        <circle cx="14" cy="17" r="2.5" fill={eyes} />
        <circle cx="26" cy="17" r="2.5" fill={eyes} />
        <circle cx="15.1" cy="15.9" r="0.85" fill="white" opacity="0.85" />
        <circle cx="27.1" cy="15.9" r="0.85" fill="white" opacity="0.85" />
      </>)}

      {expression === 'proud' && (<>
        <path d="M 11.5 18 Q 14 13.5 16.5 18" stroke={eyes} strokeWidth="2.3" strokeLinecap="round" fill="none" />
        <path d="M 23.5 18 Q 26 13.5 28.5 18" stroke={eyes} strokeWidth="2.3" strokeLinecap="round" fill="none" />
      </>)}

      {expression === 'calm' && (<>
        <circle cx="14" cy="17" r="2" fill={eyes} opacity="0.88" />
        <circle cx="26" cy="17" r="2" fill={eyes} opacity="0.88" />
        <circle cx="15" cy="16.1" r="0.7" fill="white" opacity="0.75" />
        <circle cx="27" cy="16.1" r="0.7" fill="white" opacity="0.75" />
        <path d="M 11 14 Q 14 12.5 17 14" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.4" />
        <path d="M 23 14 Q 26 12.5 29 14" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.4" />
      </>)}

      {/* Thinking: one raised brow, eyes looking up-right, neutral pursed mouth */}
      {expression === 'thinking' && (<>
        <circle cx="14" cy="16.5" r="2" fill={eyes} opacity="0.9" />
        <circle cx="26" cy="16.5" r="2" fill={eyes} opacity="0.9" />
        <circle cx="15.4" cy="15.3" r="0.7" fill="white" opacity="0.8" />
        <circle cx="27.4" cy="15.3" r="0.7" fill="white" opacity="0.8" />
        {/* Right brow raised */}
        <path d="M 23 13 Q 26.5 10.5 29 12" stroke={mouth} strokeWidth="1.8" strokeLinecap="round" fill="none" />
        {/* Left brow flat */}
        <path d="M 11 13.5 Q 14 12.5 17 13.5" stroke={mouth} strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* Small thought dots top-right */}
        <circle cx="31" cy="9"   r="0.8" fill={accent} opacity="0.7" />
        <circle cx="33" cy="7"   r="1.1" fill={accent} opacity="0.6" />
        <circle cx="35.5" cy="5" r="1.5" fill={accent} opacity="0.5" />
      </>)}

      {/* Tired: droopy half-closed eyes, flat-sad mouth, heavy lids */}
      {expression === 'tired' && (<>
        {/* Eye bases */}
        <circle cx="14" cy="18" r="2.2" fill={eyes} opacity="0.65" />
        <circle cx="26" cy="18" r="2.2" fill={eyes} opacity="0.65" />
        {/* Heavy drooping lids */}
        <path d="M 11.5 16.5 Q 14 14.5 16.5 16.5" stroke={eyes} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <path d="M 23.5 16.5 Q 26 14.5 28.5 16.5" stroke={eyes} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* Flat brows */}
        <path d="M 11 13.8 Q 14 13 17 13.8" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
        <path d="M 23 13.8 Q 26 13 29 13.8" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.45" />
        {/* Small Zs top-right */}
        <text x="30" y="12" fontSize="3.5" fill={accent} opacity="0.5" fontWeight="bold">z</text>
        <text x="32.5" y="9.5" fontSize="4.5" fill={accent} opacity="0.4" fontWeight="bold">z</text>
      </>)}

      {/* Eyebrows for encouraging */}
      {expression === 'encouraging' && (<>
        <path d="M 11 13 Q 14 11 17 13" stroke={mouth} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M 23 13 Q 26 11 29 13" stroke={mouth} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>)}

      {/* Mouths */}
      {expression === 'happy'       && <path d="M 11 24 Q 20 33 29 24" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      {expression === 'encouraging' && <path d="M 12 25 Q 20 32 28 25" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      {expression === 'proud'       && <path d="M 11 23 Q 20 32 29 23" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      {expression === 'calm'        && <path d="M 14 24 Q 20 28.5 26 24" stroke={mouth} strokeWidth="2" strokeLinecap="round" fill="none" />}
      {expression === 'thinking'    && <path d="M 14 25 Q 18 27 22 25" stroke={mouth} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
      {expression === 'tired'       && <path d="M 14 26 Q 20 23.5 26 26" stroke={mouth} strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />}

      {/* Accent decorations */}
      {expression === 'happy' && (
        <path d="M 31.5 11 L 32.1 9.3 L 32.7 11 L 34.4 11.5 L 32.7 12 L 32.1 13.7 L 31.5 12 L 29.8 11.5 Z" fill={accent} opacity="0.8" />
      )}
      {expression === 'proud' && (<>
        <circle cx="29" cy="12"  r="1.5"  fill={accent} opacity="0.75" />
        <circle cx="32" cy="9"   r="0.85" fill={accent} opacity="0.55" />
        <circle cx="26" cy="9.5" r="0.7"  fill={accent} opacity="0.45" />
      </>)}
      {expression === 'encouraging' && (<>
        <path d="M 6 11 L 6.6 9.3 L 7.2 11 L 8.9 11.5 L 7.2 12 L 6.6 13.7 L 6 12 L 4.3 11.5 Z"    fill={accent} opacity="0.65" />
        <path d="M 32 11 L 32.6 9.3 L 33.2 11 L 34.9 11.5 L 33.2 12 L 32.6 13.7 L 32 12 L 30.3 11.5 Z" fill={accent} opacity="0.65" />
      </>)}
    </svg>
  );
}

// ─── Portrait placeholder ─────────────────────────────────────────────────────
// Circular gradient + SVG face. Shown when no portrait image exists yet.

function PortraitPlaceholder({
  expression, palette, ringGradient, innerGradient, pulse,
}: {
  expression: AvatarExpression;
  palette: FacePalette;
  ringGradient: string;
  innerGradient: string;
  pulse: boolean;
}) {
  return (
    <div className="absolute inset-0">
      {pulse && (
        <div
          className="absolute inset-[-3px] rounded-full animate-ping opacity-20 pointer-events-none"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        />
      )}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${ringGradient}`} />
      <div className={`absolute inset-[3px] rounded-full bg-gradient-to-br ${innerGradient} shadow-inner overflow-hidden`}>
        <AvatarFace expression={expression} palette={palette} />
      </div>
    </div>
  );
}

// ─── Full-body placeholder ────────────────────────────────────────────────────
// Soft gradient card with character initial. Shown until full-body art ships.

function FullBodyPlaceholder({
  charName, initial, ringGradient, innerGradient,
}: {
  charName: string;
  initial: string;
  ringGradient: string;
  innerGradient: string;
}) {
  return (
    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${innerGradient} flex flex-col items-center justify-center gap-1 overflow-hidden`}>
      {/* Decorative gradient top-cap */}
      <div className={`absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b ${ringGradient} opacity-60`} />
      {/* Initial badge */}
      <div className="relative z-10 w-10 h-10 rounded-full bg-white/40 flex items-center justify-center shadow-sm">
        <span className="text-lg font-bold text-white/90 select-none leading-none">{initial}</span>
      </div>
      <span className="relative z-10 text-[10px] font-semibold text-white/70 uppercase tracking-widest">{charName}</span>
    </div>
  );
}

// ─── Asset image (with fallback) ──────────────────────────────────────────────
// Tries to render the real illustration; falls back to the placeholder if the
// image file doesn't exist yet (onError fires) or the manifest says no asset.

function CharacterImage({
  src, alt, onFail, rounded,
}: {
  src: string;
  alt: string;
  onFail: () => void;
  rounded: 'full' | '2xl';
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={`absolute inset-0 w-full h-full object-cover rounded-${rounded}`}
      onError={onFail}
      draggable={false}
    />
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────

function Bubble({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100 px-3 py-2 max-w-[220px] self-start mt-1">
      <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LifeBestieAvatar({
  size       = 'md',
  variant    = 'portrait',
  pulse      = false,
  className  = '',
  avatarTheme = 'classic',
  expression  = 'happy',
  character,
  outfit      = 'classic' as OutfitId,
  bubble,
}: LifeBestieAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // ── Visual data ──────────────────────────────────────────────────────────────
  let ringGradient:  string;
  let innerGradient: string;
  let palette:       FacePalette;
  let charName = '';
  let initial  = '?';

  if (character) {
    const charDef     = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0]!;
    ringGradient      = charDef.ringGradient;
    innerGradient     = charDef.innerGradient;
    palette = { eyes: charDef.faceEyes, mouth: charDef.faceMouth, blush: charDef.faceBlush, accent: charDef.faceAccent };
    charName          = charDef.name;
    initial           = charDef.name[0] ?? '?';
  } else {
    const theme   = AVATAR_THEMES.find((t) => t.id === avatarTheme) ?? AVATAR_THEMES[0]!;
    ringGradient  = theme.ringGradient;
    innerGradient = theme.innerGradient;
    palette       = THEME_PALETTES[avatarTheme];
  }

  // ── Asset resolution ─────────────────────────────────────────────────────────
  // Use the same bundled-import pipeline as BestieAvatar — resolveExpressionSrc
  // returns Vite-bundled hashed URLs that are always valid.
  let assetSrc: string | null = null;
  if (character && !imgFailed) {
    assetSrc = resolveExpressionSrc(character, expression);
  }

  // ── Sizing ───────────────────────────────────────────────────────────────────
  const sizeClass = variant === 'full-body' ? FULL_BODY_SIZE[size] : PORTRAIT_SIZE[size];
  const isCircle  = variant === 'portrait';

  // ── Build avatar element ─────────────────────────────────────────────────────
  const avatarEl = (
    <div className={`relative shrink-0 ${sizeClass} ${bubble ? '' : className}`}>
      {assetSrc ? (
        <CharacterImage
          src={assetSrc}
          alt={charName || 'character'}
          onFail={() => setImgFailed(true)}
          rounded={isCircle ? 'full' : '2xl'}
        />
      ) : isCircle ? (
        <PortraitPlaceholder
          expression={expression}
          palette={palette}
          ringGradient={ringGradient}
          innerGradient={innerGradient}
          pulse={pulse}
        />
      ) : (
        <FullBodyPlaceholder
          charName={charName}
          initial={initial}
          ringGradient={ringGradient}
          innerGradient={innerGradient}
        />
      )}
    </div>
  );

  if (!bubble || variant === 'full-body') return avatarEl;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {avatarEl}
      <Bubble text={bubble} />
    </div>
  );
}
