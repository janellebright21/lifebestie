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
 * Emma V1 production rig.
 *
 * Body and head are independently movable on the approved 1024x1536 Emma canvas.
 * A transparent closed-eye SVG overlay enables randomized blinking, and a subtle
 * smile overlay can be shown for warmer motion states without replacing the base
 * face artwork. Hair and arm layers remain intentionally empty until ready.
 */
export const EMMA_LAYERED_RIG: LayeredBestieRigManifest = {
  characterId: 'emma',
  canvas: { width: 1024, height: 1536 },
  layers: {
    hairBack:   layer(undefined, 10, { x: 512, y: 310, originX: 0.5, originY: 0.72 }),
    body:       layer('/characters/layered/emma/body.webp', 20, { x: 512, y: 920, originX: 0.5, originY: 0.92 }),
    head:       layer('/characters/layered/emma/head.webp', 30, { x: 485, y: 300, originX: 0.47, originY: 0.22 }),
    eyesOpen:   layer(undefined, 40, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    eyesClosed: layer('/characters/layered/emma/eyes-closed.svg', 41, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    mouth:      layer('/characters/layered/emma/mouth-smile.svg', 42, { x: 486, y: 248, originX: 0.5, originY: 0.5 }),
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
 * V1 readiness requires the real body + head pair. Facial overlays enhance the
 * rig but are not required for a safe fallback-capable render.
 */
export function hasCompleteLayeredBestieRig(characterId: CharacterId): boolean {
  const rig = getLayeredBestieRig(characterId);
  if (!rig) return false;
  return Boolean(rig.layers.body.src && rig.layers.head.src);
}
