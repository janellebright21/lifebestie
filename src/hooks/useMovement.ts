import { useMemo } from 'react';
import { Event } from '../lib/supabase';

export type EnergyLevel = 'low' | 'moderate' | 'high';

export interface MovementActivity {
  id: string;
  label: string;
  duration: string;
  energyLevel: EnergyLevel;
}

export const MOVEMENT_OPTIONS: Record<EnergyLevel, {
  label: string;
  duration: string;
  description: string;
  activities: MovementActivity[];
  color: { bg: string; border: string; text: string; badge: string; dot: string; icon: string };
}> = {
  low: {
    label: 'Low Energy',
    duration: '5–10 min',
    description: 'Gentle movement to get you going',
    activities: [
      { id: 'low-walk',    label: 'Walk around the block', duration: '10 min', energyLevel: 'low' },
      { id: 'low-stretch', label: 'Stretching',            duration: '5 min',  energyLevel: 'low' },
      { id: 'low-mobility',label: 'Mobility routine',      duration: '10 min', energyLevel: 'low' },
    ],
    color: {
      bg: 'bg-sky-50', border: 'border-sky-100', text: 'text-sky-700',
      badge: 'bg-sky-100 text-sky-600', dot: 'bg-sky-400', icon: 'text-sky-400',
    },
  },
  moderate: {
    label: 'Moderate Energy',
    duration: '15–20 min',
    description: 'Build momentum with purposeful movement',
    activities: [
      { id: 'mod-bodyweight', label: 'Bodyweight workout', duration: '20 min', energyLevel: 'moderate' },
      { id: 'mod-bands',      label: 'Resistance bands',  duration: '15 min', energyLevel: 'moderate' },
      { id: 'mod-fastwalk',   label: 'Fast walk',         duration: '20 min', energyLevel: 'moderate' },
    ],
    color: {
      bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700',
      badge: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-400', icon: 'text-emerald-400',
    },
  },
  high: {
    label: 'High Energy',
    duration: '30+ min',
    description: 'Full effort for your best days',
    activities: [
      { id: 'high-strength', label: 'Strength workout',    duration: '45 min', energyLevel: 'high' },
      { id: 'high-cardio',   label: 'Cardio workout',      duration: '30 min', energyLevel: 'high' },
      { id: 'high-full',     label: 'Full workout session', duration: '60 min', energyLevel: 'high' },
    ],
    color: {
      bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700',
      badge: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400', icon: 'text-rose-400',
    },
  },
};

// Movement events are stored as regular events with category='Movement'.
// The notes field encodes: "<activityLabel>|<energyLevel>[|done]"
export function encodeMovementNotes(activityLabel: string, level: EnergyLevel, done = false): string {
  return `${activityLabel}|${level}${done ? '|done' : ''}`;
}

export function decodeMovementNotes(notes: string | null): { activityLabel: string; level: EnergyLevel; done: boolean } | null {
  if (!notes) return null;
  const parts = notes.split('|');
  if (parts.length < 2) return null;
  const level = parts[1] as EnergyLevel;
  if (!['low', 'moderate', 'high'].includes(level)) return null;
  return { activityLabel: parts[0] ?? '', level, done: parts[2] === 'done' };
}

export interface TodayMovement {
  event: Event;
  activityLabel: string;
  level: EnergyLevel;
  done: boolean;
}

export interface StreakResult {
  streak: number;
  message: string;
}

function getStreakMessage(streak: number): string {
  if (streak >= 7)  return 'One week strong!';
  if (streak >= 3)  return "You're building momentum!";
  if (streak >= 1)  return 'You started!';
  return 'Start your streak today';
}

/** Returns a YYYY-MM-DD string offset by `daysAgo` from today. */
function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

/**
 * Computes the current movement streak.
 *
 * A day counts if at least one Movement event has notes ending in "|done".
 * The streak starts from today (if today has a done movement) or yesterday,
 * and counts consecutive days backwards until a gap is found.
 */
function computeStreak(events: Event[]): number {
  // Build a set of dates that have at least one completed movement
  const doneDates = new Set<string>();
  for (const e of events) {
    if (e.category !== 'Movement') continue;
    const decoded = decodeMovementNotes(e.notes);
    if (decoded?.done) doneDates.add(e.event_date);
  }

  let streak = 0;
  const today = dateOffset(0);
  const hasToday = doneDates.has(today);

  // Start from today if it has a completion, otherwise start from yesterday
  const startOffset = hasToday ? 0 : 1;

  // If neither today nor yesterday has a done movement the streak is 0
  if (!hasToday && !doneDates.has(dateOffset(1))) return 0;

  for (let i = startOffset; i <= 365; i++) {
    const date = dateOffset(i);
    if (doneDates.has(date)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function useMovement(events: Event[]) {
  const today = new Date().toISOString().split('T')[0];

  const todayMovements = useMemo((): TodayMovement[] => {
    return events
      .filter((e) => e.category === 'Movement' && e.event_date === today)
      .map((e) => {
        const decoded = decodeMovementNotes(e.notes);
        if (!decoded) return null;
        return { event: e, ...decoded };
      })
      .filter((m): m is TodayMovement => m !== null);
  }, [events, today]);

  const streakResult = useMemo((): StreakResult => {
    const streak = computeStreak(events);
    return { streak, message: getStreakMessage(streak) };
  }, [events]);

  const hasMoved = todayMovements.length > 0;
  const hasCompleted = todayMovements.some((m) => m.done);
  const latestMovement = todayMovements[todayMovements.length - 1] ?? null;

  return { todayMovements, hasMoved, hasCompleted, latestMovement, streakResult };
}

