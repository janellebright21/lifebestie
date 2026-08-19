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

// ─── Personalization ──────────────────────────────────────────────────────────

export type ThemeId        = 'cozy-coffee' | 'lavender-calm' | 'coastal-breeze' | 'boss-babe' | 'fresh-start';
export type BgSkinId       = 'solid' | 'watercolor' | 'floral' | 'planner-paper' | 'minimalist';
export type AvatarThemeId  = 'classic' | 'cozy' | 'wellness' | 'professional';
export type AvatarExpression =
  | 'happy' | 'encouraging' | 'proud' | 'calm' | 'thinking' | 'tired'
  | 'listening' | 'empathetic' | 'focused' | 'excited' | 'playful';
export type CharacterId      = 'emma' | 'ava' | 'nora' | 'luna';
export type CharacterVariant = 'portrait' | 'full-body';
export type OutfitId         = 'classic' | 'cozy' | 'professional' | 'wellness';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  /** Primary accent color (used for nav active, buttons, badges) */
  primary: string;
  /** Light tint for backgrounds */
  primaryLight: string;
  /** Slightly darker shade for text/borders */
  primaryMid: string;
  /** Preview swatch — array of 2 hex colors */
  swatch: [string, string];
}

export interface BgSkinDef {
  id: BgSkinId;
  label: string;
  description: string;
  emoji: string;
  /** Base background color as a hex value for CSS var */
  solidColor: string;
  /** CSS backgroundImage value (empty string = none) */
  patternStyle: string;
  /** Legacy Tailwind class kept for reference — NOT applied to DOM */
  bgClass: string;
}

export interface AvatarThemeDef {
  id: AvatarThemeId;
  label: string;
  emoji: string;
  /** Tailwind gradient classes for outer ring */
  ringGradient: string;
  /** Tailwind gradient classes for inner circle */
  innerGradient: string;
}

export const THEMES: ThemeDef[] = [
  {
    id: 'cozy-coffee',
    label: 'Cozy Coffee',
    description: 'Warm rose and amber — the original.',
    primary:      '#f87171', // rose-400
    primaryLight: '#fff1f2', // rose-50
    primaryMid:   '#fecdd3', // rose-200
    swatch:       ['#f87171', '#fbbf24'],
  },
  {
    id: 'lavender-calm',
    label: 'Lavender Calm',
    description: 'Soft violet and lilac for a peaceful vibe.',
    primary:      '#a78bfa', // violet-400
    primaryLight: '#f5f3ff', // violet-50
    primaryMid:   '#ddd6fe', // violet-200
    swatch:       ['#a78bfa', '#c4b5fd'],
  },
  {
    id: 'coastal-breeze',
    label: 'Coastal Breeze',
    description: 'Ocean blues that feel fresh and open.',
    primary:      '#38bdf8', // sky-400
    primaryLight: '#f0f9ff', // sky-50
    primaryMid:   '#bae6fd', // sky-200
    swatch:       ['#38bdf8', '#6ee7b7'],
  },
  {
    id: 'boss-babe',
    label: 'Boss Babe',
    description: 'Bold and confident in deep rose and gold.',
    primary:      '#e11d48', // rose-600
    primaryLight: '#fff1f2', // rose-50
    primaryMid:   '#fecdd3', // rose-200
    swatch:       ['#e11d48', '#d97706'],
  },
  {
    id: 'fresh-start',
    label: 'Fresh Start',
    description: 'Clean greens — minimal and grounded.',
    primary:      '#34d399', // emerald-400
    primaryLight: '#ecfdf5', // emerald-50
    primaryMid:   '#a7f3d0', // emerald-200
    swatch:       ['#34d399', '#6ee7b7'],
  },
];

export const BG_SKINS: BgSkinDef[] = [
  {
    id: 'solid',
    label: 'Solid',
    description: 'Clean and minimal.',
    emoji: '⬜',
    solidColor: '#f9fafb',
    patternStyle: '',
    bgClass: 'bg-gray-50',
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    description: 'Soft blended tones.',
    emoji: '🎨',
    solidColor: '#fdf6f0',
    patternStyle: 'radial-gradient(ellipse at 20% 20%, var(--theme-primary-light) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, var(--theme-primary-mid) 0%, transparent 50%)',
    bgClass: 'bg-[#fdf6f0]',
  },
  {
    id: 'floral',
    label: 'Floral',
    description: 'Delicate repeated petal motif.',
    emoji: '🌸',
    solidColor: '#f9fafb',
    patternStyle: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f9a8d4' fill-opacity='0.15'%3E%3Ccircle cx='20' cy='20' r='3'/%3E%3Ccircle cx='20' cy='10' r='2'/%3E%3Ccircle cx='20' cy='30' r='2'/%3E%3Ccircle cx='10' cy='20' r='2'/%3E%3Ccircle cx='30' cy='20' r='2'/%3E%3Ccircle cx='13' cy='13' r='1.5'/%3E%3Ccircle cx='27' cy='13' r='1.5'/%3E%3Ccircle cx='13' cy='27' r='1.5'/%3E%3Ccircle cx='27' cy='27' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
    bgClass: 'bg-gray-50',
  },
  {
    id: 'planner-paper',
    label: 'Planner Paper',
    description: 'Subtle grid like a notebook.',
    emoji: '📓',
    solidColor: '#fafafa',
    patternStyle: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20h40M20 0v40' stroke='%23e5e7eb' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
    bgClass: 'bg-[#fafafa]',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'Pure white, nothing distracting.',
    emoji: '◻️',
    solidColor: '#ffffff',
    patternStyle: '',
    bgClass: 'bg-white',
  },
];

