import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Goal, Task, Event, Routine, UserMemory } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface PlanTask {
  id: string;
  title: string;
  type: 'high_impact' | 'small_win';
  reason: string;
  linked_goal_id?: string;
  linked_goal_title?: string;
  duration?: number;
  completed: boolean;
}

export type AdaptationType = 'reschedule' | 'next_task' | 'load_reduced' | 'time_hint';

export interface AdaptationEvent {
  id: string;
  type: AdaptationType;
  message: string;
  task_id?: string;
  created_at: string;
  dismissed: boolean;
}

export type LoadHint = 'light' | 'normal' | 'heavy';

export interface DailyPlan {
  id: string;
  memory_id: string;
  plan_date: string;
  high_impact: PlanTask[];
  small_wins: PlanTask[];
  message: string;
  skipped_tasks: PlanTask[];
  completion_rate: number | null;
  load_hint: LoadHint;
  adaptations: AdaptationEvent[];
  focus_hours: number[];
  completion_timestamps: number[]; // unix epoch ms of each task completion
  created_at: string;
  updated_at: string;
}

export interface GenerateOptions {
  goals: Goal[];
  tasks: Task[];
  events: Event[];
  routines: Routine[];
  memory: UserMemory | null;
  recentHistory: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function formatHour(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}${ampm}`;
}

/** Returns hours (0–23) where completions are most concentrated. */
function topFocusHours(timestamps: number[]): number[] {
  if (timestamps.length === 0) return [];
  const counts: Record<number, number> = {};
  for (const ts of timestamps) {
    const h = new Date(ts).getHours();
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => parseInt(h));
}

/** Compute load hint from recent completion rates. */
function computeLoadHint(rates: number[]): LoadHint {
  if (rates.length < 2) return 'normal';
  const recent = rates.slice(-4);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (avg < 0.45) return 'light';
  if (avg > 0.85) return 'heavy';
  return 'normal';
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDailyPlanner() {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const memoryId = localStorage.getItem(MEMORY_ID_KEY); // kept for upsert payload; ownership is user_id
  const today = new Date().toISOString().split('T')[0];
  // Ref so callbacks always see latest plan without stale closure
  const planRef = useRef<DailyPlan | null>(null);
  planRef.current = plan;

  // ── Load today's plan ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', today)
      .maybeSingle();
    if (data) setPlan(data as DailyPlan);
    setLoading(false);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  // ── Load yesterday's plan (for skipped tasks + rates) ────────────────────
  async function loadYesterday(): Promise<DailyPlan | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', yDate)
      .maybeSingle();
    return data as DailyPlan | null;
  }

  // Load last N days for completion rates
  async function loadRecentRates(days = 7): Promise<number[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const { data } = await supabase
      .from('daily_plans')
      .select('completion_rate, plan_date')
      .eq('user_id', user.id)
      .gte('plan_date', cutoff.toISOString().split('T')[0])
      .order('plan_date', { ascending: true });
    if (!data) return [];
    return (data as { completion_rate: number | null }[])
      .map((r) => r.completion_rate ?? null)
      .filter((r): r is number => r !== null);
  }

  // Load all completion timestamps from recent plans for focus-hour analysis
  async function loadFocusHours(): Promise<number[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const { data } = await supabase
      .from('daily_plans')
      .select('completion_timestamps')
      .eq('user_id', user.id)
      .gte('plan_date', cutoff.toISOString().split('T')[0]);
    if (!data) return [];
    return (data as { completion_timestamps: number[] }[]).flatMap((r) => r.completion_timestamps ?? []);
  }

  // ── Persist plan state ────────────────────────────────────────────────────
  async function persistPlan(updated: DailyPlan) {
    setPlan(updated);
    await supabase
      .from('daily_plans')
      .update({
        high_impact: updated.high_impact,
        small_wins: updated.small_wins,
        skipped_tasks: updated.skipped_tasks,
        completion_rate: updated.completion_rate,
        load_hint: updated.load_hint,
        adaptations: updated.adaptations,
        focus_hours: updated.focus_hours,
        completion_timestamps: updated.completion_timestamps,
      })
      .eq('id', updated.id);
  }

  // ── Generate plan ─────────────────────────────────────────────────────────
  async function generate(opts: GenerateOptions, force = false) {
    if (generating) return;
    if (plan && !force) return;

    setGenerating(true);
    try {
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      // Gather adaptive context
      const [yesterday, recentRates, allFocusTimestamps] = await Promise.all([
        loadYesterday(),
        loadRecentRates(7),
        loadFocusHours(),
      ]);

      // Compute skipped from yesterday: tasks in yesterday's plan that were not completed
      const skippedYesterday: PlanTask[] = yesterday
        ? [...(yesterday.high_impact ?? []), ...(yesterday.small_wins ?? [])]
            .filter((t) => !t.completed)
        : [];

      // Persist skipped on yesterday's record (end-of-day snapshot)
      if (yesterday && skippedYesterday.length > 0 && yesterday.skipped_tasks?.length === 0) {
        const yRate = (() => {
          const all = [...(yesterday.high_impact ?? []), ...(yesterday.small_wins ?? [])];
          if (all.length === 0) return null;
          return all.filter((t) => t.completed).length / all.length;
        })();
        await supabase
          .from('daily_plans')
          .update({ skipped_tasks: skippedYesterday, completion_rate: yRate })
          .eq('id', yesterday.id);
        if (yRate !== null) recentRates.push(yRate);
      }

      const loadHint = computeLoadHint(recentRates);
      const focusHoursFromHistory = topFocusHours(allFocusTimestamps);

      const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          memoryId,
          goals: opts.goals,
          tasks: opts.tasks.filter((t) => !t.completed),
          events: opts.events,
          routines: opts.routines,
          preferences: opts.memory
            ? {
                preferredWakeTime: opts.memory.preferences?.preferredWakeTime,
                busyDays: opts.memory.preferences?.busyDays,
              }
            : undefined,
          recentHistory: opts.recentHistory,
          planDate: today,
          dayOfWeek,
          skippedYesterday,
          loadHint,
          focusHours: focusHoursFromHistory,
          recentCompletionRates: recentRates,
        }),
      });

      if (!res.ok) return;
      const aiPlan = await res.json();

      // Build initial adaptations
      const adaptations: AdaptationEvent[] = [];

      if (skippedYesterday.length > 0) {
        adaptations.push({
          id: makeId(),
          type: 'reschedule',
          message: `${skippedYesterday.length} task${skippedYesterday.length > 1 ? 's' : ''} from yesterday have been rolled into today's plan — no worries, you've got this.`,
          created_at: new Date().toISOString(),
          dismissed: false,
        });
      }

      if (loadHint === 'light' && recentRates.length >= 2) {
        adaptations.push({
          id: makeId(),
          type: 'load_reduced',
          message: "You've been juggling a lot lately, so today's plan is a little lighter. Small steps still move you forward.",
          created_at: new Date().toISOString(),
          dismissed: false,
        });
      }

      if (focusHoursFromHistory.length > 0) {
        const best = formatHour(focusHoursFromHistory[0]);
        adaptations.push({
          id: makeId(),
          type: 'time_hint',
          message: `You usually get the most done around ${best} — that's a great time to tackle your high-impact tasks.`,
          created_at: new Date().toISOString(),
          dismissed: false,
        });
      }

      const { data: { user: planUser } } = await supabase.auth.getUser();
      if (!planUser) return;

      const { data } = await supabase
        .from('daily_plans')
        .upsert(
          {
            memory_id: memoryId,
            user_id: planUser.id,
            plan_date: today,
            high_impact: aiPlan.high_impact,
            small_wins: aiPlan.small_wins,
            message: aiPlan.message,
            skipped_tasks: [],
            load_hint: loadHint,
            adaptations,
            focus_hours: focusHoursFromHistory,
            completion_timestamps: [],
          },
          { onConflict: 'user_id,plan_date' }
        )
        .select()
        .single();

      if (data) setPlan(data as DailyPlan);
    } finally {
      setGenerating(false);
    }
  }

  // ── Toggle task completion ────────────────────────────────────────────────
  async function togglePlanTask(taskId: string, completed: boolean) {
    const current = planRef.current;
    if (!current) return;

    const now = Date.now();

    const patchArr = (arr: PlanTask[]) =>
      arr.map((t) => (t.id === taskId ? { ...t, completed } : t));

    const updatedHigh = patchArr(current.high_impact);
    const updatedSmall = patchArr(current.small_wins);

    // Track completion timestamps for focus-hour analysis
    const timestamps = completed
      ? [...current.completion_timestamps, now]
      : current.completion_timestamps.filter((ts) => {
          // Remove the most recent entry within last minute for un-complete
          return !(ts > now - 60_000);
        });

    // Check if all tasks are now done → suggest next task from main tasks list
    const allDone = [...updatedHigh, ...updatedSmall].every((t) => t.completed);
    const newAdaptations = [...current.adaptations];

    if (completed && allDone) {
      // All tasks done — celebrate and the UI handles this
    } else if (completed) {
      // Just completed one — check if we should surface a next-task hint
      // (we'll do this in the UI by checking remaining count, no extra event needed)
    }

    const updated: DailyPlan = {
      ...current,
      high_impact: updatedHigh,
      small_wins: updatedSmall,
      completion_timestamps: timestamps,
      adaptations: newAdaptations,
    };

    await persistPlan(updated);
  }

  // ── Dismiss an adaptation nudge ───────────────────────────────────────────
  async function dismissAdaptation(adaptationId: string) {
    const current = planRef.current;
    if (!current) return;
    const updated: DailyPlan = {
      ...current,
      adaptations: current.adaptations.map((a) =>
        a.id === adaptationId ? { ...a, dismissed: true } : a
      ),
    };
    await persistPlan(updated);
  }

  // ── End-of-day: mark skipped tasks and compute rate ──────────────────────
  async function finaliseDay() {
    const current = planRef.current;
    if (!current) return;

    const all = [...current.high_impact, ...current.small_wins];
    const skipped = all.filter((t) => !t.completed);
    const rate = all.length > 0 ? all.filter((t) => t.completed).length / all.length : null;

    const updated: DailyPlan = {
      ...current,
      skipped_tasks: skipped,
      completion_rate: rate,
    };
    await persistPlan(updated);
  }

  // ── Derive smart reminder message for a task ──────────────────────────────
  function getTimeHintForTask(taskTitle: string): string | null {
    const current = planRef.current;
    if (!current || current.focus_hours.length === 0) return null;
    const best = formatHour(current.focus_hours[0]);
    return `You usually focus better around ${best} — want to do "${taskTitle}" then?`;
  }

  return {
    plan,
    loading,
    generating,
    generate,
    togglePlanTask,
    dismissAdaptation,
    finaliseDay,
    getTimeHintForTask,
  };
}
