import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DEBUG — remove once save issues are resolved
export function dbError(table: string, error: { message?: string; code?: string } | null | undefined) {
  if (error) console.error(`[DB error] table=${table} | code=${error.code} | msg=${error.message}`);
}

export type TaskCategory = 'Work' | 'Kids' | 'Home' | 'Self-care' | 'Grocery' | 'Personal' | 'Other';
export type TaskPriority = 'low' | 'medium' | 'high';
export const TASK_CATEGORIES: TaskCategory[] = ['Work', 'Kids', 'Home', 'Self-care', 'Grocery', 'Personal', 'Other'];

export type EventCategory = 'Work' | 'Kids' | 'Home' | 'Self-care' | 'Grocery' | 'Personal' | 'Movement' | 'Other';
export const EVENT_CATEGORIES: EventCategory[] = ['Work', 'Kids', 'Home', 'Self-care', 'Grocery', 'Personal', 'Movement', 'Other'];

// ─── Pastel color palette ─────────────────────────────────────────────────────

export type PastelColorKey = 'blue' | 'pink' | 'yellow' | 'mint' | 'peach' | 'lavender' | 'gray';

export interface PastelColor {
  key: PastelColorKey;
  label: string;
  /** hex for inline styles (dots, bars) */
  hex: string;
  /** light background hex */
  bgHex: string;
  /** Tailwind bg class for card backgrounds */
  bg: string;
  /** Tailwind text class */
  text: string;
  /** Tailwind border class */
  border: string;
  /** Tailwind dot/badge bg class */
  dot: string;
}

