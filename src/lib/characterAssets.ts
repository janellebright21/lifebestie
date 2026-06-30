import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Public URL helpers ───────────────────────────────────────────────────────
// Images live in /public/characters/ and are served as static files.
// No bundling — the browser fetches them lazily on first render.

function charUrl(name: string)       { return `/characters/${name}.webp`; }
function exprUrl(name: string)       { return `/characters/expression/${name}.webp`; }

// ─── Default character images ─────────────────────────────────────────────────

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: charUrl('emma'),
  ava:  charUrl('ava'),
  nora: charUrl('nora'),
  luna: charUrl('luna'),
};

// ─── Expression registry ──────────────────────────────────────────────────────

type ExpressionMap = Partial<Record<AvatarExpression, string>>;

const EXPRESSION_REGISTRY: Record<CharacterId, ExpressionMap> = {
  emma: {
    happy:       exprUrl('emma_happy'),
    thinking:    exprUrl('emma_thinking'),
    encouraging: exprUrl('emma_encouraging'),
    proud:       exprUrl('emma_proud'),
    calm:        exprUrl('emma_calm'),
  },
  ava: {
    happy:       exprUrl('ava_happy'),
    thinking:    exprUrl('ava_thinking'),
    encouraging: exprUrl('ava_confident'),
    proud:       exprUrl('ava_proud'),
    calm:        exprUrl('ava_focused'),
  },
  nora: {
    happy:       exprUrl('nora_happy'),
    thinking:    exprUrl('nora_helpful'),
    encouraging: exprUrl('nora_helpful'),
    proud:       exprUrl('nora_proud'),
    calm:        exprUrl('nora_cooking'),
  },
  luna: {
    happy:       exprUrl('luna_happy'),
    thinking:    exprUrl('luna_calm'),
    encouraging: exprUrl('luna_motivating'),
    proud:       exprUrl('luna_proud'),
    calm:        exprUrl('luna_calm'),
  },
};

/**
 * Returns the image src for a character + expression.
 * Falls back to the character's default image when no expression file is registered.
 */
export function resolveExpressionSrc(
  id:         CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  return EXPRESSION_REGISTRY[id]?.[expression] ?? DEFAULT_IMAGES[id];
}

export function getDefaultSrc(id: CharacterId): string {
  return DEFAULT_IMAGES[id];
}

// ─── Legacy manifest API (used by LifeBestieAvatar) ───────────────────────────

export interface CharacterAssetManifest {
  hasPortrait:  boolean;
  hasFullBody:  boolean;
  expressions:  AvatarExpression[];
  outfits:      OutfitId[];
}

const ALL_EXPRESSIONS: AvatarExpression[] = ['happy', 'encouraging', 'proud', 'calm', 'thinking', 'tired'];
const ALL_OUTFITS: OutfitId[]             = ['classic', 'cozy', 'professional', 'wellness'];

const MANIFESTS: Record<CharacterId, CharacterAssetManifest> = {
  emma: { hasPortrait: true,  hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  ava:  { hasPortrait: true,  hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  nora: { hasPortrait: true,  hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  luna: { hasPortrait: true,  hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
};

export function getManifest(id: CharacterId): CharacterAssetManifest {
  return MANIFESTS[id];
}

export function getAssetPath(
  id:         CharacterId,
  variant:    CharacterVariant,
  expression: AvatarExpression = 'happy',
  outfit:     OutfitId         = 'classic',
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
