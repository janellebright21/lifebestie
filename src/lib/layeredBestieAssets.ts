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

const emptyLayer = (zIndex: number, anchor: LayerAnchor): LayeredBestieLayer => ({
  zIndex,
  anchor,
});

/**
 * Emma Phase 1 rig manifest.
 *
 * The coordinate system is intentionally defined now, before production PNGs
 * are added, so every future transparent layer can be exported against the
 * same canvas and will not jump when expressions or poses change.
 *
 * Do not add guessed/placeholder src values here. A layer becomes active only
 * after the corresponding production asset exists.
 */
export const EMMA_LAYERED_RIG: LayeredBestieRigManifest = {
  characterId: 'emma',
  canvas: { width: 1024, height: 1536 },
  layers: {
    hairBack:   emptyLayer(10, { x: 512, y: 310, originX: 0.5, originY: 0.72 }),
    body:       emptyLayer(20, { x: 512, y: 920, originX: 0.5, originY: 0.92 }),
    head:       emptyLayer(30, { x: 512, y: 360, originX: 0.5, originY: 0.78 }),
    eyesOpen:   emptyLayer(40, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    eyesClosed: emptyLayer(41, { x: 512, y: 345, originX: 0.5, originY: 0.5 }),
    mouth:      emptyLayer(42, { x: 512, y: 420, originX: 0.5, originY: 0.5 }),
    hairFront:  emptyLayer(50, { x: 512, y: 300, originX: 0.5, originY: 0.74 }),
    leftArm:    emptyLayer(60, { x: 355, y: 690, originX: 0.66, originY: 0.18 }),
    rightArm:   emptyLayer(61, { x: 675, y: 700, originX: 0.34, originY: 0.18 }),
    accessory:  emptyLayer(70, { x: 512, y: 555, originX: 0.5, originY: 0.5 }),
  },
};

const RIGS: Partial<Record<CharacterId, LayeredBestieRigManifest>> = {
  emma: EMMA_LAYERED_RIG,
};

export function getLayeredBestieRig(characterId: CharacterId): LayeredBestieRigManifest | null {
  return RIGS[characterId] ?? null;
}

export function hasCompleteLayeredBestieRig(characterId: CharacterId): boolean {
  const rig = getLayeredBestieRig(characterId);
  if (!rig) return false;

  const required: LayeredBestiePart[] = [
    'body',
    'head',
    'hairBack',
    'hairFront',
    'eyesOpen',
    'eyesClosed',
    'mouth',
    'leftArm',
    'rightArm',
  ];

  return required.every((part) => Boolean(rig.layers[part].src));
}
