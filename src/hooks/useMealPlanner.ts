import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Meal, MealIngredient, MealType, GroceryCategory } from '../lib/supabase';

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setMeals(data as Meal[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);


  /** Add a new meal, fetching ingredients via AI. Returns the created meal. */
  async function addMeal(name: string): Promise<Meal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const ingredients = await fetchIngredients(name);
    const { data } = await supabase
      .from('meals')
    .insert({
  memory_id: memoryId,
  user_id: user.id,
  name,
  meal_date: new Date().toISOString().split('T')[0],
  ingredients
})
      .select()
      .single();
    if (!data) return null;
    const meal = data as Meal;
    setMeals((prev) => [meal, ...prev]);
    return meal;
  }

  /**
   * Add a meal with full details: meal_type, meal_date, and explicit ingredients.
   * Does NOT call the AI ingredients fetch — ingredients are provided by the caller.
   */
  async function addMealFull(opts: {
    name: string;
    meal_type: MealType;
    meal_date: string;
    ingredients: MealIngredient[];
  }): Promise<Meal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('meals')
      .insert({
        memory_id: memoryId,
        user_id: user.id,
        name: opts.name,
        meal_type: opts.meal_type,
        meal_date: opts.meal_date,
        ingredients: opts.ingredients,
      })
      .select()
      .single();
    if (!data) return null;
    const meal = data as Meal;
    setMeals((prev) => [meal, ...prev]);
    return meal;
  }

  async function deleteMeal(id: string) {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('meals').delete().eq('id', id).eq('user_id', user.id);
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
    addMealFull,
    deleteMeal,
    extractMergedIngredients,
  };
}