export const AVATAR_THEMES: AvatarThemeDef[] = [
  {
    id: 'classic',
    label: 'Classic',
    emoji: '💛',
    ringGradient:  'from-rose-200 via-amber-100 to-rose-100',
    innerGradient: 'from-rose-300 to-amber-200',
  },
  {
    id: 'cozy',
    label: 'Cozy',
    emoji: '☕',
    ringGradient:  'from-amber-200 via-orange-100 to-amber-100',
    innerGradient: 'from-amber-300 to-orange-200',
  },
  {
    id: 'wellness',
    label: 'Wellness',
    emoji: '🌿',
    ringGradient:  'from-emerald-200 via-teal-100 to-emerald-100',
    innerGradient: 'from-emerald-300 to-teal-200',
  },
  {
    id: 'professional',
    label: 'Professional',
    emoji: '✨',
    ringGradient:  'from-sky-200 via-blue-100 to-sky-100',
    innerGradient: 'from-sky-300 to-blue-200',
  },
];

export interface CharacterDef {
  id:           CharacterId;
  name:         string;
  emoji:        string;
  role:         string;
  tagline:      string;
  catchphrase:  string;
  superpower:   string;
  primaryColor: string;
  ringGradient:  string;
  innerGradient: string;
  faceEyes:     string;
  faceMouth:    string;
  faceBlush:    string;
  faceAccent:   string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id:           'emma',
    name:         'Emma',
    emoji:        '💜',
    role:         'The Life Bestie',
    tagline:      'Supportive & warm',
    catchphrase:  "We'll figure it out together.",
    superpower:   'Brings it all together and helps you through anything life throws at you.',
    primaryColor: '#a788fa',
    ringGradient:  'from-violet-200 via-purple-100 to-violet-100',
    innerGradient: 'from-violet-300 to-purple-200',
    faceEyes:     '#6d28d9',
    faceMouth:    '#7c3aed',
    faceBlush:    '#ddd6fe',
    faceAccent:   '#a78bfa',
  },
  {
    id:           'ava',
    name:         'Ava',
    emoji:        '📋',
    role:         'The Strategy Bestie',
    tagline:      'Organized & goal-driven',
    catchphrase:  "Let's make a plan.",
    superpower:   'Turns big goals into clear, actionable plans.',
    primaryColor: '#4c7bd9',
    ringGradient:  'from-blue-200 via-sky-100 to-blue-100',
    innerGradient: 'from-blue-300 to-sky-200',
    faceEyes:     '#1e40af',
    faceMouth:    '#1d4ed8',
    faceBlush:    '#bfdbfe',
    faceAccent:   '#4c7bd9',
  },
  {
    id:           'nora',
    name:         'Nora',
    emoji:        '🌿',
    role:         'The Homemaker Bestie',
    tagline:      'Nurturing & resourceful',
    catchphrase:  "Let's make life a little easier.",
    superpower:   'From-scratch ideas, meal planning, and making life at home easier.',
    primaryColor: '#6fa66b',
    ringGradient:  'from-green-200 via-emerald-100 to-green-100',
    innerGradient: 'from-green-300 to-emerald-200',
    faceEyes:     '#166534',
    faceMouth:    '#15803d',
    faceBlush:    '#bbf7d0',
    faceAccent:   '#6fa66b',
  },
  {
    id:           'luna',
    name:         'Luna',
    emoji:        '🔥',
    role:         'The Wellness Bestie',
    tagline:      'Energetic & motivating',
    catchphrase:  'Progress over perfection.',
    superpower:   'Self-care ideas, workouts, and building healthy habits that last.',
    primaryColor: '#ffbc42',
    ringGradient:  'from-orange-200 via-amber-100 to-orange-100',
    innerGradient: 'from-orange-300 to-amber-200',
    faceEyes:     '#9a3412',
    faceMouth:    '#c2410c',
    faceBlush:    '#fed7aa',
    faceAccent:   '#ffbc42',
  },
];

