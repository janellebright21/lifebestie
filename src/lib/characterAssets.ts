import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Asset manifest ───────────────────────────────────────────────────────────
// Controls which assets the component tries to load.
// Set hasPortrait / hasFullBody to true once the PNG/SVG files are in place.
// Add expression/outfit IDs to the arrays as each variant is produced.
//
// Convention on disk:
//   /public/characters/{id}/portrait/{expression}_{outfit}.png
//   /public/characters/{id}/full-body/{expression}_{outfit}.png
//
// Official required expressions: happy · encouraging · proud · calm · thinking · tired
// Official required outfits:     classic · cozy · professional · wellness

export interface CharacterAssetManifest {
  hasPortrait:  boolean;
  hasFullBody:  boolean;
  expressions:  AvatarExpression[];
  outfits:      OutfitId[];
}

// All four characters share the same required expressions and outfits per the
// official character guide. Flip the booleans and populate the arrays as each
// character's art is finalized — no component changes required.
const ALL_EXPRESSIONS: AvatarExpression[] = ['happy', 'encouraging', 'proud', 'calm', 'thinking', 'tired'];
const ALL_OUTFITS: OutfitId[]             = ['classic', 'cozy', 'professional', 'wellness'];

const MANIFESTS: Record<CharacterId, CharacterAssetManifest> = {
  emma: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  ava:  { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  nora: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  luna: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
};

export function getManifest(id: CharacterId): CharacterAssetManifest {
  return MANIFESTS[id];
}

// ─── Path resolver ────────────────────────────────────────────────────────────
// Returns the expected public URL for a given character asset.
// The component only loads the image when the manifest marks the variant as available.

export function getAssetPath(
  id:         CharacterId,
  variant:    CharacterVariant,
  expression: AvatarExpression = 'happy',
  outfit:     OutfitId         = 'classic',
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
  const manifest = MANIFESTS[id];
  if (!manifest.hasPortrait && !manifest.hasFullBody) return null;
  const { expressions } = manifest;
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
  const manifest = MANIFESTS[id];
  if (!manifest.hasPortrait && !manifest.hasFullBody) return null;
  const { outfits } = manifest;
  if (outfits.length === 0) return null;
  if (outfits.includes(outfit)) return outfit;
  if (outfits.includes('classic')) return 'classic';
  return outfits[0] ?? null;
}
