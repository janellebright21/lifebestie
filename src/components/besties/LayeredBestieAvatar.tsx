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
  /** Optional manual blink for the branch-only Animation Lab. */
  forceBlink?: boolean;
  /** Rendered when the production layered rig is not complete or required assets fail. */
  fallback?: ReactNode;
  /** Optional callback so the Animation Lab can show real runtime readiness. */
  onAssetStatusChange?: (status: { ready: boolean; failedParts: LayeredBestiePart[] }) => void;
}

const HEAD_PARTS = new Set<LayeredBestiePart>([
  'head',
  'hairBack',
  'hairFront',
  'eyesOpen',
  'eyesClosed',
  'mouth',
]);

const REQUIRED_PARTS = new Set<LayeredBestiePart>(['body', 'head']);

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
  motion: LayeredMotionState,
): CSSProperties {
  const isEyesOpen = part === 'eyesOpen';
  const isEyesClosed = part === 'eyesClosed';
  const isMouth = part === 'mouth';
  const isLeftArm = part === 'leftArm';
  const isRightArm = part === 'rightArm';
  const showWarmSmile = motion === 'encouraging' || motion === 'celebrating';
  const showOpenHand = motion === 'encouraging' || motion === 'celebrating';
  const showNotebook = motion === 'thinking' || motion === 'calm';

  let opacity = 1;
  if (isEyesOpen) opacity = blinking ? 0 : 1;
  if (isEyesClosed) opacity = blinking ? 1 : 0;
  if (isMouth) opacity = showWarmSmile ? 1 : 0;
  if (isLeftArm) opacity = showOpenHand ? 1 : 0;
  if (isRightArm) opacity = showNotebook ? 1 : 0;

  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: layer.zIndex,
    opacity,
    transition: (isMouth || isLeftArm || isRightArm) ? 'opacity 180ms ease' : undefined,
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
  forceBlink = false,
  fallback = null,
  onAssetStatusChange,
}: LayeredBestieAvatarProps) {
  const rig = getLayeredBestieRig(characterId);
  const manifestReady = hasCompleteLayeredBestieRig(characterId);
  const [failedParts, setFailedParts] = useState<LayeredBestiePart[]>([]);
  const [loadedRequiredParts, setLoadedRequiredParts] = useState<LayeredBestiePart[]>([]);

  useEffect(() => {
    setFailedParts([]);
    setLoadedRequiredParts([]);
  }, [characterId]);

  const requiredFailed = failedParts.some((part) => REQUIRED_PARTS.has(part));
  const runtimeReady = manifestReady && !requiredFailed && loadedRequiredParts.length === REQUIRED_PARTS.size;
  const blinkReady = Boolean(rig?.layers.eyesClosed.src) && !failedParts.includes('eyesClosed');
  const naturalBlink = useNaturalBlink(runtimeReady && blinkReady);
  const blinking = blinkReady && (forceBlink || naturalBlink);

  useEffect(() => {
    onAssetStatusChange?.({ ready: runtimeReady, failedParts });
  }, [runtimeReady, failedParts, onAssetStatusChange]);

  const motionClass = useMemo(() => `layered-bestie--${motion}`, [motion]);

  if (!rig || !manifestReady) return <>{fallback}</>;

  const orderedParts = (Object.entries(rig.layers) as Array<[LayeredBestiePart, LayeredBestieLayer]>)
    .filter(([, layer]) => Boolean(layer.src))
    .sort((a, b) => a[1].zIndex - b[1].zIndex);

  const markLoaded = (part: LayeredBestiePart) => {
    if (!REQUIRED_PARTS.has(part)) return;
    setLoadedRequiredParts((current) => current.includes(part) ? current : [...current, part]);
  };

  const markFailed = (part: LayeredBestiePart) => {
    setFailedParts((current) => current.includes(part) ? current : [...current, part]);
  };

  const diagnosticText = requiredFailed
    ? `Layered rig fallback · failed: ${failedParts.filter((part) => REQUIRED_PARTS.has(part)).join(', ')}`
    : runtimeReady
      ? 'Layered rig active'
      : 'Layered rig loading…';

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
      {!requiredFailed && (
        <div className="layered-bestie__body" style={{ position: 'absolute', inset: 0 }}>
          {orderedParts.map(([part, layer]) => {
            if (!layer.src || failedParts.includes(part)) return null;
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
                onLoad={() => markLoaded(part)}
                onError={() => markFailed(part)}
                style={layerStyle(layer, part, rig.canvas.width, rig.canvas.height, blinking, motion)}
              />
            );
          })}
        </div>
      )}

      {!runtimeReady && (
        <div className="layered-bestie__fallback" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          {fallback}
        </div>
      )}

      <div
        className={`layered-bestie__diagnostic ${runtimeReady ? 'is-ready' : requiredFailed ? 'is-failed' : 'is-loading'}`}
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -22,
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontSize: 8,
          fontWeight: 700,
          lineHeight: 1,
          padding: '4px 6px',
          borderRadius: 999,
          background: runtimeReady ? 'rgba(34,197,94,.12)' : requiredFailed ? 'rgba(239,68,68,.12)' : 'rgba(148,163,184,.16)',
          color: runtimeReady ? 'rgb(21,128,61)' : requiredFailed ? 'rgb(185,28,28)' : 'rgb(100,116,139)',
          zIndex: 100,
          pointerEvents: 'none',
        }}
      >
        {diagnosticText}
      </div>
    </div>
  );
}
