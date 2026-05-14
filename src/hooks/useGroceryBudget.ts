import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, GroceryBudget } from '../lib/supabase';

export function useGroceryBudget() {
  const [budget, setBudget] = useState<GroceryBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const budgetRef = useRef<GroceryBudget | null>(null);

  useEffect(() => {
    budgetRef.current = budget;
  }, [budget]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('grocery_budget')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setBudget(data as GroceryBudget);
    } else {
      const { data: created } = await supabase
        .from('grocery_budget')
        .insert({
          user_id: user.id,
          weekly_budget: 100,
          current_estimated_total: 0,
          last_updated: new Date().toISOString().split('T')[0],
        })
        .select('*')
        .maybeSingle();
      if (created) setBudget(created as GroceryBudget);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setWeeklyBudget(amount: number) {
    const current = budgetRef.current;
    if (!current) return;
    const rounded = Math.round(amount * 100) / 100;
    const updated = { ...current, weekly_budget: rounded };
    setBudget(updated);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('grocery_budget')
      .update({ weekly_budget: rounded, last_updated: new Date().toISOString().split('T')[0] })
      .eq('id', current.id)
      .eq('user_id', user.id);
  }

  async function setEstimatedTotal(total: number) {
    const current = budgetRef.current;
    if (!current) return;
    const rounded = Math.round(total * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const updated = { ...current, current_estimated_total: rounded, last_updated: today };
    setBudget(updated);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('grocery_budget')
      .update({ current_estimated_total: rounded, last_updated: today })
      .eq('id', current.id)
      .eq('user_id', user.id);
  }

  return { budget, loading, setWeeklyBudget, setEstimatedTotal };
}
