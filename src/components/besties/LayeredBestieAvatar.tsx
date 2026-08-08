import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { CharacterId } from '../../lib/supabase';
import {
  getLayeredBestieRig,
  hasCompleteLayeredBestieRig,
  type LayeredBestieLayer,
  type LayeredBestiePart,
} from '../../lib/layeredBestieAssets';

export type LayeredMotionState = 'idle' | 'thinking' | 'encouraging' | 'celebrating' | 'calm';

export interface LayeredBestieAvatarProps {
  characterId: CharacterId;
  size?: number;
  motion?: LayeredMotionState;
  className?: string;
  style?: CSSProperties;
  /** Rendered when the production layered rig is not complete yet. */
  fallback?: ReactNode;
}

const HEAD_PARTS = new Set<LayeredBestiePart>([
  'head',
  'hairBack',
  'hairFront',
  'eyesOpen',
  'eyesClosed',
  'mouth',
]);

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useNaturalBlink(enabled: boolean) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setBlinking(false);
      return;
    }

    let blinkTimer: ReturnType<typeof setTimeout> | undefined;
    let reopenTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      const delay = 3600 + Math.random() * 4200;
      blinkTimer = setTimeout(() => {
        if (cancelled) return;
        setBlinking(true);
        reopenTimer = setTimeout(() => {
          if (cancelled) return;
          setBlinking(false);
          schedule();
        }, 115 + Math.random() * 55);
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      if (blinkTimer) clearTimeout(blinkTimer);
      if (reopenTimer) clearTimeout(reopenTimer);
    };
  }, [enabled]);

  return blinking;
}

function layerStyle(
  layer: LayeredBestieLayer,
  part: LayeredBestiePart,
  canvasWidth: number,
  canvasHeight: number,
  blinking: boolean,
): CSSProperties {
  const isEyesOpen = part === 'eyesOpen';
  const isEyesClosed = part === 'eyesClosed';

  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: layer.zIndex,
    opacity: isEyesOpen ? (blinking ? 0 : 1) : isEyesClosed ? (blinking ? 1 : 0) : 1,
    transformOrigin: `${(layer.anchor.originX ?? 0.5) * 100}% ${(layer.anchor.originY ?? 0.5) * 100}%`,
    ['--layer-anchor-x' as string]: `${(layer.anchor.x / canvasWidth) * 100}%`,
    ['--layer-anchor-y' as string]: `${(layer.anchor.y / canvasHeight) * 100}%`,
  } as CSSProperties;
}

export default function LayeredBestieAvatar({
  characterId,
  size = 200,
  motion = 'idle',
  className = '',
  style,
  fallback = null,
}: LayeredBestieAvatarProps) {
  const rig = getLayeredBestieRig(characterId);
  const ready = hasCompleteLayeredBestieRig(characterId);
  const blinking = useNaturalBlink(ready);

  const motionClass = useMemo(() => `layered-bestie--${motion}`, [motion]);

  if (!rig || !ready) return <>{fallback}</>;

  const orderedParts = (Object.entries(rig.layers) as Array<[LayeredBestiePart, LayeredBestieLayer]>)
    .filter(([, layer]) => Boolean(layer.src))
    .sort((a, b) => a[1].zIndex - b[1].zIndex);

  return (
    <div
      className={`layered-bestie ${motionClass} ${className}`.trim()}
      style={{
        position: 'relative',
        width: size,
        aspectRatio: `${rig.canvas.width} / ${rig.canvas.height}`,
        overflow: 'visible',
        ...style,
      }}
      aria-label={`${characterId} layered avatar`}
    >
      <div className="layered-bestie__body" style={{ position: 'absolute', inset: 0 }}>
        {orderedParts.map(([part, layer]) => {
          if (!layer.src) return null;
          const classNames = [
            'layered-bestie__layer',
            `layered-bestie__${part}`,
            HEAD_PARTS.has(part) ? 'layered-bestie__head-part' : '',
          ].filter(Boolean).join(' ');

          return (
            <img
              key={part}
              src={layer.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              className={classNames}
              style={layerStyle(layer, part, rig.canvas.width, rig.canvas.height, blinking)}
            />
          );
        })}
      </div>
    </div>
  );
}
