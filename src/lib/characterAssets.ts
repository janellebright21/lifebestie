import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Asset manifest ───────────────────────────────────────────────────────────
// Controls which assets the component tries to load.
// Set hasPortrait / hasFullBody to true once the PNG/SVG files are in place.
// Add expression/outfit IDs to the arrays as each variant is produced.
//
// Convention on disk:
//   /public/characters/{id}/portrait/{expression}_{outfit}.png
//   /public/characters/{id}/full-body/{expression}_{outfit}.png

export interface CharacterAssetManifest {
  hasPortrait:  boolean;
  hasFullBody:  boolean;
  expressions:  AvatarExpression[];
  outfits:      OutfitId[];
}

const MANIFESTS: Record<CharacterId, CharacterAssetManifest> = {
  emma: { hasPortrait: false, hasFullBody: false, expressions: [], outfits: [] },
  ava:  { hasPortrait: false, hasFullBody: false, expressions: [], outfits: [] },
  nora: { hasPortrait: false, hasFullBody: false, expressions: [], outfits: [] },
  luna: { hasPortrait: false, hasFullBody: false, expressions: [], outfits: [] },
};

export function getManifest(id: CharacterId): CharacterAssetManifest {
  return MANIFESTS[id];
}

// ─── Path resolver ────────────────────────────────────────────────────────────
// Returns the expected public URL for a given character asset.
// Caller should confirm the manifest says the asset exists before using the path.

export function getAssetPath(
  id:         CharacterId,
  variant:    CharacterVariant,
  expression: AvatarExpression = 'happy',
  outfit:     OutfitId         = 'default',
): string {
  return `/characters/${id}/${variant}/${expression}_${outfit}.png`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasPortrait(id: CharacterId): boolean {
  return MANIFESTS[id].hasPortrait;
}

export function hasFullBody(id: CharacterId): boolean {
  return MANIFESTS[id].hasFullBody;
}

// Given a requested expression, return the best available expression for a
// character (falls back to 'happy', then first available, then null).
export function resolveExpression(
  id:         CharacterId,
  expression: AvatarExpression,
): AvatarExpression | null {
  const { expressions } = MANIFESTS[id];
  if (expressions.length === 0) return null;
  if (expressions.includes(expression)) return expression;
  if (expressions.includes('happy')) return 'happy';
  return expressions[0] ?? null;
}

// Given a requested outfit, return the best available outfit for a character.
export function resolveOutfit(
  id:     CharacterId,
  outfit: OutfitId,
): OutfitId | null {
  const { outfits } = MANIFESTS[id];
  if (outfits.length === 0) return null;
  if (outfits.includes(outfit)) return outfit;
  if (outfits.includes('default')) return 'default';
  return outfits[0] ?? null;
}
