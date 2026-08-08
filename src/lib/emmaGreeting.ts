import type { Task, Event, Meal } from './supabase';

// ── Time periods (based on the user's device timezone, never UTC) ──────────────

export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'late_night';

export function getTimePeriod(date: Date = new Date()): TimePeriod {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'late_night';
}

// ── Relationship tiers (mapped from the existing score-based levels) ────────────

export type RelationshipTier = 'new_friend' | 'supportive_friend' | 'trusted_bestie' | 'life_bestie';

export function getRelationshipTier(score: number): RelationshipTier {
  if (score >= 600) return 'life_bestie';
  if (score >= 300) return 'trusted_bestie';
  if (score >= 100) return 'supportive_friend';
  return 'new_friend';
}

// ── Situation flags derived from real user data ────────────────────────────────

export interface EmmaSituation {
  hasNoPlans: boolean;
  isBusyDay: boolean;
  hasOverdue: boolean;
  hasCompletedTasks: boolean;
  hasMealPlanned: boolean;
  hasNoMealPlanned: boolean;
  hasMovementPlanned: boolean;
  everythingFinished: boolean;
  isLateNight: boolean;
  isFirstVisitToday: boolean;
}

export interface EmmaContext {
  preferredName?: string;
  firstName: string;
  localTimePeriod: TimePeriod;
  localDate: string;
  relationshipTier: RelationshipTier;
  relationshipScore: number;
  todayIncompleteTasks: Task[];
  todayCompletedTasks: Task[];
  overdueTasks: Task[];
  todayEvents: Event[];
  todayMeals: Meal[];
  groceryPendingCount: number;
  movementPlanned: boolean;
  firstVisitToday: boolean;
  recentAccomplishments: string[];
  situation: EmmaSituation;
}

// ── Greeting library ───────────────────────────────────────────────────────────

interface GreetingEntry {
  text: (ctx: EmmaContext) => string;
  tiers?: RelationshipTier[];
}

const GREETINGS: Record<TimePeriod, GreetingEntry[]> = {
  morning: [
    {
      text: (c) => c.firstName
        ? `Good morning, ${c.firstName}. ${morningPlanLine(c)}`
        : `Good morning. ${morningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Morning, ${c.firstName}. ${morningPlanLine(c)}`
        : `Morning. ${morningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Hi ${c.firstName}. ${morningPlanLine(c)}`
        : `Hi there. ${morningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Good morning, ${c.firstName}. Let's ease into the day together.`
        : `Good morning. Let's ease into the day together.`,
      tiers: ['new_friend', 'supportive_friend'],
    },
    {
      text: (c) => c.firstName
        ? `Good morning, ${c.firstName}. I'm glad you're starting the day here.`
        : `Good morning. I'm glad you're starting the day here.`,
      tiers: ['trusted_bestie', 'life_bestie'],
    },
  ],
  afternoon: [
    {
      text: (c) => c.firstName
        ? `Good afternoon, ${c.firstName}. ${afternoonPlanLine(c)}`
        : `Good afternoon. ${afternoonPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Afternoon, ${c.firstName}. ${afternoonPlanLine(c)}`
        : `Afternoon. ${afternoonPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Hi ${c.firstName}. ${afternoonPlanLine(c)}`
        : `Hi there. ${afternoonPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Good afternoon, ${c.firstName}. Let's see what's left to handle.`
        : `Good afternoon. Let's see what's left to handle.`,
      tiers: ['new_friend', 'supportive_friend'],
    },
    {
      text: (c) => c.firstName
        ? `Good afternoon, ${c.firstName}. You've been at it a while — let's keep going.`
        : `Good afternoon. You've been at it a while — let's keep going.`,
      tiers: ['trusted_bestie', 'life_bestie'],
    },
  ],
  evening: [
    {
      text: (c) => c.firstName
        ? `Good evening, ${c.firstName}. ${eveningPlanLine(c)}`
        : `Good evening. ${eveningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Evening, ${c.firstName}. ${eveningPlanLine(c)}`
        : `Evening. ${eveningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Hi ${c.firstName}. ${eveningPlanLine(c)}`
        : `Hi there. ${eveningPlanLine(c)}`,
    },
    {
      text: (c) => c.firstName
        ? `Good evening, ${c.firstName}. You made it through the day.`
        : `Good evening. You made it through the day.`,
      tiers: ['new_friend', 'supportive_friend'],
    },
    {
      text: (c) => c.firstName
        ? `Good evening, ${c.firstName}. I'm proud you showed up today.`
        : `Good evening. I'm proud you showed up today.`,
      tiers: ['trusted_bestie', 'life_bestie'],
    },
  ],
  late_night: [
    {
      text: (c) => c.firstName
        ? `Hi ${c.firstName}. It's late — let's keep this gentle.`
        : `Hi there. It's late — let's keep this gentle.`,
    },
    {
      text: (c) => c.firstName
        ? `Hey ${c.firstName}. Winding down is allowed too.`
        : `Hey. Winding down is allowed too.`,
    },
    {
      text: (c) => c.firstName
        ? `Late night, ${c.firstName}? Let's not add anything heavy.`
        : `Late night? Let's not add anything heavy.`,
    },
    {
      text: (c) => c.firstName
        ? `Hi ${c.firstName}. Whatever's left can wait till morning.`
        : `Hi there. Whatever's left can wait till morning.`,
      tiers: ['new_friend', 'supportive_friend'],
    },
    {
      text: (c) => c.firstName
        ? `Hey ${c.firstName}. You've done enough for today — rest is productive too.`
        : `Hey. You've done enough for today — rest is productive too.`,
      tiers: ['trusted_bestie', 'life_bestie'],
    },
  ],
};

