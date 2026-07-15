import { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  dbError,
  WeeklyGroceryList,
  WeeklyGroceryItem,
  WeeklyGrocerySource,
  GroceryHabit,
  GroceryCategory,
  Meal,
  Routine,
  HistoryEntry,
  Event,
  Task,
  getWeekStart,
} from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function fetchWeeklyIntroMessage(
  habits: GroceryHabit[],
  routines: Routine[],
  generatedItems: WeeklyGroceryItem[],
  meals: Meal[],
  events: Event[]
): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/weekly-grocery-intro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ habits, routines, generatedItems, meals, events }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.message ?? null;
  } catch {
    return null;
  }
}

// ─── Price estimation ─────────────────────────────────────────────────────────

const PRICE_RANGES: Record<string, [number, number]> = {
  Produce:        [2, 4],
  Dairy:          [3, 6],
  Meat:           [5, 12],
  Seafood:        [6, 14],
  Bakery:         [2, 5],
  Frozen:         [3, 7],
  Beverages:      [2, 5],
  Pantry:         [2, 5],
  Snacks:         [3, 7],
  'Personal Care':[3, 8],
  Household:      [3, 9],
  Baby:           [4, 10],
  Pet:            [4, 10],
};

const DEFAULT_PRICE_RANGE: [number, number] = [2, 6];

export function estimatePrice(name: string, category: GroceryCategory): number {
  const [min, max] = PRICE_RANGES[category] ?? DEFAULT_PRICE_RANGE;
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  const t = Math.abs(hash) / 2147483647;
  return Math.round((min + t * (max - min)) * 100) / 100;
}

const HABIT_MIN_FREQUENCY = 2;
const RECENT_WINDOW_DAYS = 10;

// Weighted slot budgets per source — controls how many items each source can
// contribute. Meals have highest priority; recent fills any leftover space.
const SLOT_BUDGETS: Record<'meal' | 'habit' | 'planner' | 'routine' | 'recent', number> = {
  meal:    8,
  habit:   6,
  planner: 4,
  routine: 3,
  recent:  2,
};

// Total cap keeps the list scannable and realistic.
const MAX_ITEMS = 18;

// ─── Routine → grocery keyword rules ─────────────────────────────────────────

interface RoutineRule {
  keywords: string[];
  items: { name: string; category: GroceryCategory }[];
}

const ROUTINE_RULES: RoutineRule[] = [
  {
    keywords: ['lunch', 'pack lunch', 'school lunch', 'lunchbox', 'packed lunch'],
    items: [
      { name: 'Bread',         category: 'Pantry'  },
      { name: 'Deli meat',     category: 'Dairy'   },
      { name: 'Cheese slices', category: 'Dairy'   },
      { name: 'Apples',        category: 'Produce' },
      { name: 'Fruit snacks',  category: 'Snacks'  },
      { name: 'Juice boxes',   category: 'Snacks'  },
    ],
  },
  {
    keywords: ['dinner', 'make dinner', 'cook dinner', 'supper', 'family dinner'],
    items: [
      { name: 'Chicken breast',  category: 'Dairy'   },
      { name: 'Broccoli',        category: 'Produce' },
      { name: 'Bell peppers',    category: 'Produce' },
      { name: 'Canned tomatoes', category: 'Pantry'  },
      { name: 'Garlic',          category: 'Produce' },
      { name: 'Pasta',           category: 'Pantry'  },
    ],
  },
  {
    keywords: ['breakfast', 'morning routine', 'wake up', 'morning'],
    items: [
      { name: 'Eggs',         category: 'Dairy'   },
      { name: 'Oats',         category: 'Pantry'  },
      { name: 'Greek yogurt', category: 'Dairy'   },
      { name: 'Berries',      category: 'Produce' },
      { name: 'Bananas',      category: 'Produce' },
      { name: 'Orange juice', category: 'Produce' },
    ],
  },
  {
    keywords: ['bake', 'baking', 'cookies', 'cake', 'muffins', 'brownies'],
    items: [
      { name: 'All-purpose flour', category: 'Pantry' },
      { name: 'Butter',            category: 'Dairy'  },
      { name: 'Sugar',             category: 'Pantry' },
      { name: 'Baking soda',       category: 'Pantry' },
      { name: 'Vanilla extract',   category: 'Pantry' },
    ],
  },
  {
    keywords: ['meal prep', 'prep meals', 'batch cook', 'weekly prep', 'meal plan'],
    items: [
      { name: 'Brown rice',     category: 'Pantry'  },
      { name: 'Quinoa',         category: 'Pantry'  },
      { name: 'Sweet potatoes', category: 'Produce' },
      { name: 'Kale',           category: 'Produce' },
      { name: 'Olive oil',      category: 'Pantry'  },
      { name: 'Lemon',          category: 'Produce' },
    ],
  },
  {
    keywords: ['snack', 'snack time', 'after school', 'snacks'],
    items: [
      { name: 'Hummus',        category: 'Snacks'  },
      { name: 'Baby carrots',  category: 'Produce' },
      { name: 'String cheese', category: 'Dairy'   },
      { name: 'Crackers',      category: 'Snacks'  },
      { name: 'Granola bars',  category: 'Snacks'  },
    ],
  },
  {
    keywords: ['smoothie', 'juice', 'blender'],
    items: [
      { name: 'Spinach',        category: 'Produce' },
      { name: 'Frozen berries', category: 'Produce' },
      { name: 'Almond milk',    category: 'Dairy'   },
      { name: 'Bananas',        category: 'Produce' },
      { name: 'Protein powder', category: 'Pantry'  },
    ],
  },
  {
    keywords: ['coffee', 'morning coffee', 'espresso'],
    items: [
      { name: 'Coffee',       category: 'Pantry' },
      { name: 'Creamer',      category: 'Dairy'  },
      { name: 'Almond milk',  category: 'Dairy'  },
    ],
  },
];

