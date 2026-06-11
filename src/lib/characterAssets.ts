import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Default character images ─────────────────────────────────────────────────

import emmaDefault from '../assets/characters/Public/Character/emma.png';
import avaDefault  from '../assets/characters/Public/Character/ava.png';
import noraDefault from '../assets/characters/Public/Character/nora.png';
import lunaDefault from '../assets/characters/Public/Character/luna.png';

// ─── Emma expression images ───────────────────────────────────────────────────
// Add imports here as each file is added to the project.
// Naming convention on disk: src/assets/characters/Public/Expression/Emma_Happy.png etc.
// When a file doesn't exist yet, set the value to null and the component falls
// back to the character's default image automatically.

import emmaHappy       from '../assets/characters/Public/Character/emma.png';
import emmaThinking    from '../assets/characters/Public/Character/emma.png';
import emmaEncouraging from '../assets/characters/Public/Character/emma.png';
import emmaProud       from '../assets/characters/Public/Character/emma.png';
import emmaCalm        from '../assets/characters/Public/Character/emma.png';

// When real expression files land, swap lines above for:
//   import emmaHappy       from '../assets/characters/Public/Expression/Emma_Happy.png';
//   import emmaThinking    from '../assets/characters/Public/Expression/Emma_Thinking.png';
//   import emmaEncouraging from '../assets/characters/Public/Expression/Emma_Encouraging.png';
//   import emmaProud       from '../assets/characters/Public/Expression/Emma_Proud.png';
//   import emmaCalm        from '../assets/characters/Public/Expression/Emma_Calm.png';

// ─── Expression registry ──────────────────────────────────────────────────────
// Maps character → expression → bundled image URL (or null = use default).
// Only expressions that have distinct artwork need an entry.

type ExpressionMap = Partial<Record<AvatarExpression, string | null>>;

const EXPRESSION_REGISTRY: Record<CharacterId, ExpressionMap> = {
  emma: {
    happy:       emmaHappy,
    thinking:    emmaThinking,
    encouraging: emmaEncouraging,
    proud:       emmaProud,
    calm:        emmaCalm,
  },
  ava:  {},
  nora: {},
  luna: {},
};

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: emmaDefault,
  ava:  avaDefault,
  nora: noraDefault,
  luna: lunaDefault,
};

/**
 * Returns the best available image src for a character + expression.
 * Falls back to the character's default image when no expression-specific
 * image is registered.
 */
export function resolveExpressionSrc(
  id:         CharacterId,
  expression: AvatarExpression = 'happy',
): string {
  const map = EXPRESSION_REGISTRY[id] ?? {};
  const src = map[expression];
  if (src != null) return src;
  return DEFAULT_IMAGES[id];
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
  emma: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  ava:  { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  nora: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
  luna: { hasPortrait: false, hasFullBody: false, expressions: ALL_EXPRESSIONS, outfits: ALL_OUTFITS },
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

export function hasPortrait(id: CharacterId): boolean  { return MANIFESTS[id].hasPortrait; }
export function hasFullBody(id: CharacterId): boolean  { return MANIFESTS[id].hasFullBody; }

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

export function resolveOutfit(id: CharacterId, outfit: OutfitId): OutfitId | null {
  const manifest = MANIFESTS[id];
  if (!manifest.hasPortrait && !manifest.hasFullBody) return null;
  const { outfits } = manifest;
  if (outfits.length === 0) return null;
  if (outfits.includes(outfit)) return outfit;
  if (outfits.includes('classic')) return 'classic';
  return outfits[0] ?? null;
}