function morningPlanLine(c: EmmaContext): string {
  if (c.situation.hasOverdue) return `You have some overdue tasks — we'll take them one at a time.`;
  if (c.situation.isBusyDay) return `You have a few things planned today. We'll take them one at a time.`;
  if (c.situation.hasCompletedTasks) return `You've already finished a couple things — nice start.`;
  if (c.situation.hasNoPlans) return `Today looks open. What would make it feel easier?`;
  if (c.situation.hasNoMealPlanned) return `Dinner isn't planned yet — we can find something simple.`;
  return `Let's make today feel a little easier.`;
}

function afternoonPlanLine(c: EmmaContext): string {
  if (c.situation.hasOverdue) return `A couple tasks slipped — want to decide what matters most?`;
  if (c.situation.isBusyDay) return `Your afternoon looks a little full. Want to decide what matters most first?`;
  if (c.situation.hasCompletedTasks) return `You've already finished a few things today — that deserves credit.`;
  if (c.situation.hasNoPlans) return `The afternoon is open. What would help most?`;
  if (c.situation.hasNoMealPlanned) return `Dinner isn't planned yet — we can figure something out.`;
  if (c.situation.everythingFinished) return `You handled the important things today. It's okay to slow down.`;
  return `Let's see what's left to handle.`;
}

function eveningPlanLine(c: EmmaContext): string {
  if (c.situation.everythingFinished) return `You handled the important things today. It's okay to slow down now.`;
  if (c.situation.hasCompletedTasks) return `You got through a good chunk today — well done.`;
  if (c.situation.hasOverdue) return `A few things are still hanging — we can look tomorrow.`;
  if (c.situation.hasNoPlans) return `Tonight looks open. What would make it feel easier?`;
  if (c.situation.hasNoMealPlanned) return `Dinner isn't planned yet — we can find something simple.`;
  return `You made it through the day.`;
}

// ── Deterministic greeting selection ──────────────────────────────────────────

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function generateEmmaGreeting(ctx: EmmaContext): string {
  const period = ctx.localTimePeriod;
  const pool = GREETINGS[period].filter(
    (g) => !g.tiers || g.tiers.includes(ctx.relationshipTier),
  );
  const candidates = pool.length > 0 ? pool : GREETINGS[period];
  const seed = `${ctx.localDate}:${period}:${ctx.firstName || 'anon'}`;
  const idx = hashSeed(seed) % candidates.length;
  return candidates[idx]!.text(ctx);
}

// ── Fallback greetings (used while context loads or on failure) ────────────────