// ─── Planner event → grocery keyword rules ────────────────────────────────────

interface EventRule {
  keywords: string[];
  items: { name: string; category: GroceryCategory }[];
}

const EVENT_RULES: EventRule[] = [
  {
    keywords: ['dinner', 'dinner party', 'date night', 'family dinner', 'supper'],
    items: [
      { name: 'Chicken breast',  category: 'Dairy'   },
      { name: 'Pasta',           category: 'Pantry'  },
      { name: 'Canned tomatoes', category: 'Pantry'  },
      { name: 'Garlic',          category: 'Produce' },
      { name: 'Fresh herbs',     category: 'Produce' },
      { name: 'Parmesan',        category: 'Dairy'   },
      { name: 'Wine',            category: 'Pantry'  },
    ],
  },
  {
    keywords: ['meal prep', 'meal plan', 'prep day', 'batch cook', 'food prep'],
    items: [
      { name: 'Brown rice',       category: 'Pantry'  },
      { name: 'Sweet potatoes',   category: 'Produce' },
      { name: 'Broccoli',         category: 'Produce' },
      { name: 'Ground turkey',    category: 'Dairy'   },
      { name: 'Black beans',      category: 'Pantry'  },
      { name: 'Olive oil',        category: 'Pantry'  },
      { name: 'Spinach',          category: 'Produce' },
      { name: 'Chicken thighs',   category: 'Dairy'   },
    ],
  },
  {
    keywords: ['party', 'birthday party', 'game night', 'get together', 'gathering', 'bbq', 'barbecue'],
    items: [
      { name: 'Chips',           category: 'Snacks'  },
      { name: 'Salsa',           category: 'Snacks'  },
      { name: 'Soda',            category: 'Pantry'  },
      { name: 'Sparkling water', category: 'Pantry'  },
      { name: 'Cookies',         category: 'Snacks'  },
      { name: 'Veggie platter',  category: 'Produce' },
      { name: 'Dip',             category: 'Snacks'  },
      { name: 'Paper plates',    category: 'Pantry'  },
    ],
  },
  {
    keywords: ['kids lunch', 'kids meal', 'school lunch', 'packed lunch', 'lunchbox'],
    items: [
      { name: 'Bread',          category: 'Pantry'  },
      { name: 'Peanut butter',  category: 'Pantry'  },
      { name: 'Apples',         category: 'Produce' },
      { name: 'Grapes',         category: 'Produce' },
      { name: 'Cheese sticks',  category: 'Dairy'   },
      { name: 'Fruit snacks',   category: 'Snacks'  },
      { name: 'Crackers',       category: 'Snacks'  },
      { name: 'Juice boxes',    category: 'Snacks'  },
    ],
  },
  {
    keywords: ['brunch', 'breakfast party', 'morning gathering'],
    items: [
      { name: 'Eggs',           category: 'Dairy'   },
      { name: 'Bacon',          category: 'Dairy'   },
      { name: 'Orange juice',   category: 'Produce' },
      { name: 'Bagels',         category: 'Pantry'  },
      { name: 'Cream cheese',   category: 'Dairy'   },
      { name: 'Fresh fruit',    category: 'Produce' },
      { name: 'Mimosa mix',     category: 'Pantry'  },
    ],
  },
  {
    keywords: ['potluck', 'potluck dinner', 'bring a dish'],
    items: [
      { name: 'Pasta',           category: 'Pantry'  },
      { name: 'Cheese',          category: 'Dairy'   },
      { name: 'Lettuce',         category: 'Produce' },
      { name: 'Tomatoes',        category: 'Produce' },
      { name: 'Salad dressing',  category: 'Pantry'  },
    ],
  },
  {
    keywords: ['bake', 'baking day', 'cookie swap', 'cake', 'dessert'],
    items: [
      { name: 'All-purpose flour', category: 'Pantry' },
      { name: 'Butter',            category: 'Dairy'  },
      { name: 'Sugar',             category: 'Pantry' },
      { name: 'Eggs',              category: 'Dairy'  },
      { name: 'Vanilla extract',   category: 'Pantry' },
      { name: 'Chocolate chips',   category: 'Snacks' },
    ],
  },
];

