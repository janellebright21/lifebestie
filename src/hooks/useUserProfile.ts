import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, UserProfile, EMPTY_PROFILE, MainGoal, HouseholdType, WorkSchedule, Chronotype, CharacterId } from '../lib/supabase';

export type ProfilePatch = Partial<Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'>>;

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    setProfile(data as UserProfile | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial load — handles app-start when a session already exists
    load();

    // Re-fetch profile only on an actual sign-in (new authentication), not on
    // TOKEN_REFRESHED or INITIAL_SESSION (which also fire SIGNED_IN on some builds).
    // We track whether a profile has been loaded at least once so we don't call
    // setLoading(true) during background token refresh — that would re-trigger the
    // full-screen loading guard in App.tsx and navigate away from the active tab.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_IN' && authSession?.user) {
        // Only set loading=true when we have no profile yet (first login).
        // If we already have a profile, silently refresh in the background.
        setLoading((prev) => {
          if (prev) return true; // already loading — leave as-is
          return false;          // already loaded once — don't show loading spinner
        });
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authSession.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setProfile((prev) => {
              // If we already have a profile and data is null (no row yet), keep existing
              if (prev && !data) return prev;
              return data as UserProfile | null;
            });
            setLoading(false);
          });
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [load]);

  async function saveProfile(patch: ProfilePatch): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const next: UserProfile = {
      ...(profile ?? { ...EMPTY_PROFILE, user_id: user.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
      ...patch,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    setProfile(next);

    const { error } = await supabase
      .from('user_profiles')
      .upsert(next, { onConflict: 'user_id' });
    dbError('user_profiles (upsert)', error);
  }

  async function completeOnboarding(data: {
    preferred_name: string;
    household_type: HouseholdType;
    work_schedule: WorkSchedule;
    chronotype: Chronotype;
    main_goals: MainGoal[];
    biggest_challenge: string;
    character_id: CharacterId;
  }): Promise<void> {
    await saveProfile({ ...data, onboarding_done: true });
  }

  const needsOnboarding = !loading && (!profile || !profile.onboarding_done);

  return { profile, loading, needsOnboarding, saveProfile, completeOnboarding };
}