export function getFallbackGreeting(date: Date = new Date()): string {
  const period = getTimePeriod(date);
  switch (period) {
    case 'morning':    return 'Good morning. What would make today feel easier?';
    case 'afternoon':  return "Good afternoon. Let's see what you need.";
    case 'evening':    return 'Good evening. You made it through the day.';
    case 'late_night': return "Hi. It's late — let's keep this gentle.";
  }
}

// ── Contextual action button ───────────────────────────────────────────────────

export type EmmaActionType =
  | 'review_tasks'
  | 'view_schedule'
  | 'plan_meal'
  | 'open_grocery'
  | 'view_movement'
  | 'chat_with_emma';

export interface EmmaAction {
  type: EmmaActionType;
  label: string;
}

export function getEmmaAction(ctx: EmmaContext): EmmaAction {
  const now = new Date();
  const soonMs = 2 * 60 * 60 * 1000;
  const hasUpcomingEvent = ctx.todayEvents.some((e) => {
    if (!e.event_time) return false;
    const eventDate = new Date(`${e.event_date}T${e.event_time}`);
    const diff = eventDate.getTime() - now.getTime();
    return diff > 0 && diff < soonMs;
  });

  // Brand-new users should get one clear starting point instead of being pushed
  // straight into meal planning simply because their account is empty.
  if (
    ctx.relationshipTier === 'new_friend' &&
    ctx.firstVisitToday &&
    ctx.situation.hasNoPlans &&
    ctx.todayCompletedTasks.length === 0
  ) {
    return { type: 'view_schedule', label: 'Set up my day' };
  }

  if (ctx.situation.hasOverdue) return { type: 'review_tasks', label: 'Review tasks' };
  if (hasUpcomingEvent) return { type: 'view_schedule', label: 'View schedule' };
  if (ctx.situation.hasNoMealPlanned) return { type: 'plan_meal', label: 'Plan a meal' };
  if (ctx.groceryPendingCount > 0) return { type: 'open_grocery', label: 'Open grocery list' };
  if (ctx.situation.hasMovementPlanned) return { type: 'view_movement', label: 'View movement' };
  return { type: 'chat_with_emma', label: 'Chat with my Bestie' };
}

// ── Compact context summary for the AI chat payload ────────────────────────────

export interface EmmaContextSummary {
  preferredName: string;
  localTimePeriod: TimePeriod;
  localDate: string;
  relationshipLevel: string;
  todayTaskSummary: string;
  overdueTaskSummary: string;
  todayEventSummary: string;
  mealSummary: string;
  grocerySummary: string;
  movementSummary: string;
}

export function buildEmmaContextSummary(ctx: EmmaContext): EmmaContextSummary {
  const tierLabel = ctx.relationshipTier.replace(/_/g, ' ');
  const relationshipLevel = tierLabel.charAt(0).toUpperCase() + tierLabel.slice(1);

  const incomplete = ctx.todayIncompleteTasks.length;
  const completed = ctx.todayCompletedTasks.length;
  const todayTaskSummary = incomplete > 0 || completed > 0
    ? `${incomplete} incomplete, ${completed} completed`
    : 'none';

  const overdue = ctx.overdueTasks.length;
  const overdueTaskSummary = overdue > 0
    ? `${overdue} overdue task${overdue !== 1 ? 's' : ''}`
    : 'none';

  const eventCount = ctx.todayEvents.length;
  const todayEventSummary = eventCount > 0
    ? `${eventCount} event${eventCount !== 1 ? 's' : ''}`
    : 'none';

  const mealCount = ctx.todayMeals.length;
  const mealSummary = mealCount > 0
    ? `${mealCount} meal${mealCount !== 1 ? 's' : ''} planned`
    : 'no meal planned';

  const grocerySummary = ctx.groceryPendingCount > 0
    ? `${ctx.groceryPendingCount} item${ctx.groceryPendingCount !== 1 ? 's' : ''} pending`
    : 'none pending';

  const movementSummary = ctx.movementPlanned ? 'planned' : 'none';

  return {
    preferredName: ctx.preferredName ?? '',
    localTimePeriod: ctx.localTimePeriod,
    localDate: ctx.localDate,
    relationshipLevel,
    todayTaskSummary,
    overdueTaskSummary,
    todayEventSummary,
    mealSummary,
    grocerySummary,
    movementSummary,
  };
}
