import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Meal, MealIngredient, GroceryCategory } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function fetchIngredients(mealName: string): Promise<MealIngredient[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/meal-ingredients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ mealName }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.ingredients) ? data.ingredients : [];
  } catch {
    return [];
  }
}

export function useMealPlanner() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const memoryId = localStorage.getItem(MEMORY_ID_KEY);
  const mealsRef = useRef<Meal[]>([]);

  useEffect(() => {
    mealsRef.current = meals;
  }, [meals]);

  const load = useCallback(async () => {
    if (!memoryId) { setLoading(false); return; }
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('memory_id', memoryId)
      .order('created_at', { ascending: false });
    if (data) setMeals(data as Meal[]);
    setLoading(false);
  }, [memoryId]);

  useEffect(() => { load(); }, [load]);

  /** Add a new meal, fetching ingredients via AI. Returns the created meal. */
  async function addMeal(name: string): Promise<Meal | null> {
    if (!memoryId) return null;
    const ingredients = await fetchIngredients(name);
    const { data } = await supabase
      .from('meals')
      .insert({ memory_id: memoryId, name, ingredients })
      .select()
      .single();
    if (!data) return null;
    const meal = data as Meal;
    setMeals((prev) => [meal, ...prev]);
    return meal;
  }

  async function deleteMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    await supabase.from('meals').delete().eq('id', id);
  }

  /**
   * Merge all ingredients from the given meal IDs into a deduplicated list.
   * When the same ingredient appears in multiple meals, keep only one entry,
   * preserving the first category seen.
   */
  function extractMergedIngredients(mealIds: string[]): MealIngredient[] {
    const seen = new Map<string, GroceryCategory>();
    for (const id of mealIds) {
      const meal = mealsRef.current.find((m) => m.id === id);
      if (!meal) continue;
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, ing.category);
      }
    }
    return Array.from(seen.entries()).map(([name, category]) => ({
      // Restore original casing from first occurrence
      name: mealsRef.current
        .flatMap((m) => m.ingredients)
        .find((i) => i.name.toLowerCase() === name)?.name ?? name,
      category,
    }));
  }

  return {
    meals,
    loading,
    addMeal,
    deleteMeal,
    extractMergedIngredients,
  };
}
