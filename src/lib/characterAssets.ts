import { CharacterId, CharacterVariant, AvatarExpression, OutfitId } from './supabase';

// ─── Default character images ─────────────────────────────────────────────────

import emmaDefault from '../assets/characters/Public/Character/emma.png';
import avaDefault  from '../assets/characters/Public/Character/ava.png';
import noraDefault from '../assets/characters/Public/Character/nora.png';
import lunaDefault from '../assets/characters/Public/Character/luna.png';

// ─── Emma expressions ─────────────────────────────────────────────────────────

import emmaHappy       from '../assets/characters/Public/Character/expression/emma_happy.png.png';
import emmaThinking    from '../assets/characters/Public/Character/expression/emma_thinking.png.png';
import emmaEncouraging from '../assets/characters/Public/Character/expression/emma_encouraging.png';
import emmaProud       from '../assets/characters/Public/Character/expression/emma_proud.png.png';
import emmaCalm        from '../assets/characters/Public/Character/expression/emma_calm.png.png';

// ─── Ava expressions ──────────────────────────────────────────────────────────
// ava_confident → encouraging  |  ava_focused → calm  |  ava_planning → fallback

import avaHappy      from '../assets/characters/Public/Character/expression/Ava_Happy.png.png';
import avaThinking   from '../assets/characters/Public/Character/expression/ava_thinking.png.png';
import avaConfident  from '../assets/characters/Public/Character/expression/ava_confident.png.png';
import avaProud      from '../assets/characters/Public/Character/expression/ava_proud.png.png';
import avaFocused    from '../assets/characters/Public/Character/expression/ava_focused.png.png';

// ─── Nora expressions ─────────────────────────────────────────────────────────
// nora_helpful → thinking + encouraging  |  nora_cooking → calm

import noraHappy    from '../assets/characters/Public/Character/expression/nora_happy.png.png';
import noraHelpful  from '../assets/characters/Public/Character/expression/nora_helpful.png.png';
import noraProud    from '../assets/characters/Public/Character/expression/nora_proud.png.png';
import noraCooking  from '../assets/characters/Public/Character/expression/nora_cooking.png.png';

// ─── Luna expressions ─────────────────────────────────────────────────────────
// luna_motivating → encouraging  |  luna_calm → calm + thinking

import lunaHappy      from '../assets/characters/Public/Character/expression/luna_happy.png.png';
import lunaMotivating from '../assets/characters/Public/Character/expression/luna_motivating.png.png';
import lunaProud      from '../assets/characters/Public/Character/expression/luna_proud.png.png';
import lunaCalm       from '../assets/characters/Public/Character/expression/luna_calm.png.png';

// ─── Expression registry ──────────────────────────────────────────────────────

type ExpressionMap = Partial<Record<AvatarExpression, string>>;

const EXPRESSION_REGISTRY: Record<CharacterId, ExpressionMap> = {
  emma: {
    happy:       emmaHappy,
    thinking:    emmaThinking,
    encouraging: emmaEncouraging,
    proud:       emmaProud,
    calm:        emmaCalm,
  },
  ava: {
    happy:       avaHappy,
    thinking:    avaThinking,
    encouraging: avaConfident,
    proud:       avaProud,
    calm:        avaFocused,
  },
  nora: {
    happy:       noraHappy,
    thinking:    noraHelpful,
    encouraging: noraHelpful,
    proud:       noraProud,
    calm:        noraCooking,
  },
  luna: {
    happy:       lunaHappy,
    thinking:    lunaCalm,
    encouraging: lunaMotivating,
    proud:       lunaProud,
    calm:        lunaCalm,
  },
};

const DEFAULT_IMAGES: Record<CharacterId, string> = {
  emma: emmaDefault,
  ava:  avaDefault,
  nora: noraDefault,
  luna: lunaDefault,
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