export const DEFAULT_PERSONALIZATION = {
  theme: 'cozy-coffee' as ThemeId,
  bgSkin: 'solid' as BgSkinId,
  avatarTheme: 'classic' as AvatarThemeId,
  memoryEnabled: true,
};

// ─── LifeBestie Memory ────────────────────────────────────────────────────────

export const MEMORY_CATEGORIES = [
  'Preference', 'Goal', 'Routine', 'Meal',
  'Household', 'WorkSchedule', 'EncouragementStyle', 'Wellness',
  'ImportantDate', 'Challenge', 'Favorite', 'Budget', 'Other',
] as const;

export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

export interface LifeBestieMemory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  title: string;
  value: string;
  source: string;
  created_at: string;
  updated_at: string;
}

/** emoji + color for each memory category */
export const MEMORY_CATEGORY_META: Record<MemoryCategory, { emoji: string; color: string; bg: string; label: string }> = {
  Preference:        { emoji: '💜', color: '#a78bfa', bg: '#f5f3ff', label: 'Preferences' },
  Goal:              { emoji: '🎯', color: '#34d399', bg: '#ecfdf5', label: 'Goals' },
  Routine:           { emoji: '🔁', color: '#60a5fa', bg: '#eff6ff', label: 'Routines' },
  Meal:              { emoji: '🍽️', color: '#f97316', bg: '#fff7ed', label: 'Meals & Food' },
  Household:         { emoji: '🏠', color: '#6ee7b7', bg: '#d1fae5', label: 'Household' },
  WorkSchedule:      { emoji: '💼', color: '#818cf8', bg: '#eef2ff', label: 'Work Schedule' },
  EncouragementStyle:{ emoji: '💛', color: '#eab308', bg: '#fefce8', label: 'Encouragement Style' },
  Wellness:          { emoji: '🌿', color: '#22c55e', bg: '#f0fdf4', label: 'Wellness' },
  ImportantDate:     { emoji: '📅', color: '#f43f5e', bg: '#fff1f2', label: 'Important Dates' },
  Challenge:         { emoji: '⚡', color: '#fbbf24', bg: '#fffbeb', label: 'Challenges' },
  Favorite:          { emoji: '⭐', color: '#f59e0b', bg: '#fef3c7', label: 'Favorites' },
  Budget:            { emoji: '💰', color: '#fb923c', bg: '#fff7ed', label: 'Budget' },
  Other:             { emoji: '📝', color: '#9ca3af', bg: '#f3f4f6', label: 'Other' },
};

// ─── User Profile ─────────────────────────────────────────────────────────────

export type HouseholdType = 'solo' | 'couple' | 'family_kids' | 'family_teens' | 'multi_gen' | 'other';
export type WorkSchedule  = 'full_time' | 'part_time' | 'work_from_home' | 'stay_home' | 'shift_work' | 'flexible';
export type Chronotype    = 'morning' | 'evening' | 'neither';
export type MainGoal      = 'stay_organized' | 'reduce_stress' | 'save_money' | 'eat_healthier' | 'more_family_time' | 'better_routines' | 'fitness';

export interface UserProfile {
  user_id: string;
  preferred_name: string;
  household_type: HouseholdType | '';
  work_schedule: WorkSchedule | '';
  chronotype: Chronotype | '';
  main_goals: MainGoal[];
  biggest_challenge: string;
  onboarding_done: boolean;
  character_id?: CharacterId;
  // Soft personalization notes — used in greetings and suggestions
  planning_struggle?: string;
  meal_preference?: string;
  wellness_preference?: string;
  encouragement_style?: string;
  created_at: string;
  updated_at: string;
}

export type RelationshipLevel =
  | 'just-met'
  | 'getting-to-know'
  | 'knows-rhythm'
  | 'life-bestie';

export const RELATIONSHIP_LABELS: Record<RelationshipLevel, string> = {
  'just-met':          'Just met',
  'getting-to-know':   'Getting to know you',
  'knows-rhythm':      'Knows your rhythm',
  'life-bestie':       'Your LifeBestie',
};

/**
 * Derives the relationship level from how much the Bestie knows about the user.
 * Based on memories count — completely invisible to the user as a mechanic.
 */
export function getRelationshipLevel(memoriesCount: number): RelationshipLevel {
  if (memoriesCount >= 9) return 'life-bestie';
  if (memoriesCount >= 4) return 'knows-rhythm';
  if (memoriesCount >= 1) return 'getting-to-know';
  return 'just-met';
}

export const EMPTY_PROFILE: Omit<UserProfile, 'user_id' | 'created_at' | 'updated_at'> = {
  preferred_name: '',
  household_type: '',
  work_schedule: '',
  chronotype: '',
  main_goals: [],
  biggest_challenge: '',
  onboarding_done: false,
  character_id: 'emma',
};

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
