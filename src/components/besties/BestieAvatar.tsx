import { useMemo, useState, useEffect } from 'react';
import { CHARACTERS } from '../../lib/supabase';
import type { CharacterId, AvatarExpression, OutfitId } from '../../lib/supabase';
import { resolveExpressionSrc, getDefaultSrc } from '../../lib/characterAssets';
import { use3DMotion } from '../../hooks/use3DMotion';

export type BestieMotionState = 'idle' | 'wave' | 'lean' | 'thinking' | 'celebrating' | 'calm';

export interface BestieAvatarProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  outfit?: OutfitId;
  size?: 'sm' | 'md' | 'lg' | 'full' | 'portrait';
  showSpeechBubble?: boolean;
  message?: string;
  className?: string;
  motionOverride?: BestieMotionState;
  onMotionEnd?: () => void;
  /** Enable 3-D tilt tracking (default true for lg/full, false for sm/md) */
  enable3D?: boolean;
  /** Optional inline style on the outer wrapper (e.g. zIndex) */
  style?: React.CSSProperties;
}

const SIZES: Record<NonNullable<BestieAvatarProps['size']>, number> = {
  sm:      50,
  md:      70,
  lg:     100,
  full:   140,
  portrait: 200,
};

const MOTION_BY_EXPRESSION: Record<AvatarExpression, BestieMotionState> = {
  happy:       'idle',
  encouraging: 'lean',
  proud:       'celebrating',
  calm:        'calm',
  thinking:    'thinking',
  tired:       'calm',
};

const ONE_SHOT_MOTIONS = new Set<BestieMotionState>(['wave', 'celebrating']);

type FallbackState = 'expression' | 'default' | 'initials';

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

// ── Crossfading image layer ────────────────────────────────────────────────────
// Renders two img elements and fades between them when src changes.

