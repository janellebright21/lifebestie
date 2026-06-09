import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Meal, MealIngredient, MealType } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function parseIngQty(q?: string): number | null {
  if (!q) return null;
  const t = q.trim();
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]!) / parseInt(frac[2]!);
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function formatIngQty(n: number): string {
  const fracs: [number, string][] = [[1/4,'1/4'],[1/3,'1/3'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4']];
  for (const [val, str] of fracs) {
    if (Math.abs(n - val) < 0.005) return str;
  }
  return parseFloat(n.toFixed(2)).toString();
}

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

  async function updateMeal(id: string, patch: Partial<Pick<Meal, 'name' | 'meal_type' | 'meal_date' | 'ingredients'>>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMeals((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));
    await supabase.from('meals').update(patch).eq('id', id).eq('user_id', user.id);
  }

  async function duplicateMeal(id: string, newDate: string): Promise<Meal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const source = mealsRef.current.find((m) => m.id === id);
    if (!source) return null;
    const { data } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        memory_id: memoryId,
        name: source.name,
        meal_type: source.meal_type,
        meal_date: newDate,
        ingredients: source.ingredients,
      })
      .select()
      .single();
    if (!data) return null;
    const meal = data as Meal;
    setMeals((prev) => [meal, ...prev]);
    return meal;
  }

  /**
   * Merge all ingredients from the given meal IDs into a deduplicated list.
   * Same ingredient + same unit → sum quantities. Different units → separate rows.
   */
  function extractMergedIngredients(mealIds: string[]): MealIngredient[] {
    // key: "normalizedName|normalizedUnit"
    const consolidated = new Map<string, MealIngredient & { _totalQty: number | null }>();

    for (const id of mealIds) {
      const meal = mealsRef.current.find((m) => m.id === id);
      if (!meal) continue;
      for (const ing of meal.ingredients) {
        const normName = ing.name.toLowerCase().trim().replace(/\s+/g, ' ');
        const normUnit = (ing.unit ?? '').toLowerCase().trim();
        const key = `${normName}|${normUnit}`;
        const existing = consolidated.get(key);
        if (!existing) {
          const qty = parseIngQty(ing.quantity);
          consolidated.set(key, { ...ing, _totalQty: qty, mealSources: [meal.name] });
        } else {
          const incoming = parseIngQty(ing.quantity);
          if (existing._totalQty !== null && incoming !== null) {
            existing._totalQty += incoming;
          }
          if (!existing.mealSources) {
            existing.mealSources = [meal.name];
          } else if (!existing.mealSources.includes(meal.name)) {
            existing.mealSources.push(meal.name);
          }
        }
      }
    }

    return Array.from(consolidated.values()).map(({ _totalQty, ...ing }) => ({
      ...ing,
      quantity: _totalQty !== null ? formatIngQty(_totalQty) : ing.quantity,
    }));
  }

  return {
    meals,
    loading,
    addMeal,
    addMealFull,
    deleteMeal,
    updateMeal,
    duplicateMeal,
    extractMergedIngredients,
  };
}
