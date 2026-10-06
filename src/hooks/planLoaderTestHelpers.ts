import { supabase } from '../lib/supabase';
import type { PlanItem } from './useDailyPlanner';

export type { PlanItem };

export async function loadPlanItems(date: string): Promise<PlanItem[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to load your plan.');
  const { data, error } = await supabase
    .from('daily_plans')
    .select('plan_items')
    .eq('user_id', user.id)
    .eq('plan_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data === null) return null;
  const raw = data.plan_items;
  if (raw === null) return [];
  if (!Array.isArray(raw)) throw new Error('Saved plan data is corrupted and could not be loaded.');
  return raw as PlanItem[];
}

export async function savePlanItems(date: string, items: PlanItem[]): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  const { error } = await supabase
    .from('daily_plans')
    .upsert(
      {
        user_id: user.id,
        plan_date: date,
        plan_items: items,
      },
      { onConflict: 'user_id,plan_date' },
    );
  if (error) return { error: error.message };
  return { error: null };
}