// ─── Planner task → grocery keyword rules ─────────────────────────────────────

interface TaskRule {
  keywords: string[];
  categories?: string[]; // optional: also match if task.category contains one of these
  items: { name: string; category: GroceryCategory }[];
}

const TASK_RULES: TaskRule[] = [
  {
    keywords: ['pack lunch', 'school lunch', 'lunchbox', 'lunches', 'make lunch', 'kids lunch'],
    items: [
      { name: 'Bread',          category: 'Pantry'  },
      { name: 'Deli meat',      category: 'Dairy'   },
      { name: 'Cheese slices',  category: 'Dairy'   },
      { name: 'Apples',         category: 'Produce' },
      { name: 'Fruit snacks',   category: 'Snacks'  },
      { name: 'Juice boxes',    category: 'Snacks'  },
      { name: 'Crackers',       category: 'Snacks'  },
    ],
  },
  {
    keywords: ['soccer', 'football', 'practice', 'game day', 'sports', 'baseball', 'basketball', 'swim practice', 'tournament'],
    categories: ['Kids'],
    items: [
      { name: 'Sports drinks',  category: 'Beverages' },
      { name: 'Granola bars',   category: 'Snacks'    },
      { name: 'Orange slices',  category: 'Produce'   },
      { name: 'Water bottles',  category: 'Beverages' },
      { name: 'Trail mix',      category: 'Snacks'    },
    ],
  },
  {
    keywords: ['birthday party', 'birthday', 'party', 'celebrate', 'celebration', 'sleepover', 'get together'],
    items: [
      { name: 'Birthday cake',   category: 'Bakery'  },
      { name: 'Chips',           category: 'Snacks'  },
      { name: 'Juice boxes',     category: 'Snacks'  },
      { name: 'Soda',            category: 'Pantry'  },
      { name: 'Cookies',         category: 'Snacks'  },
      { name: 'Paper plates',    category: 'Pantry'  },
      { name: 'Napkins',         category: 'Pantry'  },
    ],
  },
  {
    keywords: ['dinner', 'make dinner', 'cook dinner', 'family dinner', 'supper'],
    categories: ['Home', 'Kids'],
    items: [
      { name: 'Chicken breast',   category: 'Meat'    },
      { name: 'Pasta',            category: 'Pantry'  },
      { name: 'Canned tomatoes',  category: 'Pantry'  },
      { name: 'Broccoli',         category: 'Produce' },
      { name: 'Garlic',           category: 'Produce' },
    ],
  },
  {
    keywords: ['meal prep', 'prep meals', 'batch cook', 'food prep', 'cook for the week'],
    items: [
      { name: 'Brown rice',       category: 'Pantry'  },
      { name: 'Sweet potatoes',   category: 'Produce' },
      { name: 'Chicken thighs',   category: 'Meat'    },
      { name: 'Spinach',          category: 'Produce' },
      { name: 'Olive oil',        category: 'Pantry'  },
      { name: 'Black beans',      category: 'Pantry'  },
    ],
  },
  {
    keywords: ['bake', 'baking', 'cookies', 'cake', 'muffins', 'brownies', 'dessert'],
    items: [
      { name: 'All-purpose flour', category: 'Pantry' },
      { name: 'Butter',            category: 'Dairy'  },
      { name: 'Sugar',             category: 'Pantry' },
      { name: 'Eggs',              category: 'Dairy'  },
      { name: 'Vanilla extract',   category: 'Pantry' },
    ],
  },
  {
    keywords: ['grocery', 'groceries', 'shopping', 'store run', 'pick up', 'errands'],
    categories: ['Grocery'],
    items: [
      { name: 'Milk',         category: 'Dairy'   },
      { name: 'Eggs',         category: 'Dairy'   },
      { name: 'Bread',        category: 'Pantry'  },
      { name: 'Bananas',      category: 'Produce' },
      { name: 'Greek yogurt', category: 'Dairy'   },
    ],
  },
  {
    keywords: ['breakfast', 'morning routine', 'make breakfast'],
    items: [
      { name: 'Eggs',          category: 'Dairy'   },
      { name: 'Oats',          category: 'Pantry'  },
      { name: 'Berries',       category: 'Produce' },
      { name: 'Orange juice',  category: 'Produce' },
      { name: 'Greek yogurt',  category: 'Dairy'   },
    ],
  },
  {
    keywords: ['snack', 'after school snack', 'snacks for kids'],
    categories: ['Kids'],
    items: [
      { name: 'Hummus',         category: 'Snacks'  },
      { name: 'Baby carrots',   category: 'Produce' },
      { name: 'String cheese',  category: 'Dairy'   },
      { name: 'Granola bars',   category: 'Snacks'  },
      { name: 'Apple slices',   category: 'Produce' },
    ],
  },
  {
    keywords: ['bbq', 'barbecue', 'cookout', 'grill', 'outdoor'],
    items: [
      { name: 'Hot dogs',       category: 'Meat'    },
      { name: 'Burger patties', category: 'Meat'    },
      { name: 'Burger buns',    category: 'Bakery'  },
      { name: 'Corn on the cob',category: 'Produce' },
      { name: 'Chips',          category: 'Snacks'  },
      { name: 'Soda',           category: 'Pantry'  },
    ],
  },
];

