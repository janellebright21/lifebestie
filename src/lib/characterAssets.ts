import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

function charUrl(name: string) { return `/characters/${name}.webp`; }

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: charUrl('emma'),
  ava:  charUrl('ava'),
  nora: charUrl('nora'),
  luna: charUrl('luna'),
};

const EXPRESSION_SPRITE_URL = '/characters/expression/bestie_expression_grid.webp';
const EXPRESSION_COLUMNS: AvatarExpression[] = ['happy', 'thinking', 'encouraging', 'proud', 'calm'];
const EXPRESSION_ROWS: CharacterId[] = ['emma', 'ava', 'nora', 'luna'];

function expressionSpriteDataUrl(id: CharacterId, expression: AvatarExpression): string | null {
  const column = EXPRESSION_COLUMNS.indexOf(expression);
  const row = EXPRESSION_ROWS.indexOf(id);
  if (column < 0 || row < 0) return null;

  const x = -(column * 128);
  const y = -(row * 128);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><image href="${EXPRESSION_SPRITE_URL}" x="${x}" y="${y}" width="640" height="512"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveExpressionSrc(
  id: CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  return expressionSpriteDataUrl(id, expression) ?? DEFAULT_IMAGES[id];
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
