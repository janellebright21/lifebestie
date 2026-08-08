import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Public URL helpers ───────────────────────────────────────────────────────
// Images live in /public/characters/ and are served as static files.

function charUrl(name: string) { return `/characters/${name}.webp`; }

// ─── Default character images ─────────────────────────────────────────────────

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: charUrl('emma'),
  ava:  charUrl('ava'),
  nora: charUrl('nora'),
  luna: charUrl('luna'),
};

// ─── Expression sprite registry ───────────────────────────────────────────────
// Refreshed expression art is stored in one compact 5×4 sprite sheet:
// columns = happy, thinking, encouraging, proud, calm
// rows    = Emma, Ava, Nora, Luna

export const EXPRESSION_SPRITE_URL = '/characters/expression/bestie_expression_grid.webp';

export const EXPRESSION_SPRITE_COLUMNS: AvatarExpression[] = [
  'happy', 'thinking', 'encouraging', 'proud', 'calm',
];

export const EXPRESSION_SPRITE_ROWS: CharacterId[] = [
  'emma', 'ava', 'nora', 'luna',
];

export interface ExpressionSpritePosition {
  column: number;
  row: number;
}

export function getExpressionSpritePosition(
  id: CharacterId,
  expression: AvatarExpression = 'happy',
): ExpressionSpritePosition | null {
  const row = EXPRESSION_SPRITE_ROWS.indexOf(id);
  const column = EXPRESSION_SPRITE_COLUMNS.indexOf(expression);
  if (row < 0 || column < 0) return null;
  return { column, row };
}

/**
 * Returns the image src for a character + expression.
 * The five primary expressions use the new shared sprite sheet.
 * Any unsupported expression (currently tired) falls back to the default portrait.
 */
export function resolveExpressionSrc(
  id: CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  return getExpressionSpritePosition(id, expression)
    ? EXPRESSION_SPRITE_URL
    : DEFAULT_IMAGES[id];
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
