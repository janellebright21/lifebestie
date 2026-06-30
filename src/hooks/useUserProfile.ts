import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, UserProfile, EMPTY_PROFILE, MainGoal, HouseholdType, WorkSchedule, Chronotype } from '../lib/supabase';

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

    // Re-fetch profile whenever the user signs in (handles login after mount).
    // We use the session object from the event to avoid calling getUser() inside
    // the callback, which can cause deadlocks on some platforms.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === 'SIGNED_IN' && authSession?.user) {
        setLoading(true);
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authSession.user.id)
          .maybeSingle()
          .then(({ data }) => {
            setProfile(data as UserProfile | null);
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
  }): Promise<void> {
    await saveProfile({ ...data, onboarding_done: true });
  }

  const needsOnboarding = !loading && (!profile || !profile.onboarding_done);

  return { profile, loading, needsOnboarding, saveProfile, completeOnboarding };
}