export const PASTEL_COLORS: PastelColor[] = [
  { key: 'blue',     label: 'Soft Blue',    hex: '#60a5fa', bgHex: '#eff6ff', bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200',    dot: 'bg-blue-400'    },
  { key: 'pink',     label: 'Soft Pink',    hex: '#f472b6', bgHex: '#fdf2f8', bg: 'bg-pink-50',    text: 'text-pink-600',    border: 'border-pink-200',    dot: 'bg-pink-400'    },
  { key: 'yellow',   label: 'Warm Yellow',  hex: '#fbbf24', bgHex: '#fffbeb', bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200',   dot: 'bg-amber-400'   },
  { key: 'mint',     label: 'Mint Green',   hex: '#34d399', bgHex: '#ecfdf5', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  { key: 'peach',    label: 'Peach',        hex: '#fb923c', bgHex: '#fff7ed', bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200',  dot: 'bg-orange-400'  },
  { key: 'lavender', label: 'Lavender',     hex: '#a78bfa', bgHex: '#f5f3ff', bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200',  dot: 'bg-violet-400'  },
  { key: 'gray',     label: 'Light Gray',   hex: '#9ca3af', bgHex: '#f9fafb', bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200',    dot: 'bg-gray-400'    },
];

export const PASTEL_COLOR_MAP: Record<PastelColorKey, PastelColor> = Object.fromEntries(
  PASTEL_COLORS.map((c) => [c.key, c])
) as Record<PastelColorKey, PastelColor>;

/** Default color assigned to each built-in category */
export const DEFAULT_CATEGORY_COLORS: Record<string, PastelColorKey> = {
  Work:        'blue',
  Kids:        'yellow',
  Home:        'mint',
  'Self-care': 'peach',
  Grocery:     'pink',
  Personal:    'lavender',
  Other:       'gray',
};

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  linked_goal_id: string | null;
  duration: number | null;
  memory_id: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  created_at: string;
}

export interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string;
  memory_id: string | null;
  category: EventCategory;
  location: string | null;
  notes: string | null;
  meal_id: string | null;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
  memory_id: string | null;
  created_at: string;
}

export type GroceryCategory = string;
export const GROCERY_CATEGORIES: GroceryCategory[] = ['Produce', 'Dairy', 'Meat', 'Seafood', 'Bakery', 'Frozen', 'Beverages', 'Pantry', 'Snacks', 'Personal Care', 'Household', 'Baby', 'Pet'];

/** Stable colour palette cycled for any category string. */
const CATEGORY_PALETTE = [
  { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400', header: 'bg-emerald-100', check: 'bg-emerald-500', ring: 'ring-emerald-300' },
  { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400',     header: 'bg-sky-100',     check: 'bg-sky-500',     ring: 'ring-sky-300'     },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400',   header: 'bg-amber-100',   check: 'bg-amber-500',   ring: 'ring-amber-300'   },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-400',    header: 'bg-rose-100',    check: 'bg-rose-500',    ring: 'ring-rose-300'    },
  { bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-400',  header: 'bg-violet-100',  check: 'bg-violet-500',  ring: 'ring-violet-300'  },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-400',  header: 'bg-orange-100',  check: 'bg-orange-500',  ring: 'ring-orange-300'  },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-400',    header: 'bg-teal-100',    check: 'bg-teal-500',    ring: 'ring-teal-300'    },
  { bg: 'bg-pink-50',    text: 'text-pink-700',    dot: 'bg-pink-400',    header: 'bg-pink-100',    check: 'bg-pink-500',    ring: 'ring-pink-300'    },
  { bg: 'bg-lime-50',    text: 'text-lime-700',    dot: 'bg-lime-400',    header: 'bg-lime-100',    check: 'bg-lime-500',    ring: 'ring-lime-300'    },
  { bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-400',    header: 'bg-cyan-100',    check: 'bg-cyan-500',    ring: 'ring-cyan-300'    },
];

const categoryColorCache = new Map<string, typeof CATEGORY_PALETTE[number]>();

export function getCategoryColors(category: string) {
  if (!categoryColorCache.has(category)) {
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
    categoryColorCache.set(category, CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]);
  }
  return categoryColorCache.get(category)!;
}

const CATEGORY_EMOJI_MAP: Record<string, string> = {
  Produce:       '🥦',
  Dairy:         '🥛',
  Meat:          '🥩',
  Seafood:       '🐟',
  Bakery:        '🍞',
  Frozen:        '🧊',
  Beverages:     '🧃',
  Pantry:        '🥫',
  Snacks:        '🍪',
  'Personal Care': '🧴',
  Household:     '🧹',
  Baby:          '🍼',
  Pet:           '🐾',
};

export function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI_MAP[category] ?? '🛒';
}

export interface Routine {
  name: string;
  time: string;
  days: string[];
  tasks: string[];
}

export interface Preferences {
  preferredWakeTime: string;
  busyDays: string[];
}

export interface GroceryHabit {
  name: string;
  category: GroceryCategory;
  frequency: number;
  lastAdded: string; // ISO date string YYYY-MM-DD
}

export interface HistoryEntry {
  date: string;
  actions: string[];
}

export interface UserMemory {
  id: string;
  routines: Routine[];
  preferences: Preferences;
  common_groceries: GroceryHabit[];
  history: HistoryEntry[];
  updated_at: string;
}

export const EMPTY_MEMORY: Omit<UserMemory, 'id' | 'updated_at'> = {
  routines: [],
  preferences: {
    preferredWakeTime: '',
    busyDays: [],
  },
  common_groceries: [],
  history: [],
};

export type WeeklyGrocerySource = 'habit' | 'routine' | 'recent' | 'manual' | 'meal' | 'planner';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export interface Meal {
  id: string;
  memory_id: string;
  user_id?: string;
  name: string;
  meal_type?: MealType | null;
  meal_date?: string | null;
  ingredients: MealIngredient[];
  created_at: string;
}

export interface MealIngredient {
  name: string;
  category: GroceryCategory;
  quantity?: string;     // e.g. "2", "1/2"
  unit?: string;         // e.g. "cups", "tbsp", "oz"
  mealSources?: string[]; // meal names this ingredient came from
}

export interface WeeklyGroceryItem {
  name: string;
  category: GroceryCategory;
  source: WeeklyGrocerySource;
  checked: boolean;
  skipped?: boolean;       // true when user marks "not needed this week"
  in_pantry?: boolean;     // true when user marks "Already have"
  price?: number;          // actual or estimated price per item
  estimated?: boolean;     // true when price is AI/default-estimated, false when user-entered
  quantity?: string;       // numeric quantity, e.g. "3", "1.5"
  unit?: string;           // unit of measurement, e.g. "cups", "tbsp", "oz"
  mealSources?: string[];  // meal names this ingredient came from
}

export interface WeeklyGroceryList {
  id: string;
  memory_id: string;
  week_start_date: string; // YYYY-MM-DD (Monday)
  items: WeeklyGroceryItem[];
  weekly_message: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalCategory = 'health' | 'work' | 'personal' | 'finance';
export type GoalPriority = 'low' | 'medium' | 'high';

export const GOAL_CATEGORIES: GoalCategory[] = ['health', 'work', 'personal', 'finance'];
export const GOAL_PRIORITIES: GoalPriority[] = ['low', 'medium', 'high'];

export interface Goal {
  id: string;
  memory_id: string;
  title: string;
  category: GoalCategory;
  priority: GoalPriority;
  deadline: string | null; // ISO date YYYY-MM-DD
  progress: number;        // 0–100
  linked_tasks: string[];  // task IDs
  created_at: string;
  updated_at: string;
}

export interface GroceryBudget {
  id: string;
  memory_id: string;
  weekly_budget: number;           // user's target spend for the week
  current_estimated_total: number; // sum of item price estimates
  last_updated: string;            // ISO date YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface SpendingSnapshot {
  id: string;
  memory_id: string;
  week_start_date: string;           // ISO YYYY-MM-DD (Monday)
  total_spent: number;
  weekly_budget: number;
  budget_met: boolean;
  category_breakdown: Record<string, number>; // category → total cost
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  category: GroceryCategory;
  confirmed: boolean;
}

export interface Receipt {
  id: string;
  memory_id: string;
  date: string;           // ISO YYYY-MM-DD
  store_name?: string;
  total?: number;
  items: ReceiptItem[];
  created_at: string;
  updated_at: string;
}

// ─── Routine Builder ──────────────────────────────────────────────────────────

export interface RoutineStep {
  id: string;    // stable uuid so completed_step_ids can reference it
  title: string;
}

export interface RoutineTemplate {
  id: string;
  user_id: string;
  name: string;
  steps: RoutineStep[];
  created_at: string;
  updated_at: string;
}

export interface RoutineRun {
  id: string;
  user_id: string;
  template_id: string;
  run_date: string;           // YYYY-MM-DD
  steps_snapshot: RoutineStep[];
  completed_step_ids: string[];
  created_at: string;
  updated_at: string;
}

/** Returns the ISO date string for the most recent Monday (start of current week). */
export function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

// ─── Module Settings ──────────────────────────────────────────────────────────

export type ModuleId =
  | 'grocery'
  | 'meals'
  | 'budget'
  | 'movement'
  | 'ai-assistant'
  | 'routines'
  | 'family-hub'
  | 'chore-tracking'
  | 'school-tracker';

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  defaultEnabled: boolean;
  /** Whether the module has a fully-built UI (false = coming soon) */
  available: boolean;
}

export const MODULE_DEFS: ModuleDef[] = [
  { id: 'meals',           label: 'Meals',           description: 'Plan meals and link ingredients to your grocery list.',         defaultEnabled: true,  available: true  },
  { id: 'grocery',         label: 'Grocery',         description: 'Weekly grocery list, pantry tracking, and receipt scanning.',    defaultEnabled: true,  available: true  },
  { id: 'budget',          label: 'Budget',          description: 'Track grocery spending against a weekly budget.',                defaultEnabled: true,  available: true  },
  { id: 'movement',        label: 'Movement',        description: 'Daily activity options with energy levels and streak tracking.', defaultEnabled: true,  available: true  },
  { id: 'routines',        label: 'Routines',        description: 'Build and run reusable daily checklists with one tap.',          defaultEnabled: true,  available: true  },
  { id: 'ai-assistant',    label: 'AI Assistant',    description: 'Chat with your personal AI to plan, add tasks, and get help.',  defaultEnabled: true,  available: true  },
  { id: 'family-hub',      label: 'Family Hub',      description: 'Shared calendars, tasks, and notes for the whole family.',      defaultEnabled: false, available: false },
  { id: 'chore-tracking',  label: 'Chore Tracking',  description: 'Assign and track chores with rewards and reminders.',           defaultEnabled: false, available: false },
  { id: 'school-tracker',  label: 'School Tracker',  description: 'Track assignments, grades, and school events for kids.',        defaultEnabled: false, available: false },
];

export const DEFAULT_ENABLED_MODULES = new Set<ModuleId>(
  MODULE_DEFS.filter((m) => m.defaultEnabled).map((m) => m.id)
);

export interface LowStockSuggestion {
  habit: GroceryHabit;
  daysSinceAdded: number;
}

/**
 * Returns up to `max` habits that are likely running low.
 * Criteria: high purchase frequency AND not added recently.
 *
 * Thresholds scale inversely with frequency — the more often someone buys
 * something, the sooner it becomes "overdue":
 *   frequency ≥ 6  → stale after 7 days
 *   frequency ≥ 4  → stale after 10 days
 *   frequency ≥ 2  → stale after 14 days
 */
export function getLowStockSuggestions(
  habits: GroceryHabit[],
  max = 3
): LowStockSuggestion[] {
  const today = new Date().toISOString().split('T')[0];

  function stalenessThreshold(frequency: number): number {
    if (frequency >= 6) return 7;
    if (frequency >= 4) return 10;
    return 14;
  }

  return habits
    .filter((h) => h.frequency >= 2)
    .map((h) => {
      const daysSinceAdded = Math.floor(
        (Date.parse(today) - Date.parse(h.lastAdded)) / 86_400_000
      );
      return { habit: h, daysSinceAdded };
    })
    .filter(({ habit, daysSinceAdded }) => daysSinceAdded >= stalenessThreshold(habit.frequency))
    .sort((a, b) => {
      // Rank by how overdue they are relative to their expected cadence
      const scoreA = a.daysSinceAdded * a.habit.frequency;
      const scoreB = b.daysSinceAdded * b.habit.frequency;
      return scoreB - scoreA;
    })
    .slice(0, max);
}
