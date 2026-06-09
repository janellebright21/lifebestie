import { useState, useEffect, useCallback } from 'react';
import { Event, Task, GroceryItem, WeeklyGroceryItem } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Cache key includes the date so reminders auto-refresh each day
const CACHE_KEY = 'lifebestie_prepare_tomorrow';
const DISMISSED_KEY = 'lifebestie_prepare_dismissed';

interface CachedResult {
  date: string; // YYYY-MM-DD the cache was built for (tomorrow's date)
  reminders: string[];
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function loadCache(): CachedResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedResult = JSON.parse(raw);
    // Stale if it wasn't built for tomorrow's date
    if (parsed.date !== getTomorrow()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(reminders: string[]) {
  const payload: CachedResult = { date: getTomorrow(), reminders };
  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const { date, items }: { date: string; items: string[] } = JSON.parse(raw);
    // Reset dismissals each new day
    if (date !== getTomorrow()) return new Set();
    return new Set(items);
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>) {
  localStorage.setItem(
    DISMISSED_KEY,
    JSON.stringify({ date: getTomorrow(), items: [...dismissed] })
  );
}

export interface UsePrepareForTomorrowReturn {
  reminders: string[];
  loading: boolean;
  fetchError: boolean;
  refresh: () => void;
  dismissReminder: (reminder: string) => void;
}

export function usePrepareForTomorrow(
  events: Event[],
  tasks: Task[],
  groceryItems: GroceryItem[],
  weeklyItems: WeeklyGroceryItem[]
): UsePrepareForTomorrowReturn {
  const [reminders, setReminders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  const fetchReminders = useCallback(async (force = false) => {
    const tomorrow = getTomorrow();

    if (!force) {
      const cached = loadCache();
      if (cached) {
        setReminders(cached.reminders);
        return;
      }
    }

    const tomorrowEvents = events.filter((e) => e.event_date === tomorrow);
    const tomorrowTasks = tasks.filter(
      (t) => !t.completed && t.due_date === tomorrow
    );

    // Nothing scheduled tomorrow — no point calling the AI
    if (tomorrowEvents.length === 0 && tomorrowTasks.length === 0) {
      saveCache([]);
      setReminders([]);
      return;
    }

    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/prepare-for-tomorrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          tomorrowEvents: tomorrowEvents.map((e) => ({
            title: e.title,
            event_time: e.event_time,
            category: e.category,
            notes: e.notes,
          })),
          tomorrowTasks: tomorrowTasks.map((t) => ({
            title: t.title,
            category: t.category,
            priority: t.priority,
          })),
          groceryItems: weeklyItems.map((i) => ({
            name: i.name,
            category: i.category,
            checked: i.checked,
            skipped: i.skipped,
          })),
          currentGroceryList: groceryItems.map((i) => ({
            name: i.name,
            category: i.category,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const fetched: string[] = Array.isArray(data.reminders) ? data.reminders : [];
        saveCache(fetched);
        setReminders(fetched);
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [events, tasks, groceryItems, weeklyItems]);

  // Fetch on mount (uses cache if fresh)
  useEffect(() => {
    fetchReminders(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss(reminder: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(reminder);
      saveDismissed(next);
      return next;
    });
  }

  const visible = reminders.filter((r) => !dismissed.has(r));

  return {
    reminders: visible,
    loading,
    fetchError,
    refresh: () => fetchReminders(true),
    dismissReminder: dismiss,
  };
}
