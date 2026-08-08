import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

function charUrl(name: string) { return `/characters/${name}.webp`; }
function exprWebpUrl(name: string) { return `/characters/expression/${name}.webp`; }

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: charUrl('emma'),
  ava:  charUrl('ava'),
  nora: charUrl('nora'),
  luna: charUrl('luna'),
};

/**
 * Primary expressions now resolve directly to valid WebP assets instead of the
 * generated SVG wrappers. Those wrappers depended on bestie_expression_grid.webp,
 * which is not a decodable WebP file and could leave the avatar blank because
 * the outer SVG itself still loaded successfully.
 *
 * Some characters do not yet have a dedicated WebP for every primary state, so
 * those states intentionally map to the closest existing illustration until a
 * dedicated asset is added.
 */
const EXPRESSION_IMAGES: Record<CharacterId, Partial<Record<AvatarExpression, string>>> = {
  emma: {
    happy:        exprWebpUrl('emma_happy'),
    thinking:     exprWebpUrl('emma_thinking'),
    encouraging:  exprWebpUrl('emma_encouraging'),
    proud:        exprWebpUrl('emma_proud'),
    calm:         exprWebpUrl('emma_calm'),
  },
  ava: {
    happy:        exprWebpUrl('ava_happy'),
    thinking:     exprWebpUrl('ava_thinking'),
    encouraging:  exprWebpUrl('ava_confident'),
    proud:        exprWebpUrl('ava_proud'),
    calm:         exprWebpUrl('ava_happy'),
  },
  nora: {
    happy:        exprWebpUrl('nora_happy'),
    thinking:     exprWebpUrl('nora_cooking'),
    encouraging:  exprWebpUrl('nora_helpful'),
    proud:        exprWebpUrl('nora_proud'),
    calm:         exprWebpUrl('nora_happy'),
  },
  luna: {
    happy:        exprWebpUrl('luna_happy'),
    thinking:     exprWebpUrl('luna_calm'),
    encouraging:  exprWebpUrl('luna_motivating'),
    proud:        exprWebpUrl('luna_proud'),
    calm:         exprWebpUrl('luna_calm'),
  },
};

export function resolveExpressionSrc(
  id: CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  return EXPRESSION_IMAGES[id][expression] ?? DEFAULT_IMAGES[id];
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