/** Returns items from EVENT_RULES that match the given event title text. */
function matchEventItems(title: string): { name: string; category: GroceryCategory }[] {
  const text = title.toLowerCase();
  const matched: { name: string; category: GroceryCategory }[] = [];
  for (const rule of EVENT_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      matched.push(...rule.items);
    }
  }
  return matched;
}

/** Returns items from TASK_RULES that match the given task title, category, and notes. */
function matchTaskItems(title: string, category: string, notes?: string | null): { name: string; category: GroceryCategory }[] {
  const text = [title, notes ?? ''].join(' ').toLowerCase();
  const matched: { name: string; category: GroceryCategory }[] = [];
  for (const rule of TASK_RULES) {
    const keywordMatch = rule.keywords.some((kw) => text.includes(kw));
    const categoryMatch = rule.categories?.some((c) => c.toLowerCase() === category.toLowerCase());
    if (keywordMatch || categoryMatch) {
      matched.push(...rule.items);
    }
  }
  return matched;
}

// ─── Generation logic ─────────────────────────────────────────────────────────

/** Normalise an ingredient/item name: lowercase, trim, collapse internal spaces. */
function normaliseName(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Normalise a unit string for comparison. Empty string = unitless. */
function normaliseUnit(u?: string): string {
  return (u ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Parse a quantity string ("2", "1/2", "1.5") to a float. Returns null if not parseable. */
function parseQtyNum(q?: string): number | null {
  if (!q) return null;
  const t = q.trim();
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]!) / parseInt(frac[2]!);
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

/** Format a quantity float back to a clean string. */
function formatQtyNum(n: number): string {
  // Common fractions
  const fracs: [number, string][] = [[1/4,'1/4'],[1/3,'1/3'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4']];
  for (const [val, str] of fracs) {
    if (Math.abs(n - val) < 0.005) return str;
  }
  return parseFloat(n.toFixed(2)).toString();
}

function generateWeeklyItems(
  habits: GroceryHabit[],
  routines: Routine[],
  recentHistory: HistoryEntry[],
  events: Event[] = [],
  meals: Meal[] = [],
  tasks: Task[] = []
): WeeklyGroceryItem[] {
  // Global dedup registry — normaliseName(name) → item.
  // For meal ingredients keyed by name+"|"+unit so different units stay separate.
  const registry = new Map<string, WeeklyGroceryItem>();

  // Per-source counters enforce slot budgets independently.
  const counts: Record<string, number> = {};

  function add(name: string, category: GroceryCategory, source: WeeklyGrocerySource) {
    const key = normaliseName(name);
    if (!key || registry.has(key)) return;
    const budget = SLOT_BUDGETS[source as keyof typeof SLOT_BUDGETS] ?? Infinity;
    const used = counts[source] ?? 0;
    if (used >= budget) return;
    registry.set(key, { name, category, source, checked: false, price: estimatePrice(name, category), estimated: true });
    counts[source] = used + 1;
  }

  // ── 1. MEALS (highest priority) ───────────────────────────────────────────
  // Consolidate meal ingredients: same name+unit → sum quantities.
  // Different units → separate rows. All ingredients tagged with mealSources.
  const sortedMeals = [...meals].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Intermediate consolidation map keyed by "normalizedName|normalizedUnit"
  const mealConsolidated = new Map<string, WeeklyGroceryItem>();

  for (const meal of sortedMeals) {
    for (const ing of meal.ingredients) {
      const normName = normaliseName(ing.name);
      const normUnit = normaliseUnit(ing.unit);
      const key = `${normName}|${normUnit}`;

      const existing = mealConsolidated.get(key);
      if (!existing) {
        mealConsolidated.set(key, {
          name: ing.name.trim(),
          category: ing.category,
          source: 'meal',
          checked: false,
          price: estimatePrice(ing.name, ing.category),
          estimated: true,
          quantity: ing.quantity?.trim() || undefined,
          unit: ing.unit?.trim() || undefined,
          mealSources: [meal.name],
        });
      } else {
        // Accumulate quantity if both are numeric
        const existingQty = parseQtyNum(existing.quantity);
        const incomingQty = parseQtyNum(ing.quantity);
        if (existingQty !== null && incomingQty !== null) {
          existing.quantity = formatQtyNum(existingQty + incomingQty);
        }
        // Add source if not already listed
        if (existing.mealSources && !existing.mealSources.includes(meal.name)) {
          existing.mealSources.push(meal.name);
        }
      }
    }
  }

  // Commit consolidated meal items to the global registry.
  // Use the normalised name as key so non-meal sources still deduplicate against them.
  for (const [key, item] of mealConsolidated) {
    const normName = key.split('|')[0]!;
    // If same ingredient already in registry under a different unit, use a unique key
    const registryKey = registry.has(normName) ? key : normName;
    if (!registry.has(registryKey)) {
      registry.set(registryKey, item);
    }
  }

  // ── 2. HIGH-FREQUENCY HABITS ──────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const scoredHabits = habits
    .filter((h) => h.frequency >= HABIT_MIN_FREQUENCY)
    .map((h) => {
      const days = Math.max(
        0,
        Math.floor((Date.parse(today) - Date.parse(h.lastAdded)) / 86_400_000)
      );
      const staleness = days >= 14 ? 2.0 : days >= 7 ? 1.5 : days >= 3 ? 1.1 : 1.0;
      return { h, score: h.frequency * staleness };
    })
    .sort((a, b) => b.score - a.score);

  for (const { h } of scoredHabits) {
    add(h.name, h.category, 'habit');
  }

  // ── 3. PLANNER EVENTS & TASKS (upcoming 14 days) ─────────────────────────
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 14);
  const weekAheadStr = weekAhead.toISOString().split('T')[0];

  for (const event of events) {
    if (event.event_date > weekAheadStr) continue;
    for (const item of matchEventItems(event.title)) {
      add(item.name, item.category, 'planner');
    }
  }

  for (const task of tasks) {
    if (task.completed) continue;
    if (task.due_date && task.due_date > weekAheadStr) continue;
    for (const item of matchTaskItems(task.title, task.category ?? '', (task as Task & { notes?: string }).notes)) {
      add(item.name, item.category, 'planner');
    }
  }

  // ── 4. ROUTINE-INFERRED ITEMS ─────────────────────────────────────────────
  for (const routine of routines) {
    const text = [routine.name, ...routine.tasks].join(' ').toLowerCase();
    const matchedRules = ROUTINE_RULES.filter((rule) =>
      rule.keywords.some((kw) => text.includes(kw))
    );
    for (const rule of matchedRules) {
      for (const item of rule.items) {
        add(item.name, item.category, 'routine');
      }
    }
  }

  // ── 5. RECENT HISTORY (fills leftover capacity) ───────────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const habitCategoryMap = new Map<string, GroceryCategory>(
    habits.map((h) => [normaliseName(h.name), h.category])
  );

  const recentNames = recentHistory
    .filter((e) => e.date >= cutoffStr)
    .flatMap((e) => e.actions)
    .filter((a) => a.startsWith('Added grocery: '))
    .map((a) =>
      a
        .replace(/^Added grocery: /, '')
        .replace(/\s\[(morning|afternoon|evening)\]$/, '')
        .trim()
    );

  for (const name of recentNames) {
    if (registry.size >= MAX_ITEMS) break;
    const category = habitCategoryMap.get(normaliseName(name)) ?? 'Pantry';
    add(name, category, 'recent');
  }

  return [...registry.values()].slice(0, MAX_ITEMS);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWeeklyGroceryList(
  habits: GroceryHabit[],
  routines: Routine[],
  recentHistory: HistoryEntry[],
  events: Event[] = [],
  meals: Meal[] = [],
  tasks: Task[] = []
) {
  const [weeklyList, setWeeklyList] = useState<WeeklyGroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<WeeklyGroceryList | null>(null);
  const userIdRef = useRef<string | null>(null);
  const memoryId = localStorage.getItem(MEMORY_ID_KEY);

  // Keep refs in sync so the load callback can read the latest data without
  // depending on it in its dependency array. This prevents the weekly list from
  // being re-fetched from Supabase every time an event or task changes.
  const dataRef = useRef({ habits, routines, recentHistory, events, meals, tasks });
  dataRef.current = { habits, routines, recentHistory, events, meals, tasks };

  // Keep list ref in sync for use inside async callbacks
  useEffect(() => {
    listRef.current = weeklyList;
  }, [weeklyList]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    userIdRef.current = user.id;

    const weekStart = getWeekStart();

    const { data } = await supabase
      .from('weekly_grocery_lists')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle();

    if (data) {
      setWeeklyList(data as WeeklyGroceryList);
      setLoading(false);
      return;
    }

    // No list for this week — generate, fetch intro message, then persist.
    // Read from refs so this callback doesn't depend on the live props.
    const { habits, routines, recentHistory, events, meals, tasks } = dataRef.current;
    const items = generateWeeklyItems(habits, routines, recentHistory, events, meals, tasks);
    const weekly_message = await fetchWeeklyIntroMessage(habits, routines, items, meals, events);

    const { data: created, error: wglErr } = await supabase
      .from('weekly_grocery_lists')
      .insert({
        memory_id: memoryId,
        user_id: user.id,
        week_start_date: weekStart,
        items,
        weekly_message,
      })
      .select()
      .single();
    dbError('weekly_grocery_lists (insert)', wglErr);

    if (created) setWeeklyList(created as WeeklyGroceryList);
    setLoading(false);
  }, [memoryId]);

  useEffect(() => {
    load();
  }, [load]);


  // ─── Persistence helper ───────────────────────────────────────────────────

  async function persist(items: WeeklyGroceryItem[]) {
    const list = listRef.current;
    const userId = userIdRef.current;
    if (!list || !userId) return;
    setWeeklyList({ ...list, items });
    await supabase
      .from('weekly_grocery_lists')
      .update({ items })
      .eq('id', list.id)
      .eq('user_id', userId);
  }

  // ─── Public actions ───────────────────────────────────────────────────────

  async function toggleWeeklyItem(name: string, checked: boolean) {
    const list = listRef.current;
    if (!list) return;
    const updated = list.items.map((i) =>
      i.name.toLowerCase() === name.toLowerCase() ? { ...i, checked } : i
    );
    await persist(updated);
  }

  async function addWeeklyItem(
    name: string,
    category: GroceryCategory,
    source: WeeklyGrocerySource = 'habit',
    quantity?: string,
    unit?: string,
    mealSources?: string[]
  ) {
    const list = listRef.current;
    if (!list) return;

    const normName = normaliseName(name);
    const normUnit = normaliseUnit(unit);

    // Find an existing item with the same normalised name AND same unit.
    // This preserves separate rows when the same ingredient appears in different units.
    const existingIdx = list.items.findIndex((i) => {
      const iNormName = normaliseName(i.name);
      const iNormUnit = normaliseUnit(i.unit);
      return iNormName === normName && iNormUnit === normUnit;
    });

    if (existingIdx !== -1) {
      const existing = list.items[existingIdx];
      const updated = [...list.items];

      // Sum numeric quantities
      const existingQty = parseQtyNum(existing.quantity);
      const incomingQty = parseQtyNum(quantity);
      let mergedQty = existing.quantity;
      if (existingQty !== null && incomingQty !== null) {
        mergedQty = formatQtyNum(existingQty + incomingQty);
      } else if (incomingQty !== null && existingQty === null) {
        mergedQty = quantity;
      }

      // Merge mealSources, avoiding duplicates
      const existingSources = existing.mealSources ?? [];
      const addedSources = (mealSources ?? []).filter((s) => !existingSources.includes(s));

      updated[existingIdx] = {
        ...existing,
        quantity: mergedQty,
        mealSources: addedSources.length > 0 ? [...existingSources, ...addedSources] : existingSources,
      };
      await persist(updated);
      return;
    }

    await persist([...list.items, {
      name: name.trim(),
      category,
      source,
      checked: false,
      price: estimatePrice(name, category),
      estimated: true,
      quantity: quantity?.trim() || undefined,
      unit: unit?.trim() || undefined,
      mealSources,
    }]);
  }

  /** Updates the price of a weekly item. Setting a price manually clears the estimated flag. */
  async function updateWeeklyItemPrice(name: string, price: number) {
    const list = listRef.current;
    if (!list) return;
    const updated = list.items.map((i) =>
      i.name.toLowerCase() === name.toLowerCase()
        ? { ...i, price: Math.round(price * 100) / 100, estimated: false }
        : i
    );
    await persist(updated);
  }

  async function skipWeeklyItem(name: string) {
    const list = listRef.current;
    if (!list) return;
    const updated = list.items.map((i) =>
      i.name.toLowerCase() === name.toLowerCase() ? { ...i, skipped: !i.skipped } : i
    );
    await persist(updated);
  }

  async function togglePantryItem(name: string) {
    const list = listRef.current;
    if (!list) return;
    const updated = list.items.map((i) =>
      i.name.toLowerCase() === name.toLowerCase() ? { ...i, in_pantry: !i.in_pantry } : i
    );
    await persist(updated);
  }

  async function removeWeeklyItem(name: string) {
    const list = listRef.current;
    if (!list) return;
    await persist(list.items.filter((i) => i.name.toLowerCase() !== name.toLowerCase()));
  }

  /** Regenerates auto-suggested items from latest data; preserves manually-added items. */
  async function regenerate() {
    const list = listRef.current;
    if (!list || !memoryId) return;

    // Keep items the user added themselves so they are never silently removed
    const manualItems = list.items.filter((i) => i.source === 'manual');
    const manualNames = new Set(manualItems.map((i) => i.name.toLowerCase()));

    // Read from refs so regenerate always uses the latest data without
    // needing to be recreated when props change.
    const { habits, routines, recentHistory, events, meals, tasks } = dataRef.current;

    const generated = generateWeeklyItems(habits, routines, recentHistory, events, meals, tasks)
      .filter((i) => !manualNames.has(i.name.toLowerCase()));

    // Manual items go first so they are visually prominent
    const items = [...manualItems, ...generated];

    const weekly_message = await fetchWeeklyIntroMessage(habits, routines, items, meals, events);
    const userId = userIdRef.current;
    if (!userId) return;
    setWeeklyList({ ...list, items, weekly_message });
    await supabase
      .from('weekly_grocery_lists')
      .update({ items, weekly_message })
      .eq('id', list.id)
      .eq('user_id', userId);
  }

  return {
    weeklyList,
    loading,
    toggleWeeklyItem,
    addWeeklyItem,
    skipWeeklyItem,
    togglePantryItem,
    removeWeeklyItem,
    updateWeeklyItemPrice,
    regenerate,
  };
}
