import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SpendingSnapshot, WeeklyGroceryItem, GroceryCategory } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const WEEKS_TO_KEEP = 12;

export function useSpendingTrends() {
  const [snapshots, setSnapshots] = useState<SpendingSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const snapshotsSavedThisSession = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const memoryId = localStorage.getItem(MEMORY_ID_KEY);
    if (!memoryId) { setLoading(false); return; }

    const { data } = await supabase
      .from('spending_snapshots')
      .select('*')
      .eq('memory_id', memoryId)
      .order('week_start_date', { ascending: false })
      .limit(WEEKS_TO_KEEP);

    if (data) setSnapshots(data as SpendingSnapshot[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Upserts a snapshot for the given week. Safe to call multiple times — idempotent. */
  const saveSnapshot = useCallback(async (
    weekStartDate: string,
    items: WeeklyGroceryItem[],
    weeklyBudget: number
  ) => {
    const memoryId = localStorage.getItem(MEMORY_ID_KEY);
    if (!memoryId) return;

    // Avoid hammering the DB on every render — skip if already saved this session
    const key = `${memoryId}:${weekStartDate}`;
    if (snapshotsSavedThisSession.current.has(key)) return;
    snapshotsSavedThisSession.current.add(key);

    const activeItems = items.filter((i) => !i.skipped);
    const total_spent = Math.round(
      activeItems.reduce((sum, i) => sum + (i.price ?? 0), 0) * 100
    ) / 100;

    const category_breakdown: Record<string, number> = {};
    for (const item of activeItems) {
      const cat = item.category as GroceryCategory;
      category_breakdown[cat] = Math.round(((category_breakdown[cat] ?? 0) + (item.price ?? 0)) * 100) / 100;
    }

    const payload = {
      memory_id: memoryId,
      week_start_date: weekStartDate,
      total_spent,
      weekly_budget: weeklyBudget,
      budget_met: total_spent <= weeklyBudget,
      category_breakdown,
      item_count: activeItems.length,
    };

    const { data } = await supabase
      .from('spending_snapshots')
      .upsert(payload, { onConflict: 'memory_id,week_start_date' })
      .select('*')
      .maybeSingle();

    if (data) {
      setSnapshots((prev) => {
        const filtered = prev.filter((s) => s.week_start_date !== weekStartDate);
        return [data as SpendingSnapshot, ...filtered]
          .sort((a, b) => b.week_start_date.localeCompare(a.week_start_date))
          .slice(0, WEEKS_TO_KEEP);
      });
    }
  }, []);

  /** Derive pattern insights from snapshot history. Returns up to 3 plain-language strings. */
  const getInsights = useCallback((): string[] => {
    if (snapshots.length < 2) return [];

    const insights: string[] = [];
    const recent = snapshots.slice(0, 8);

    // Overspending streak
    const overCount = recent.filter((s) => !s.budget_met).length;
    if (overCount >= 3) {
      insights.push(`You've gone over budget ${overCount} of the last ${recent.length} weeks — adjusting your budget might make it feel more realistic.`);
    } else if (overCount === 0 && recent.length >= 3) {
      insights.push(`You've stayed within budget every week recently — great consistency!`);
    }

    // Top category by average spend
    const catTotals: Record<string, number[]> = {};
    for (const snap of recent) {
      for (const [cat, amount] of Object.entries(snap.category_breakdown)) {
        if (!catTotals[cat]) catTotals[cat] = [];
        catTotals[cat].push(amount);
      }
    }
    const catAverages = Object.entries(catTotals)
      .map(([cat, amounts]) => ({ cat, avg: amounts.reduce((a, b) => a + b, 0) / amounts.length }))
      .sort((a, b) => b.avg - a.avg);

    if (catAverages.length > 0) {
      const top = catAverages[0];
      insights.push(`${top.cat} is your biggest spend on average — about $${top.avg.toFixed(0)}/week.`);
    }

    // Trend: is spending going up or down?
    if (recent.length >= 4) {
      const older = recent.slice(Math.floor(recent.length / 2));
      const newer = recent.slice(0, Math.floor(recent.length / 2));
      const olderAvg = older.reduce((s, r) => s + r.total_spent, 0) / older.length;
      const newerAvg = newer.reduce((s, r) => s + r.total_spent, 0) / newer.length;
      const diff = newerAvg - olderAvg;
      if (diff > 5) {
        insights.push(`Your weekly spend has been creeping up by about $${diff.toFixed(0)} compared to a few weeks ago.`);
      } else if (diff < -5) {
        insights.push(`You've been spending about $${Math.abs(diff).toFixed(0)} less per week lately — nice work!`);
      }
    }

    return insights.slice(0, 3);
  }, [snapshots]);

  return { snapshots, loading, saveSnapshot, getInsights };
}
