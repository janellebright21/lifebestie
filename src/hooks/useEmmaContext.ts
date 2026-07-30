import { useMemo } from 'react';
import type { Task, Event, Meal, GroceryItem } from '../lib/supabase';
import {
  getTimePeriod,
  getRelationshipTier,
  type EmmaContext,
  type EmmaSituation,
} from '../lib/emmaGreeting';

export interface UseEmmaContextArgs {
  preferredName?: string;
  relationshipScore: number;
  tasks: Task[];
  events: Event[];
  meals: Meal[];
  groceryItems: GroceryItem[];
  movementPlanned: boolean;
  firstVisitToday: boolean;
}

function getFirstName(name: string | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const firstToken = trimmed.split(/\s+/)[0] ?? '';
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

function buildSituation(
  todayIncomplete: Task[],
  todayCompleted: Task[],
  overdue: Task[],
  todayEvents: Event[],
  todayMeals: Meal[],
  movementPlanned: boolean,
  timePeriod: ReturnType<typeof getTimePeriod>,
): EmmaSituation {
  const totalToday = todayIncomplete.length + todayCompleted.length;
  return {
    hasNoPlans: totalToday === 0 && todayEvents.length === 0 && todayMeals.length === 0,
    isBusyDay: todayIncomplete.length >= 3 || todayEvents.length >= 3,
    hasOverdue: overdue.length > 0,
    hasCompletedTasks: todayCompleted.length >= 2,
    hasMealPlanned: todayMeals.length > 0,
    hasNoMealPlanned: todayMeals.length === 0,
    hasMovementPlanned: movementPlanned,
    everythingFinished: todayIncomplete.length === 0 && totalToday > 0,
    isLateNight: timePeriod === 'late_night',
    isFirstVisitToday: false,
  };
}

export function useEmmaContext(args: UseEmmaContextArgs): EmmaContext {
  return useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timePeriod = getTimePeriod(now);

    const todayIncomplete = args.tasks.filter(
      (t) => !t.completed && (t.due_date === today || !t.due_date),
    );
    const todayCompleted = args.tasks.filter(
      (t) => t.completed && t.due_date === today,
    );
    const overdue = args.tasks.filter(
      (t) => !t.completed && t.due_date !== null && t.due_date < today,
    );
    const todayEvents = args.events
      .filter((e) => e.event_date === today)
      .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
    const todayMeals = args.meals.filter((m) => m.meal_date === today);
    const groceryPending = args.groceryItems.filter((g) => !g.checked).length;

    const situation = buildSituation(
      todayIncomplete,
      todayCompleted,
      overdue,
      todayEvents,
      todayMeals,
      args.movementPlanned,
      timePeriod,
    );
    situation.isFirstVisitToday = args.firstVisitToday;

    const recentAccomplishments = todayCompleted.slice(0, 3).map((t) => t.title);

    return {
      preferredName: args.preferredName,
      firstName: getFirstName(args.preferredName),
      localTimePeriod: timePeriod,
      localDate: today,
      relationshipTier: getRelationshipTier(args.relationshipScore),
      relationshipScore: args.relationshipScore,
      todayIncompleteTasks: todayIncomplete,
      todayCompletedTasks: todayCompleted,
      overdueTasks: overdue,
      todayEvents,
      todayMeals,
      groceryPendingCount: groceryPending,
      movementPlanned: args.movementPlanned,
      firstVisitToday: args.firstVisitToday,
      recentAccomplishments,
      situation,
    };
  }, [
    args.preferredName,
    args.relationshipScore,
    args.tasks,
    args.events,
    args.meals,
    args.groceryItems,
    args.movementPlanned,
    args.firstVisitToday,
  ]);
}
