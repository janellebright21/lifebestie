import { AVATAR_THEMES, AvatarThemeId, AvatarExpression } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LifeBestieAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
  avatarTheme?: AvatarThemeId;
  expression?: AvatarExpression;
  /** When provided, renders avatar + a speech bubble in a flex row */
  bubble?: string;
}

// ─── Size map ─────────────────────────────────────────────────────────────────

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8'   },
  md: { outer: 'w-11 h-11' },
  lg: { outer: 'w-16 h-16' },
};

// ─── Per-theme SVG face palettes ──────────────────────────────────────────────

interface FacePalette {
  eyes: string;
  mouth: string;
  blush: string;
  accent: string;
}

const FACE_PALETTES: Record<AvatarThemeId, FacePalette> = {
  classic:      { eyes: '#9f1239', mouth: '#be123c', blush: '#fda4af', accent: '#f59e0b' },
  cozy:         { eyes: '#78350f', mouth: '#b45309', blush: '#fdba74', accent: '#d97706' },
  wellness:     { eyes: '#064e3b', mouth: '#047857', blush: '#6ee7b7', accent: '#059669' },
  professional: { eyes: '#0c4a6e', mouth: '#0369a1', blush: '#7dd3fc', accent: '#0284c7' },
};

// ─── SVG face ─────────────────────────────────────────────────────────────────
// Drawn on a transparent 40×40 viewBox overlaid on the gradient inner circle.
// Eyes at y≈17, mouth at y≈24-25, decorations in corners.

function AvatarFace({ expression, palette }: { expression: AvatarExpression; palette: FacePalette }) {
  const { eyes, mouth, blush, accent } = palette;

  const blushOpacity =
    expression === 'proud'       ? 0.55 :
    expression === 'happy'       ? 0.35 :
    expression === 'encouraging' ? 0.20 :
    /* calm */                     0.12;

  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">

      {/* Blush */}
      <ellipse cx="10" cy="23" rx="4.5" ry="3.5" fill={blush} opacity={blushOpacity} />
      <ellipse cx="30" cy="23" rx="4.5" ry="3.5" fill={blush} opacity={blushOpacity} />

      {/* Eyes */}
      {(expression === 'happy' || expression === 'encouraging') && (
        <>
          <circle cx="14" cy="17" r="2.5" fill={eyes} />
          <circle cx="26" cy="17" r="2.5" fill={eyes} />
          <circle cx="15.1" cy="15.9" r="0.85" fill="white" opacity="0.85" />
          <circle cx="27.1" cy="15.9" r="0.85" fill="white" opacity="0.85" />
        </>
      )}

      {expression === 'proud' && (
        <>
          <path d="M 11.5 18 Q 14 13.5 16.5 18" stroke={eyes} strokeWidth="2.3" strokeLinecap="round" fill="none" />
          <path d="M 23.5 18 Q 26 13.5 28.5 18" stroke={eyes} strokeWidth="2.3" strokeLinecap="round" fill="none" />
        </>
      )}

      {expression === 'calm' && (
        <>
          <circle cx="14" cy="17" r="2" fill={eyes} opacity="0.88" />
          <circle cx="26" cy="17" r="2" fill={eyes} opacity="0.88" />
          <circle cx="15" cy="16.1" r="0.7" fill="white" opacity="0.75" />
          <circle cx="27" cy="16.1" r="0.7" fill="white" opacity="0.75" />
          <path d="M 11 14 Q 14 12.5 17 14" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.4" />
          <path d="M 23 14 Q 26 12.5 29 14" stroke={mouth} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.4" />
        </>
      )}

      {/* Raised eyebrows for encouraging */}
      {expression === 'encouraging' && (
        <>
          <path d="M 11 13 Q 14 11 17 13" stroke={mouth} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M 23 13 Q 26 11 29 13" stroke={mouth} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* Mouth */}
      {expression === 'happy' && (
        <path d="M 11 24 Q 20 33 29 24" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
      {expression === 'encouraging' && (
        <path d="M 12 25 Q 20 32 28 25" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
      {expression === 'proud' && (
        <path d="M 11 23 Q 20 32 29 23" stroke={mouth} strokeWidth="2.2" strokeLinecap="round" fill="none" />
      )}
      {expression === 'calm' && (
        <path d="M 14 24 Q 20 28.5 26 24" stroke={mouth} strokeWidth="2" strokeLinecap="round" fill="none" />
      )}

      {/* Accent decorations */}
      {expression === 'happy' && (
        <path
          d="M 31.5 11 L 32.1 9.3 L 32.7 11 L 34.4 11.5 L 32.7 12 L 32.1 13.7 L 31.5 12 L 29.8 11.5 Z"
          fill={accent} opacity="0.8"
        />
      )}
      {expression === 'proud' && (
        <>
          <circle cx="29"  cy="12"  r="1.5"  fill={accent} opacity="0.75" />
          <circle cx="32"  cy="9"   r="0.85" fill={accent} opacity="0.55" />
          <circle cx="26"  cy="9.5" r="0.7"  fill={accent} opacity="0.45" />
        </>
      )}
      {expression === 'encouraging' && (
        <>
          <path
            d="M 6 11 L 6.6 9.3 L 7.2 11 L 8.9 11.5 L 7.2 12 L 6.6 13.7 L 6 12 L 4.3 11.5 Z"
            fill={accent} opacity="0.65"
          />
          <path
            d="M 32 11 L 32.6 9.3 L 33.2 11 L 34.9 11.5 L 33.2 12 L 32.6 13.7 L 32 12 L 30.3 11.5 Z"
            fill={accent} opacity="0.65"
          />
        </>
      )}
    </svg>
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
  size = 'md',
  pulse = false,
  className = '',
  avatarTheme = 'classic',
  expression = 'happy',
  bubble,
}: LifeBestieAvatarProps) {
  const s       = SIZE_MAP[size];
  const theme   = AVATAR_THEMES.find((t) => t.id === avatarTheme) ?? AVATAR_THEMES[0]!;
  const palette = FACE_PALETTES[avatarTheme];

  const avatarEl = (
    <div className={`relative shrink-0 ${s.outer} ${bubble ? '' : className}`}>
      {/* Theme-tinted pulse ring */}
      {pulse && (
        <div
          className="absolute inset-[-3px] rounded-full animate-ping opacity-20 pointer-events-none"
          style={{ backgroundColor: 'var(--theme-primary)' }}
        />
      )}
      {/* Outer gradient ring */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.ringGradient}`} />
      {/* Inner face circle */}
      <div className={`absolute inset-[3px] rounded-full bg-gradient-to-br ${theme.innerGradient} shadow-inner overflow-hidden`}>
        <AvatarFace expression={expression} palette={palette} />
      </div>
    </div>
  );

  if (!bubble) return avatarEl;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {avatarEl}
      <Bubble text={bubble} />
    </div>
  );
}