function FadingImage({
  src,
  alt,
  onError,
  style,
}: {
  src: string;
  alt: string;
  onError: () => void;
  style: React.CSSProperties;
}) {
  const [current, setCurrent] = useState(src);
  const [next, setNext]       = useState<string | null>(null);
  const [fading, setFading]   = useState(false);

  useEffect(() => {
    if (src === current) return;
    setNext(src);
    setFading(true);
    const t = setTimeout(() => {
      setCurrent(src);
      setNext(null);
      setFading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [src, current]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        key={current}
        src={current}
        alt={alt}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={onError}
        style={{
          ...style,
          position: 'absolute',
          inset: 0,
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.28s ease',
        }}
      />
      {next && (
        <img
          key={next}
          src={next}
          alt={alt}
          loading="eager"
          decoding="async"
          draggable={false}
          style={{
            ...style,
            position: 'absolute',
            inset: 0,
            opacity: fading ? 1 : 0,
            transition: 'opacity 0.28s ease',
          }}
        />
      )}
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
  motionOverride,
  onMotionEnd,
  enable3D,
  style,
}: BestieAvatarProps) {
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const dim  = SIZES[size];

  // 3D is on by default for lg and full, off for small avatars and portrait
  const isPortrait = size === 'portrait';
  const want3D = enable3D ?? (size === 'lg' || size === 'full');

  const [fallback, setFallback] = useState<FallbackState>('expression');
  const [src, setSrc]           = useState(() => resolveExpressionSrc(characterId, expression));

  useEffect(() => {
    setFallback('expression');
    setSrc(resolveExpressionSrc(characterId, expression));
  }, [characterId, expression]);

  const handleError = () => {
    if (fallback === 'expression') {
      if (import.meta.env.DEV) {
        console.warn(`[BestieAvatar] expression asset failed to load: ${src}. Falling back to default.`);
      }
      setFallback('default');
      setSrc(getDefaultSrc(characterId));
    } else {
      if (import.meta.env.DEV) {
        console.warn(`[BestieAvatar] default asset also failed: ${src}. Showing initials.`);
      }
      setFallback('initials');
    }
  };

  // ── 3-D tilt ─────────────────────────────────────────────────────────────────
  const { tilt, ref: tiltRef } = use3DMotion(want3D);

  // Max rotation: ±12° for full, ±8° for lg
  const maxRot = size === 'full' ? 12 : 8;
  // Portrait is a static illustrated area — no tilt, no parallax
  const portraitStatic = isPortrait;
  const rotX   = -tilt.y * maxRot;  // tilt up → positive rotX (face tips toward viewer)
  const rotY   =  tilt.x * maxRot;

  // Parallax: image shifts slightly opposite to tilt direction to fake depth
  const px = -tilt.x * dim * 0.06;
  const py = -tilt.y * dim * 0.06;

  // Rim glow: shifts with tilt so light appears to come from the pointer side
  const glowX   = 50 + tilt.x * 30; // percent
  const glowY   = 50 + tilt.y * 30;
  const glowAlpha = want3D ? Math.min(0.55, Math.sqrt(tilt.x ** 2 + tilt.y ** 2) * 0.9 + 0.15) : 0.2;

  // Dynamic drop-shadow: shifts with tilt to reinforce 3-D depth
  const shadowX = tilt.x * 6;
  const shadowY = tilt.y * 6 + 4;

  const motion     = motionOverride ?? MOTION_BY_EXPRESSION[expression] ?? 'idle';
  const stateClass = `ba-state-${motion}`;

  const blinkStyle = useMemo<React.CSSProperties>(() => ({
    position:        'absolute',
    left:            '24%',
    right:           '24%',
    top:             '39%',
    height:          Math.max(2, Math.round(dim * 0.035)),
    borderRadius:    999,
    background:      'rgba(55, 65, 81, 0.85)',
    transformOrigin: 'center',
    transform:       'scaleY(0)',
    opacity:         0,
    pointerEvents:   'none',
  }), [dim]);

  const handleAnimationEnd = (event: React.AnimationEvent<HTMLDivElement>) => {
    if (event.currentTarget !== event.target) return;
    if (ONE_SHOT_MOTIONS.has(motion)) onMotionEnd?.();
  };

  const imgStyle: React.CSSProperties = {
    width:      '100%',
    height:     '100%',
    objectFit:  isPortrait ? 'contain' : 'contain',
    objectPosition: isPortrait ? 'bottom center' : undefined,
    display:    'block',
    userSelect: 'none',
  };

  const avatarEl = (
    <div
      ref={tiltRef}
      className={`${stateClass} relative${want3D ? ' ba-3d-scene' : ''}`}
      style={{
        flexShrink: 0,
        width:    isPortrait ? '100%' : dim,
        height:   isPortrait ? '100%' : undefined,
        // Portrait fills its parent — must have explicit height to render
        minHeight: isPortrait ? '100%' : undefined,
        // 3-D perspective scene
        perspective: want3D ? dim * 5 : undefined,
        perspectiveOrigin: want3D ? '50% 50%' : undefined,
        ...style,
      }}
    >
      {/* Glow halo behind the 3-D card */}
      {want3D && (
        <div
          className="ba-3d-glow"
          style={{ background: `radial-gradient(circle, ${char.primaryColor}55 0%, transparent 70%)` }}
          aria-hidden="true"
        />
      )}

      {/* 3-D card — rotates as a rigid body in 3-D space */}
      <div
        style={{
          width: '100%',
          height: isPortrait ? '100%' : undefined,
          position: 'relative',
          zIndex: 1,
          transformStyle: want3D ? 'preserve-3d' : undefined,
          transform: want3D
            ? `rotateX(${rotX}deg) rotateY(${rotY}deg)`
            : undefined,
          transition: 'transform 0.05s linear',
          willChange: want3D ? 'transform' : undefined,
        }}
      >
        <div
          className="ba-body relative"
          onAnimationEnd={handleAnimationEnd}
          style={{
            width:           isPortrait ? '100%' : dim,
            height:          isPortrait ? '100%' : dim,
            borderRadius:    portraitStatic ? '0' : '50%',
            overflow:        portraitStatic ? 'visible' : 'hidden',
            boxShadow: portraitStatic
              ? 'none'
              : want3D
                ? `${shadowX}px ${shadowY}px ${20 + Math.abs(shadowX) * 0.5}px ${char.primaryColor}33, 0 0 0 2px ${char.primaryColor}55`
                : `0 0 0 2px ${char.primaryColor}55, 0 4px 14px ${char.primaryColor}22`,
            background:      portraitStatic ? 'transparent' : `${char.primaryColor}22`,
            transformOrigin: 'bottom center',
            position:        'relative',
            transition:      want3D ? 'box-shadow 0.1s linear' : undefined,
          }}
        >
          {/* Rim-light overlay */}
          {want3D && !portraitStatic && (
            <div
              aria-hidden="true"
              style={{
                position:       'absolute',
                inset:          0,
                borderRadius:   '50%',
                background:     `radial-gradient(circle at ${glowX}% ${glowY}%, ${char.primaryColor}${Math.round(glowAlpha * 255).toString(16).padStart(2,'0')} 0%, transparent 65%)`,
                pointerEvents:  'none',
                zIndex:         2,
                mixBlendMode:   'screen',
                transition:     'background 0.08s linear',
              }}
            />
          )}

          <div
            className="ba-head"
            style={{
              width: '100%',
              height: '100%',
              transformOrigin: 'bottom center',
              // Parallax: image nudges slightly against the tilt for depth
              transform: want3D ? `translate(${px}px, ${py}px)` : undefined,
              transition: want3D ? 'transform 0.05s linear' : undefined,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {fallback === 'initials' ? (
              <div
                style={{
                  width:          '100%',
                  height:         '100%',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       Math.round(dim * 0.36),
                  fontWeight:     700,
                  color:          char.primaryColor,
                  userSelect:     'none',
                }}
                aria-label={`${char.name} avatar`}
              >
                {char.name[0]}
              </div>
            ) : (
              <FadingImage
                src={src}
                alt={`${char.name} ${expression} expression`}
                onError={handleError}
                style={imgStyle}
              />
            )}
          </div>

          {want3D && !portraitStatic && <div className="ba-shimmer" aria-hidden="true" />}
          {!portraitStatic && <div className="ba-blink" style={blinkStyle} />}
        </div>
      </div>

      {motion === 'celebrating' && <Sparkles primaryColor={char.primaryColor} />}
    </div>
  );

  if (!showSpeechBubble && !message) {
    return <div className={className} style={style}>{avatarEl}</div>;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`} style={style}>
      {avatarEl}
      {message && <SpeechBubble message={message} primaryColor={char.primaryColor} />}
    </div>
  );
}
