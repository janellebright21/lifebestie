import { useCallback } from 'react';
import { UserProfile } from '../lib/supabase';
import { useUserProfile, ProfilePatch } from './useUserProfile';

export interface BestieNotes {
  preferred_name: string;
  character_id: string;
  planning_struggle: string;
  meal_preference: string;
  wellness_preference: string;
  encouragement_style: string;
}

const EMPTY_NOTES: BestieNotes = {
  preferred_name:      '',
  character_id:        'emma',
  planning_struggle:   '',
  meal_preference:     '',
  wellness_preference: '',
  encouragement_style: '',
};

function profileToNotes(profile: UserProfile | null): BestieNotes {
  if (!profile) return EMPTY_NOTES;
  return {
    preferred_name:      profile.preferred_name ?? '',
    character_id:        profile.character_id ?? 'emma',
    planning_struggle:   profile.planning_struggle ?? '',
    meal_preference:     profile.meal_preference ?? '',
    wellness_preference: profile.wellness_preference ?? '',
    encouragement_style: profile.encouragement_style ?? '',
  };
}

/**
 * Thin wrapper over useUserProfile that exposes only the soft personalization
 * note fields. Keeps concerns separated so callers don't need the full profile.
 */
export function useBestiePersonalization() {
  const { profile, loading, saveProfile } = useUserProfile();

  const notes = profileToNotes(profile);

  const saveNotes = useCallback(
    async (patch: Partial<BestieNotes>) => {
      await saveProfile(patch as ProfilePatch);
    },
    [saveProfile],
  );

  return { notes, loading, saveNotes };
}

/**
 * Build a context-aware greeting using personalization notes.
 * Returns a single short sentence — suitable for speech bubbles and header subtitles.
 */
export function buildBestieGreeting(
  notes: BestieNotes,
  memoriesCount: number,
  timeOfDay: 'morning' | 'afternoon' | 'evening',
): string {
  const name = notes.preferred_name;
  const nameFragment = name ? `, ${name}` : '';

  // Use the most relevant note to personalise the greeting
  if (notes.planning_struggle && memoriesCount >= 4) {
    const struggle = notes.planning_struggle.toLowerCase();
    const greetings: Record<string, string> = {
      morning: `Good morning${nameFragment}! Let's tackle ${struggle} together today.`,
      afternoon: `Hey${nameFragment}! Still working on ${struggle}? You've got this.`,
      evening: `Evening${nameFragment}! Let's wrap up and not let ${struggle} linger.`,
    };
    return greetings[timeOfDay]!;
  }

  if (notes.wellness_preference && memoriesCount >= 4) {
    const wellness = notes.wellness_preference.toLowerCase();
    const greetings: Record<string, string> = {
      morning: `Good morning${nameFragment}! Ready for some ${wellness} today?`,
      afternoon: `Hey${nameFragment}! Have you squeezed in your ${wellness} yet?`,
      evening: `Good evening${nameFragment}! A little ${wellness} before bed sounds perfect.`,
    };
    return greetings[timeOfDay]!;
  }

  if (notes.encouragement_style && memoriesCount >= 4) {
    if (notes.encouragement_style.toLowerCase().includes('gentle')) {
      return `Hey${nameFragment} — no pressure today. One thing at a time.`;
    }
    if (notes.encouragement_style.toLowerCase().includes('motivat')) {
      return `Let's go${nameFragment}! You always show up and it shows.`;
    }
  }

  // Fallback by time of day
  const defaults: Record<string, string> = {
    morning: `Good morning${nameFragment}! Let's make today a good one.`,
    afternoon: `Hey${nameFragment}! Checking in — how's your day going?`,
    evening: `Good evening${nameFragment}! You made it through another day.`,
  };
  return defaults[timeOfDay]!;
}
