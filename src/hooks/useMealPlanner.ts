import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, dbError, Meal, MealIngredient, MealType } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const DEV = import.meta.env.DEV;

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

/** Local YYYY-MM-DD in the user's timezone — avoids UTC date shift. */
function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    if (DEV) console.log('[useMealPlanner] load: user_id =', user.id);
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      dbError('meals (select)', error);
    } else {
      if (DEV) console.log('[useMealPlanner] load: meals returned =', data?.length ?? 0);
      setMeals(data as Meal[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);


  /** Add a new meal, fetching ingredients via AI. Returns the created meal or throws. */
  async function addMeal(name: string): Promise<Meal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user. Please sign in and try again.');
    }
    if (DEV) console.log('[useMealPlanner] addMeal: user_id =', user.id);
    const meal_date = localDateStr();
    const ingredients = await fetchIngredients(name);
    const payload = {
      memory_id: memoryId,
      user_id: user.id,
      name,
      meal_date,
      ingredients,
    };
    if (DEV) console.log('[useMealPlanner] addMeal: submitted meal_date =', meal_date);
    if (DEV) console.log('[useMealPlanner] addMeal: insert payload =', payload);

    const { data, error } = await supabase
      .from('meals')
      .insert(payload)
      .select()
      .single();
    if (error) {
      dbError('meals (insert)', error);
      if (DEV) console.error('[useMealPlanner] addMeal: insert error =', JSON.stringify(error));
      throw new Error('We couldn\'t save this meal. Please check your connection and try again.');
    }
    const meal = data as Meal;
    if (DEV) console.log('[useMealPlanner] addMeal: inserted row =', meal);

    // Immediately add the returned meal to React state.
    setMeals((prev) => [meal, ...prev]);

    // Re-fetch the correct week in the background to confirm persistence.
    supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data: refreshed, error: rErr }) => {
        if (rErr) {
          dbError('meals (refresh)', rErr);
          return;
        }
        if (DEV) console.log('[useMealPlanner] addMeal: meals after refresh =', refreshed?.length ?? 0);
        if (refreshed) setMeals(refreshed as Meal[]);
      });

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
  }): Promise<Meal> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user. Please sign in and try again.');
    }
    if (DEV) console.log('[useMealPlanner] addMealFull: user_id =', user.id);
    if (DEV) console.log('[useMealPlanner] addMealFull: submitted meal_date =', opts.meal_date);

    const payload = {
      memory_id: memoryId,
      user_id: user.id,
      name: opts.name,
      meal_type: opts.meal_type,
      meal_date: opts.meal_date,
      ingredients: opts.ingredients,
    };
    if (DEV) console.log('[useMealPlanner] addMealFull: insert payload =', payload);

    const { data, error } = await supabase
      .from('meals')
      .insert(payload)
      .select()
      .single();
    if (error) {
      dbError('meals (insert)', error);
      if (DEV) console.error('[useMealPlanner] addMealFull: insert error =', JSON.stringify(error));
      throw new Error('We couldn\'t save this meal. Please check your connection and try again.');
    }
    const meal = data as Meal;
    if (DEV) console.log('[useMealPlanner] addMealFull: inserted row =', meal);

    setMeals((prev) => [meal, ...prev]);

    supabase
      .from('meals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data: refreshed, error: rErr }) => {
        if (rErr) {
          dbError('meals (refresh)', rErr);
          return;
        }
        if (DEV) console.log('[useMealPlanner] addMealFull: meals after refresh =', refreshed?.length ?? 0);
        if (refreshed) setMeals(refreshed as Meal[]);
      });

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
    const { data, error } = await supabase
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
    if (error) {
      dbError('meals (duplicate insert)', error);
      return null;
    }
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
