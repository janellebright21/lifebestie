import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

function charUrl(name: string) { return `/characters/${name}.webp`; }
function exprUrl(name: string) { return `/characters/expression/${name}.svg`; }

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: charUrl('emma'),
  ava:  charUrl('ava'),
  nora: charUrl('nora'),
  luna: charUrl('luna'),
};

const PRIMARY_EXPRESSIONS: AvatarExpression[] = ['happy', 'thinking', 'encouraging', 'proud', 'calm'];

export function resolveExpressionSrc(
  id: CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  return PRIMARY_EXPRESSIONS.includes(expression)
    ? exprUrl(`${id}_${expression}`)
    : DEFAULT_IMAGES[id];
}

export function getDefaultSrc(id: CharacterId): string {
  return DEFAULT_IMAGES[id];
}

export interface CharacterAssetManifest {
  hasPortrait: boolean;
  hasFullBody: boolean;
  expressions: AvatarExpression[];
  outfits: OutfitId[];
}

const ALL_EXPRESSIONS: AvatarExpression[] = ['happy', 'encouraging', 'proud', 'calm', 'thinking', 'tired'];
const ALL_OUTFITS: OutfitId[] = ['classic', 'cozy', 'professional', 'wellness'];

const MANIFESTS: Record<CharacterId, CharacterAssetManifest> = {
  emma: { hasPortrait: true, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  ava:  { hasPortrait: true, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  nora: { hasPortrait: true, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  luna: { hasPortrait: true, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
};

export function getManifest(id: CharacterId): CharacterAssetManifest {
  return MANIFESTS[id];
}

export function getAssetPath(
  id: CharacterId,
  variant: CharacterVariant,
  expression: AvatarExpression = 'happy',
  outfit: OutfitId = 'classic',
): string {
  return `/characters/${id}/${variant}/${expression}_${outfit}.png`;
}

export function hasPortrait(id: CharacterId): boolean { return MANIFESTS[id].hasPortrait; }
export function hasFullBody(id: CharacterId): boolean { return MANIFESTS[id].hasFullBody; }

export function resolveExpression(id: CharacterId, expression: AvatarExpression): AvatarExpression | null {
  const manifest = MANIFESTS[id];
  if (!manifest.hasPortrait && !manifest.hasFullBody) return null;
  const { expressions } = manifest;
  if (expressions.length === 0) return null;
  if (expressions.includes(expression)) return expression;
  if (expressions.includes('happy')) return 'happy';
  return expressions[0] ?? null;
}

export function resolveOutfit(id: CharacterId, outfit: OutfitId): OutfitId | null {
  const manifest = MANIFESTS[id];
  if (!manifest.hasPortrait && !manifest.hasFullBody) return null;
  const { outfits } = manifest;
  if (outfits.length === 0) return null;
  if (outfits.includes(outfit)) return outfit;
  if (outfits.includes('classic')) return 'classic';
  return outfits[0] ?? null;
}
