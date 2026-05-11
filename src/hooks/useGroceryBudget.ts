import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, GroceryBudget } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';

export function useGroceryBudget() {
  const [budget, setBudget] = useState<GroceryBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const budgetRef = useRef<GroceryBudget | null>(null);

  useEffect(() => {
    budgetRef.current = budget;
  }, [budget]);

  const load = useCallback(async () => {
    const memoryId = localStorage.getItem(MEMORY_ID_KEY);
    if (!memoryId) { setLoading(false); return; }

    const { data } = await supabase
      .from('grocery_budget')
      .select('*')
      .eq('memory_id', memoryId)
      .maybeSingle();

    if (data) {
      setBudget(data as GroceryBudget);
    } else {
      // Create default budget row
      const { data: created } = await supabase
        .from('grocery_budget')
        .insert({
          memory_id: memoryId,
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
    await supabase
      .from('grocery_budget')
      .update({ weekly_budget: rounded, last_updated: new Date().toISOString().split('T')[0] })
      .eq('id', current.id);
  }

  async function setEstimatedTotal(total: number) {
    const current = budgetRef.current;
    if (!current) return;
    const rounded = Math.round(total * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const updated = { ...current, current_estimated_total: rounded, last_updated: today };
    setBudget(updated);
    await supabase
      .from('grocery_budget')
      .update({ current_estimated_total: rounded, last_updated: today })
      .eq('id', current.id);
  }

  return { budget, loading, setWeeklyBudget, setEstimatedTotal };
}
