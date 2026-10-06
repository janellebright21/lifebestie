import type { PlanItem } from '../hooks/useDailyPlanner';

/** Missing rows get suggestions. Existing empty plans must stay empty. */
export function readSavedPlan(row: { plan_items: unknown } | null): PlanItem[] | null {
  if (!row) return null;
  const raw = row.plan_items;
  if (!Array.isArray(raw) || raw.some((item) => !item || typeof item.taskId !== 'string' || typeof item.title !== 'string')) {
    throw new Error('Your saved plan has an unexpected format. Please retry or contact support.');
  }
  return raw as PlanItem[];
}
