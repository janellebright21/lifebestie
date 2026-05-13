import { useState, useEffect, useCallback } from 'react';
import { supabase, PastelColorKey, DEFAULT_CATEGORY_COLORS, PASTEL_COLOR_MAP, PastelColor, TASK_CATEGORIES } from '../lib/supabase';

export type CategoryColorMap = Record<string, PastelColorKey>;

interface UseCategoryColorsReturn {
  colorMap: CategoryColorMap;
  getColor: (category: string) => PastelColor;
  setColor: (category: string, colorKey: PastelColorKey) => Promise<void>;
  loading: boolean;
}

export function useCategoryColors(): UseCategoryColorsReturn {
  const [colorMap, setColorMap] = useState<CategoryColorMap>({ ...DEFAULT_CATEGORY_COLORS });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('category_colors')
        .select('category, color_key')
        .eq('user_id', user.id);
      if (data && data.length > 0) {
        const saved: CategoryColorMap = {};
        for (const row of data) saved[row.category] = row.color_key as PastelColorKey;
        setColorMap((prev) => ({ ...prev, ...saved }));
      }
      setLoading(false);
    }
    load();
  }, []);

  const setColor = useCallback(async (category: string, colorKey: PastelColorKey) => {
    setColorMap((prev) => ({ ...prev, [category]: colorKey }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('category_colors')
      .upsert(
        { user_id: user.id, category, color_key: colorKey, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,category' }
      );
  }, []);

  const getColor = useCallback((category: string): PastelColor => {
    const key = colorMap[category] ?? DEFAULT_CATEGORY_COLORS[category] ?? 'gray';
    return PASTEL_COLOR_MAP[key as PastelColorKey] ?? PASTEL_COLOR_MAP['gray'];
  }, [colorMap]);

  return { colorMap, getColor, setColor, loading };
}

/** Seed default colors for the signed-in user if none exist yet. */
export async function seedDefaultColors() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from('category_colors')
    .select('category')
    .eq('user_id', user.id);
  const existing = new Set((data ?? []).map((r: { category: string }) => r.category));
  const rows = TASK_CATEGORIES
    .filter((c) => !existing.has(c))
    .map((c) => ({ user_id: user.id, category: c, color_key: DEFAULT_CATEGORY_COLORS[c] ?? 'gray' }));
  if (rows.length > 0) {
    await supabase.from('category_colors').insert(rows);
  }
}
