import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const DEFAULT_PREP_ITEMS = [
  "Review tomorrow's schedule",
  'Set out clothes or bags',
  'Prep lunch or snacks',
  'Check dinner plan',
];

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function calcStreak(
  rows: { prep_date: string; checked_items: string[] }[],
  allItemTitles: string[],
): number {
  const totalCount = allItemTitles.length;
  const completedDates = new Set(
    rows
      .filter((r) => r.checked_items.length >= totalCount)
      .map((r) => r.prep_date),
  );
  let streak = 0;
  let cursor = getTomorrowDate();
  while (completedDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface CustomPrepItem {
  id: string;
  title: string;
}

export interface TomorrowPrepChecklistResult {
  checked: Set<string>;
  toggle: (item: string) => void;
  loading: boolean;
  streak: number;
  allDone: boolean;
  justCompleted: boolean;
  customItems: CustomPrepItem[];
  addCustomItem: (title: string) => Promise<void>;
  deleteCustomItem: (id: string, title: string) => Promise<void>;
}

export function useTomorrowPrepChecklist(): TomorrowPrepChecklistResult {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);
  const [customItems, setCustomItems] = useState<CustomPrepItem[]>([]);
  const prevAllDone = useRef(false);
  const prepDate = getTomorrowDate();

  // Total item count = defaults + custom; used for streak calculation
  const allItemTitles = [
    ...DEFAULT_PREP_ITEMS,
    ...customItems.map((c) => c.title),
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }

        const [checklistRes, customRes] = await Promise.all([
          supabase
            .from('tomorrow_prep_checklist')
            .select('prep_date, checked_items')
            .eq('user_id', user.id)
            .order('prep_date', { ascending: false })
            .limit(60),
          supabase
            .from('user_prep_items')
            .select('id, title')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true }),
        ]);

        if (!cancelled) {
          const rows = (checklistRes.data ?? []) as { prep_date: string; checked_items: string[] }[];
          const items = (customRes.data ?? []) as CustomPrepItem[];
          const todayRow = rows.find((r) => r.prep_date === prepDate);
          const totalTitles = [...DEFAULT_PREP_ITEMS, ...items.map((c) => c.title)];
          setChecked(new Set(todayRow?.checked_items ?? []));
          setCustomItems(items);
          setStreak(calcStreak(rows, totalTitles));
          prevAllDone.current = (todayRow?.checked_items?.length ?? 0) >= totalTitles.length;
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepDate]);

  const persistChecked = useCallback(
    async (items: string[], userId: string) => {
      const { error } = await supabase
        .from('tomorrow_prep_checklist')
        .upsert(
          { user_id: userId, prep_date: prepDate, checked_items: items },
          { onConflict: 'user_id,prep_date' },
        );
      if (error) { console.error('[tomorrow_prep_checklist]', error.message); return; }

      const { data } = await supabase
        .from('tomorrow_prep_checklist')
        .select('prep_date, checked_items')
        .eq('user_id', userId)
        .order('prep_date', { ascending: false })
        .limit(60);
      if (data) {
        setStreak((prev) => {
          const next = calcStreak(
            data as { prep_date: string; checked_items: string[] }[],
            allItemTitles,
          );
          return next !== prev ? next : prev;
        });
      }
    },
    // allItemTitles length changes when custom items are added/removed — that's fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prepDate, allItemTitles.join(',')],
  );

  const toggle = useCallback(async (item: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);

      const items = Array.from(next);
      const nowAllDone = items.length >= allItemTitles.length;

      if (nowAllDone && !prevAllDone.current) {
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 5000);
      }
      prevAllDone.current = nowAllDone;

      persistChecked(items, user.id);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistChecked, allItemTitles.length]);

  const addCustomItem = useCallback(async (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_prep_items')
      .insert({ user_id: user.id, title: trimmed })
      .select('id, title')
      .single();

    if (!error && data) {
      setCustomItems((prev) => [...prev, data as CustomPrepItem]);
    }
  }, []);

  const deleteCustomItem = useCallback(async (id: string, title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_prep_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (!error) {
      setCustomItems((prev) => prev.filter((c) => c.id !== id));
      // Also uncheck it for today if it was checked
      setChecked((prev) => {
        if (!prev.has(title)) return prev;
        const next = new Set(prev);
        next.delete(title);
        persistChecked(Array.from(next), user.id);
        return next;
      });
    }
  }, [persistChecked]);

  const allDone = checked.size >= allItemTitles.length && allItemTitles.length > 0;

  return {
    checked,
    toggle,
    loading,
    streak,
    allDone,
    justCompleted,
    customItems,
    addCustomItem,
    deleteCustomItem,
  };
}
