import type { CharacterId } from './supabase';

export type LayeredBestiePart =
  | 'body'
  | 'head'
  | 'hairBack'
  | 'hairFront'
  | 'eyesOpen'
  | 'eyesClosed'
  | 'mouth'
  | 'leftArm'
  | 'rightArm'
  | 'accessory';

export interface LayerAnchor {
  x: number;
  y: number;
  originX?: number;
  originY?: number;
}

export interface LayeredBestieLayer {
  src?: string;
  zIndex: number;
  anchor: LayerAnchor;
}

export interface LayeredBestieRigManifest {
  characterId: CharacterId;
  canvas: { width: number; height: number };
  layers: Record<LayeredBestiePart, LayeredBestieLayer>;
}

const layer = (src: string | undefined, zIndex: number, anchor: LayerAnchor): LayeredBestieLayer => ({
  src,
  zIndex,
  anchor,
});

/**
 * Emma Phase 1 production rig.
 *
 * The first installed production layers are a body and an independently movable
 * head cut from the approved Emma master image. Both are exported against the
 * same 1024x1536 canvas so they stay registered when animated.
 *
 * Additional hair/face/arm layers remain intentionally empty until their real
 * production assets are ready. The renderer can safely use this minimum rig for
 * breathing and subtle independent head motion without inventing placeholder art.
 */
export const EMMA_LAYERED_RIG: LayeredBestieRigManifest = {
  characterId: 'emma',
  canvas: { width: 1024, height: 1536 },
  layers: {
    hairBack:   layer(undefined, 10, { x: 512, y: 310, originX: 0.5, originY: 0.72 }),
    body:       layer('/characters/layered/emma/body.webp', 20, { x: 512, y: 920, originX: 0.5, originY: 0.92 }),
    head:       layer('/characters/layered/emma/head.webp', 30, { x: 485, y: 300, originX: 0.47, originY: 0.22 }),
    eyesOpen:   layer(undefined, 40, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    eyesClosed: layer(undefined, 41, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    mouth:      layer(undefined, 42, { x: 512, y: 420, originX: 0.5, originY: 0.5 }),
    hairFront:  layer(undefined, 50, { x: 512, y: 300, originX: 0.5, originY: 0.74 }),
    leftArm:    layer(undefined, 60, { x: 355, y: 690, originX: 0.66, originY: 0.18 }),
    rightArm:   layer(undefined, 61, { x: 675, y: 700, originX: 0.34, originY: 0.18 }),
    accessory:  layer(undefined, 70, { x: 512, y: 555, originX: 0.5, originY: 0.5 }),
  },
};

const RIGS: Partial<Record<CharacterId, LayeredBestieRigManifest>> = {
  emma: EMMA_LAYERED_RIG,
};

export function getLayeredBestieRig(characterId: CharacterId): LayeredBestieRigManifest | null {
  return RIGS[characterId] ?? null;
}

/**
 * Phase-1 readiness only requires the real body + head pair. Later phases can
 * tighten this requirement when the facial and arm layers ship.
 */
export function hasCompleteLayeredBestieRig(characterId: CharacterId): boolean {
  const rig = getLayeredBestieRig(characterId);
  if (!rig) return false;
  return Boolean(rig.layers.body.src && rig.layers.head.src);
}
