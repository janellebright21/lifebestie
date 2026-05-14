import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  UserMemory,
  Routine,
  Preferences,
  GroceryHabit,
  GroceryCategory,
  HistoryEntry,
  EMPTY_MEMORY,
} from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';
const MAX_HISTORY_DAYS = 30;
const ROUTINE_THRESHOLD = 3;

export interface PatternCandidate {
  taskTitle: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  count: number;
  days: string[];
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function dayName(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

const TIME_TAG_RE = /\s\[(morning|afternoon|evening)\]$/;

function tagAction(action: string): string {
  return `${action} [${getTimeOfDay()}]`;
}

function detectPatterns(history: HistoryEntry[]): PatternCandidate[] {
  const taskMap: Record<string, { dates: string[]; times: Record<string, number> }> = {};

  for (const entry of history) {
    for (const raw of entry.actions) {
      const timeMatch = raw.match(TIME_TAG_RE);
      const action = raw.replace(TIME_TAG_RE, '');
      const timeOfDay = timeMatch ? timeMatch[1] : 'morning';

      const match = action.match(/^(?:Added task|Completed task): (.+)$/);
      if (!match) continue;
      const title = match[1].toLowerCase().trim();

      if (!taskMap[title]) taskMap[title] = { dates: [], times: { morning: 0, afternoon: 0, evening: 0 } };
      if (!taskMap[title].dates.includes(entry.date)) {
        taskMap[title].dates.push(entry.date);
      }
      taskMap[title].times[timeOfDay] = (taskMap[title].times[timeOfDay] ?? 0) + 1;
    }
  }

  const candidates: PatternCandidate[] = [];
  for (const [title, data] of Object.entries(taskMap)) {
    if (data.dates.length >= ROUTINE_THRESHOLD) {
      const dominantTime = Object.entries(data.times).sort((a, b) => b[1] - a[1])[0][0] as
        | 'morning'
        | 'afternoon'
        | 'evening';
      const uniqueDays = [...new Set(data.dates.map(dayName))];
      candidates.push({ taskTitle: title, timeOfDay: dominantTime, count: data.dates.length, days: uniqueDays });
    }
  }

  return candidates;
}

export function useUserMemory() {
  const [memory, setMemory] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingRoutineSuggestions, setPendingRoutineSuggestions] = useState<PatternCandidate[]>([]);
  const [confirmingCandidate, setConfirmingCandidate] = useState<PatternCandidate | null>(null);
  const memoryIdRef = useRef<string | null>(localStorage.getItem(MEMORY_ID_KEY));
  const memoryRef = useRef<UserMemory | null>(null);

  useEffect(() => {
    memoryRef.current = memory;
  }, [memory]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Try to find existing memory for this user
    const { data: existing } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      localStorage.setItem(MEMORY_ID_KEY, existing.id);
      memoryIdRef.current = existing.id;
      setMemory(existing as UserMemory);
      setLoading(false);
      return;
    }

    // Create a new memory record for this user
    const { data: created } = await supabase
      .from('user_memory')
      .insert({ ...EMPTY_MEMORY, user_id: user.id })
      .select()
      .single();

    if (created) {
      localStorage.setItem(MEMORY_ID_KEY, created.id);
      memoryIdRef.current = created.id;
      setMemory(created as UserMemory);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(
    updates: Partial<Pick<UserMemory, 'routines' | 'preferences' | 'history' | 'common_groceries'>>
  ) {
    if (!memoryIdRef.current) return;
    const current = memoryRef.current;
    if (current) setMemory({ ...current, ...updates });
    await supabase.from('user_memory').update(updates).eq('id', memoryIdRef.current);
  }

  async function updateRoutines(routines: Routine[]) {
    await patch({ routines });
  }

  async function updatePreferences(preferences: Preferences) {
    await patch({ preferences });
  }

  // Upsert a grocery item into common_groceries: increment frequency if exists, add if new
  async function upsertGroceryHabit(name: string, category: GroceryCategory) {
    const current = memoryRef.current;
    if (!current || !memoryIdRef.current) return;

    const today = new Date().toISOString().split('T')[0];
    const existing = [...current.common_groceries];
    const idx = existing.findIndex((g) => g.name.toLowerCase() === name.toLowerCase());

    if (idx >= 0) {
      existing[idx] = {
        ...existing[idx],
        frequency: existing[idx].frequency + 1,
        lastAdded: today,
      };
    } else {
      existing.push({ name, category, frequency: 1, lastAdded: today });
    }

    await patch({ common_groceries: existing });
  }

  // Decrease frequency when a user explicitly removes an item; remove entry if it hits 0
  async function decreaseGroceryHabit(name: string) {
    const current = memoryRef.current;
    if (!current || !memoryIdRef.current) return;

    const existing = [...current.common_groceries];
    const idx = existing.findIndex((g) => g.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) return;

    const next = existing[idx].frequency - 1;
    if (next <= 0) {
      existing.splice(idx, 1);
    } else {
      existing[idx] = { ...existing[idx], frequency: next };
    }

    await patch({ common_groceries: existing });
  }

  // Core method: record an action + tag time-of-day, then run pattern detection
  async function addHistoryAction(action: string) {
    const current = memoryRef.current;
    if (!current || !memoryIdRef.current) return;

    const tagged = tagAction(action);
    const today = new Date().toISOString().split('T')[0];
    const existing = [...current.history];
    const todayIdx = existing.findIndex((h) => h.date === today);

    if (todayIdx >= 0) {
      existing[todayIdx] = { ...existing[todayIdx], actions: [...existing[todayIdx].actions, tagged] };
    } else {
      existing.push({ date: today, actions: [tagged] });
    }

    const trimmed = existing.slice(-MAX_HISTORY_DAYS);

    const candidates = detectPatterns(trimmed);
    const existingNames = new Set(current.routines.map((r) => r.name.toLowerCase()));

    const newCandidates = candidates.filter((c) => !existingNames.has(c.taskTitle));
    if (newCandidates.length > 0) {
      setPendingRoutineSuggestions((prev) => {
        const prevTitles = new Set(prev.map((p) => p.taskTitle));
        const added = newCandidates.filter((c) => !prevTitles.has(c.taskTitle));
        if (added.length > 0) {
          setConfirmingCandidate((cur) => cur ?? added[0]);
        }
        return [...prev, ...added];
      });
    }

    const optimistic = { ...current, history: trimmed };
    setMemory(optimistic);
    await supabase.from('user_memory').update({ history: trimmed }).eq('id', memoryIdRef.current);
  }

  function openRoutineSheet(candidate: PatternCandidate) {
    setConfirmingCandidate(candidate);
  }

  async function acceptRoutineSuggestion(routine: Routine) {
    const current = memoryRef.current;
    if (!current) return;
    await updateRoutines([...current.routines, routine]);
    setPendingRoutineSuggestions((prev) => prev.filter((p) => p.taskTitle !== routine.name));
    setConfirmingCandidate(null);
  }

  function dismissRoutineSuggestion(taskTitle: string) {
    setPendingRoutineSuggestions((prev) => prev.filter((p) => p.taskTitle !== taskTitle));
    setConfirmingCandidate((cur) => (cur?.taskTitle === taskTitle ? null : cur));
  }

  function closeRoutineSheet() {
    setConfirmingCandidate(null);
  }

  async function addRoutine(routine: Routine) {
    const current = memoryRef.current;
    if (!current) return;
    await updateRoutines([...current.routines, routine]);
  }

  async function removeRoutine(name: string) {
    const current = memoryRef.current;
    if (!current) return;
    await updateRoutines(current.routines.filter((r) => r.name !== name));
  }

  async function updateRoutine(name: string, updated: Partial<Routine>) {
    const current = memoryRef.current;
    if (!current) return;
    await updateRoutines(current.routines.map((r) => (r.name === name ? { ...r, ...updated } : r)));
  }

  function getHistoryForDate(date: string): HistoryEntry | undefined {
    return memoryRef.current?.history.find((h) => h.date === date);
  }

  function getRecentHistory(days = 7): HistoryEntry[] {
    const current = memoryRef.current;
    if (!current) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return current.history.filter((h) => h.date >= cutoffStr);
  }

  // Returns top grocery habits sorted by frequency, optionally filtered by not-added-recently
  function getTopGroceries(limit = 5, excludeRecentDays = 0): GroceryHabit[] {
    const current = memoryRef.current;
    if (!current) return [];
    let habits = [...current.common_groceries].sort((a, b) => b.frequency - a.frequency);

    if (excludeRecentDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - excludeRecentDays);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      habits = habits.filter((h) => h.lastAdded < cutoffStr);
    }

    return habits.slice(0, limit);
  }

  function getProactiveSuggestions(): string[] {
    const current = memoryRef.current;
    if (!current) return [];
    const suggestions: string[] = [];
    const todayName = dayName(new Date().toISOString().split('T')[0]);

    for (const routine of current.routines) {
      if (routine.days.includes(todayName)) {
        suggestions.push(`You usually do "${routine.name}" around ${routine.time} on ${todayName}s`);
      }
    }

    // Suggest frequently-bought groceries not added in the last 7 days
    for (const habit of getTopGroceries(5, 7)) {
      suggestions.push(`You often buy ${habit.name} — want to add it to your list?`);
    }

    return suggestions.slice(0, 3);
  }

  return {
    memory,
    loading,
    pendingRoutineSuggestions,
    confirmingCandidate,
    updateRoutines,
    updatePreferences,
    addHistoryAction,
    upsertGroceryHabit,
    decreaseGroceryHabit,
    openRoutineSheet,
    acceptRoutineSuggestion,
    dismissRoutineSuggestion,
    closeRoutineSheet,
    addRoutine,
    removeRoutine,
    updateRoutine,
    getHistoryForDate,
    getRecentHistory,
    getTopGroceries,
    getProactiveSuggestions,
  };
}
