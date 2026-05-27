import { useState, useEffect, useRef } from 'react';
import { Plus, Sparkles, ShoppingCart, Check, RefreshCw, Calendar, UtensilsCrossed, Play, Pencil, DollarSign, Lightbulb, EyeOff, Eye, Trash2, ChevronRight, X } from 'lucide-react';
import {
  GroceryItem,
  GroceryHabit,
  Routine,
  HistoryEntry,
  WeeklyGroceryList,
  WeeklyGroceryItem,
  WeeklyGrocerySource,
  GROCERY_CATEGORIES,
  GroceryCategory,
  Meal,
  MealIngredient,
  MealType,
  MEAL_TYPES,
  SpendingSnapshot,
  ReceiptItem,
  getWeekStart,
  getCategoryColors,
} from '../lib/supabase';
import MealPlannerSheet from '../components/MealPlannerSheet';
import LowStockBanner from '../components/LowStockBanner';
import ShoppingMode from '../components/ShoppingMode';
import ReceiptScanner from '../components/ReceiptScanner';
import { ScanResult } from '../hooks/useReceipts';
import { getLowStockSuggestions } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface GroceryPageProps {
  items: GroceryItem[];
  habits: GroceryHabit[];
  routines: Routine[];
  recentHistory: HistoryEntry[];
  weeklyList: WeeklyGroceryList | null;
  weeklyLoading: boolean;
  meals: Meal[];
  mealsLoading: boolean;
  weeklyBudget: number;
  estimatedTotal: number;
  onToggle: (id: string, checked: boolean) => void;
  onAdd: (name: string, category: GroceryCategory) => Promise<void>;
  onDelete: (id: string) => void;
  onToggleWeekly: (name: string, checked: boolean) => Promise<void>;
  onAddWeekly: (name: string, category: GroceryCategory, source: WeeklyGrocerySource) => Promise<void>;
  onSkipWeekly: (name: string) => Promise<void>;
  onRemoveWeekly: (name: string) => Promise<void>;
  onRegenerateWeekly: () => Promise<void>;
  onUpdateWeeklyItemPrice: (name: string, price: number) => Promise<void>;
  onSetWeeklyBudget: (amount: number) => Promise<void>;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onAddMealFull: (opts: { name: string; meal_type: MealType; meal_date: string; ingredients: MealIngredient[] }) => Promise<Meal | null>;
  onDeleteMeal: (id: string) => void;
  onPlanMeals: (mealIds: string[], ingredients: MealIngredient[]) => Promise<void>;
  spendingSnapshots: SpendingSnapshot[];
  spendingInsights: string[];
  onScanReceipt: (file: File) => Promise<ScanResult | null>;
  onSaveReceipt: (result: ScanResult, items: ReceiptItem[]) => Promise<void>;
  receiptScanning: boolean;
  receiptScanError: string | null;
}


const SOURCE_LABELS: Record<WeeklyGrocerySource, string> = {
  habit:   'habit',
  routine: 'routine',
  recent:  'recent',
  manual:  'added',
  meal:    'meal',
  planner: 'Planner',
};

const SOURCE_COLORS: Record<WeeklyGrocerySource, string> = {
  habit:   'bg-amber-100 text-amber-600',
  routine: 'bg-sky-100 text-sky-600',
  recent:  'bg-rose-100 text-rose-500',
  manual:  'bg-gray-100 text-gray-500',
  meal:    'bg-emerald-100 text-emerald-600',
  planner: 'bg-teal-100 text-teal-600',
};

const FALLBACK_SUGGESTIONS: { name: string; category: GroceryCategory }[] = [
  { name: 'Milk',         category: 'Dairy'   },
  { name: 'Eggs',         category: 'Dairy'   },
  { name: 'Bananas',      category: 'Produce' },
  { name: 'Spinach',      category: 'Produce' },
  { name: 'Pasta',        category: 'Pantry'  },
  { name: 'Olive oil',    category: 'Pantry'  },
  { name: 'Granola bars', category: 'Snacks'  },
  { name: 'Hummus',       category: 'Snacks'  },
];

interface AISuggestion {
  name: string;
  category: GroceryCategory;
}

interface AISuggestionsResult {
  message: string;
  items: AISuggestion[];
}

async function fetchAISuggestions(
  habits: GroceryHabit[],
  routines: Routine[],
  recentHistory: HistoryEntry[],
  currentItems: GroceryItem[]
): Promise<AISuggestionsResult | null> {
  try {
    const recentActions = recentHistory
      .flatMap((h) => h.actions)
      .map((a) => a.replace(/\s\[(morning|afternoon|evening)\]$/, ''));
    const res = await fetch(`${SUPABASE_URL}/functions/v1/grocery-suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        commonGroceries: habits,
        routines,
        recentHistory: recentActions,
        currentItems: currentItems.map((i) => ({ name: i.name, category: i.category })),
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SuggestionRow({
  name,
  category,
  onAdd,
}: {
  name: string;
  category: GroceryCategory;
  onAdd: () => Promise<void>;
}) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle');
  const colors = getCategoryColors(category);

  async function handleClick() {
    if (state !== 'idle') return;
    setState('adding');
    await onAdd();
    setState('added');
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/70 transition-all duration-200 ${
        state === 'added' ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
        <span className="text-sm font-medium text-gray-700 truncate">{name}</span>
      </div>
      <button
        onClick={handleClick}
        disabled={state !== 'idle'}
        className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white transition-all active:scale-95 disabled:cursor-default ${
          state === 'added' ? 'bg-gray-300' : `${colors.check}`
        }`}
      >
        {state === 'adding' ? (
          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
        ) : state === 'added' ? (
          <><Check size={11} /> Added</>
        ) : (
          <><Plus size={11} /> Add</>
        )}
      </button>
    </div>
  );
}

// ─── Weekly add-item form ─────────────────────────────────────────────────────

function CategoryPicker({
  selected,
  accentClass,
  onChange,
}: {
  selected: GroceryCategory;
  accentClass: string;
  onChange: (v: GroceryCategory) => void;
}) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function commitCustom() {
    const trimmed = custom.trim();
    if (trimmed) {
      onChange(trimmed);
      setCustom('');
    }
    setShowCustom(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {GROCERY_CATEGORIES.map((cat) => {
          const colors = getCategoryColors(cat);
          return (
            <button
              key={cat}
              onClick={() => { onChange(cat); setShowCustom(false); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                selected === cat
                  ? `${colors.bg} ${colors.text} ring-1 ring-current`
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              {cat}
            </button>
          );
        })}
        {!GROCERY_CATEGORIES.includes(selected) && (
          <button
            onClick={() => setShowCustom(false)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${getCategoryColors(selected).bg} ${getCategoryColors(selected).text} ring-1 ring-current`}
          >
            {selected}
          </button>
        )}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          + Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Category name…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') setShowCustom(false); }}
            className={`flex-1 text-xs bg-gray-50 rounded-xl px-3 py-2 outline-none border border-transparent focus:${accentClass} transition-colors`}
            autoFocus
          />
          <button
            onClick={commitCustom}
            disabled={!custom.trim()}
            className="text-xs font-semibold text-white bg-gray-400 hover:bg-gray-500 disabled:opacity-50 px-3 py-2 rounded-xl transition-colors"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Spending Trends ──────────────────────────────────────────────────────────

const CATEGORY_PALETTE: Record<string, string> = {
  Produce:    '#34d399',
  Dairy:      '#60a5fa',
  Pantry:     '#fbbf24',
  Snacks:     '#f87171',
  Beverages:  '#a78bfa',
  Meat:       '#fb923c',
  Bakery:     '#f472b6',
  Frozen:     '#818cf8',
  Household:  '#94a3b8',
  Personal:   '#2dd4bf',
  Other:      '#d1d5db',
};

function SpendingTrends({
  snapshots,
  insights,
  weeklyBudget,
}: {
  snapshots: SpendingSnapshot[];
  insights: string[];
  weeklyBudget: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (snapshots.length === 0) return null;

  const recent = snapshots.slice(0, 8).reverse(); // oldest → newest for chart
  const maxSpend = Math.max(...recent.map((s) => s.total_spent), weeklyBudget, 1);

  // Aggregate category totals across all snapshots
  const catTotals: Record<string, number> = {};
  for (const snap of snapshots.slice(0, 8)) {
    for (const [cat, amount] of Object.entries(snap.category_breakdown)) {
      catTotals[cat] = (catTotals[cat] ?? 0) + amount;
    }
  }
  const topCategories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const catTotal = topCategories.reduce((s, [, v]) => s + v, 0);

  const avgSpend = snapshots.slice(0, 8).reduce((s, r) => s + r.total_spent, 0) / Math.min(snapshots.length, 8);
  const budgetMetRate = Math.round(
    (snapshots.slice(0, 8).filter((s) => s.budget_met).length / Math.min(snapshots.length, 8)) * 100
  );

  function formatWeek(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-50 flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M1 10L4 6.5L6.5 8.5L9.5 4L12 7" stroke="#38bdf8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-600">Spending Trends</span>
          <span className="text-xs text-gray-400">{snapshots.length} week{snapshots.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">avg ${avgSpend.toFixed(0)}/wk</span>
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-gray-300 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-50">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-gray-800">${avgSpend.toFixed(0)}</p>
              <p className="text-xs text-gray-400">avg/week</p>
            </div>
            <div className={`rounded-xl px-3 py-2.5 text-center ${budgetMetRate >= 70 ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <p className={`text-lg font-bold ${budgetMetRate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{budgetMetRate}%</p>
              <p className={`text-xs ${budgetMetRate >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>on budget</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-gray-800">{snapshots.length}</p>
              <p className="text-xs text-gray-400">weeks tracked</p>
            </div>
          </div>

          {/* Bar chart */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weekly Spend</p>
            <div className="flex items-end gap-1.5 h-20">
              {recent.map((snap) => {
                const heightPct = (snap.total_spent / maxSpend) * 100;
                const budgetLinePct = (weeklyBudget / maxSpend) * 100;
                const isOver = snap.total_spent > snap.weekly_budget;
                return (
                  <div key={snap.week_start_date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div className="w-full relative" style={{ height: '68px' }}>
                      {/* Budget line */}
                      <div
                        className="absolute w-full border-t-2 border-dashed border-amber-200 z-10"
                        style={{ bottom: `${budgetLinePct}%` }}
                      />
                      {/* Bar */}
                      <div className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                        style={{
                          height: `${Math.max(heightPct, 4)}%`,
                          backgroundColor: isOver ? '#fca5a5' : '#6ee7b7',
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-300 group-hover:text-gray-400 transition-colors whitespace-nowrap">
                      {formatWeek(snap.week_start_date)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-300" /><span className="text-xs text-gray-400">On budget</span></div>
              <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-300" /><span className="text-xs text-gray-400">Over</span></div>
              <div className="flex items-center gap-1"><div className="w-4 border-t-2 border-dashed border-amber-300" /><span className="text-xs text-gray-400">Budget</span></div>
            </div>
          </div>

          {/* Category breakdown */}
          {topCategories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Top Categories</p>
              <div className="space-y-2">
                {topCategories.map(([cat, total]) => {
                  const pct = catTotal > 0 ? (total / catTotal) * 100 : 0;
                  const color = CATEGORY_PALETTE[cat] ?? CATEGORY_PALETTE.Other;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium text-gray-600">{cat}</span>
                        </div>
                        <span className="text-xs text-gray-400">${(total / Math.min(snapshots.length, 8)).toFixed(0)}/wk avg</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pattern insights */}
          {insights.length > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-3 space-y-2">
              <p className="text-xs font-semibold text-sky-600">Patterns I noticed</p>
              {insights.map((insight, i) => (
                <p key={i} className="text-xs text-sky-700 leading-relaxed">{insight}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BudgetSuggestions({
  items,
  weeklyBudget,
  estimatedTotal,
}: {
  items: WeeklyGroceryItem[];
  weeklyBudget: number;
  estimatedTotal: number;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (weeklyBudget <= 0 || estimatedTotal <= weeklyBudget) {
      setSuggestions([]);
      setFetched(false);
      return;
    }
    // Debounce: wait 1.5s after items/total stabilise before calling AI
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/budget-suggestions`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ items, weeklyBudget, estimatedTotal }),
          }
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
        setFetched(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [items, weeklyBudget, estimatedTotal]);

  if (estimatedTotal <= weeklyBudget || weeklyBudget <= 0) return null;

  return (
    <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Lightbulb size={13} className="text-rose-400 shrink-0" />
        <span className="text-xs font-semibold text-rose-600">Ways to save this week</span>
      </div>

      {loading && !fetched && (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3 h-3 rounded-full border-2 border-rose-300 border-t-rose-500 animate-spin" />
          <span className="text-xs text-rose-400">Finding suggestions…</span>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-rose-500">{i + 1}</span>
              </span>
              <p className="text-xs text-rose-700 leading-relaxed">{s}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BudgetBar({
  weeklyBudget,
  estimatedTotal,
  items,
  onSetBudget,
  onScanReceipt,
}: {
  weeklyBudget: number;
  estimatedTotal: number;
  items: WeeklyGroceryItem[];
  onSetBudget: (amount: number) => Promise<void>;
  onScanReceipt?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const pct = weeklyBudget > 0 ? Math.min((estimatedTotal / weeklyBudget) * 100, 100) : 0;
  const over = estimatedTotal > weeklyBudget;
  const remaining = weeklyBudget - estimatedTotal;

  function startEdit() {
    setDraft(weeklyBudget.toFixed(2));
    setEditing(true);
  }

  async function commitEdit() {
    const val = parseFloat(draft);
    if (!isNaN(val) && val > 0) await onSetBudget(val);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-2xl px-4 py-4 shadow-sm border border-gray-100 space-y-3.5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <DollarSign size={13} className="text-amber-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Weekly Budget</span>
        </div>
        <div className="flex items-center gap-2">
          {onScanReceipt && (
            <button
              onClick={onScanReceipt}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100 transition-colors active:scale-95"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 7h.01M12 7h.01M17 7h.01M7 11h10"/>
              </svg>
              Scan Receipt
            </button>
          )}
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="5"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
                onBlur={commitEdit}
                className="w-20 text-xs font-semibold text-right bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 outline-none"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-colors"
            >
              <span>Edit</span>
              <Pencil size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Spend summary */}
      <div className="space-y-2">
        <div className="flex items-end justify-between">
          <div>
            <span className={`text-2xl font-bold tracking-tight ${over ? 'text-red-500' : 'text-gray-800'}`}>
              ${estimatedTotal.toFixed(0)}
            </span>
            <span className="text-sm font-medium text-gray-400"> / ${weeklyBudget.toFixed(0)} spent</span>
          </div>
          <span className={`text-sm font-semibold pb-0.5 ${over ? 'text-red-500' : 'text-emerald-600'}`}>
            {over
              ? `$${Math.abs(remaining).toFixed(2)} over`
              : `$${remaining.toFixed(2)} left`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              over ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Percentage label */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{Math.round(pct)}% of budget used</span>
          <span className={`text-xs font-medium ${
            over ? 'text-red-400' : pct > 80 ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {over ? 'Over budget' : pct > 80 ? 'Almost there' : 'On track'}
          </span>
        </div>
      </div>

      {/* Budget awareness message */}
      {weeklyBudget > 0 && pct >= 80 && (
        <div
          className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-300 ${
            over
              ? 'bg-red-50 border border-red-100'
              : 'bg-amber-50 border border-amber-100'
          }`}
        >
          <span className="text-base leading-none mt-0.5">{over ? '🌿' : '💛'}</span>
          <p className={`text-xs leading-relaxed ${over ? 'text-red-600' : 'text-amber-700'}`}>
            {over
              ? "You've gone over budget — want help adjusting? Try swapping a few items or spreading some to next week."
              : "You're getting close to your weekly budget. A few more items and you'll be right on track!"}
          </p>
        </div>
      )}

      {/* AI cost-saving suggestions (over budget only) */}
      {over && (
        <BudgetSuggestions
          items={items}
          weeklyBudget={weeklyBudget}
          estimatedTotal={estimatedTotal}
        />
      )}
    </div>
  );
}

function AddWeeklyItemForm({
  newItem,
  newCategory,
  adding,
  onChangeItem,
  onChangeCategory,
  onAdd,
}: {
  newItem: string;
  newCategory: GroceryCategory;
  adding: boolean;
  onChangeItem: (v: string) => void;
  onChangeCategory: (v: GroceryCategory) => void;
  onAdd: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add to this week's list…"
          value={newItem}
          onChange={(e) => onChangeItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-amber-200 transition-colors"
          autoFocus
        />
        <button
          onClick={onAdd}
          disabled={!newItem.trim() || adding}
          className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
        >
          {adding ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus size={18} className="text-white" />
          )}
        </button>
      </div>
      <CategoryPicker selected={newCategory} accentClass="border-amber-200" onChange={onChangeCategory} />
    </div>
  );
}

// ─── Weekly item row ──────────────────────────────────────────────────────────

function WeeklyItemRow({
  item,
  colors,
  onToggle,
  onAddToList,
  onSkip,
  onRemove,
  onUpdatePrice,
}: {
  item: WeeklyGroceryItem;
  colors: ReturnType<typeof getCategoryColors>;
  onToggle: () => void;
  onAddToList: () => void;
  onSkip: () => void;
  onRemove: () => void;
  onUpdatePrice: (price: number) => Promise<void>;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState('');

  function startPriceEdit() {
    if (item.skipped) return;
    setPriceDraft(item.price != null ? item.price.toFixed(2) : '');
    setEditingPrice(true);
  }

  async function commitPrice() {
    const val = parseFloat(priceDraft);
    if (!isNaN(val) && val >= 0) await onUpdatePrice(val);
    setEditingPrice(false);
  }

  const isSkipped = !!item.skipped;

  return (
    <div
      className={`flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2.5 transition-all duration-200 ${
        item.checked ? 'opacity-50' : isSkipped ? 'opacity-60' : ''
      }`}
    >
      {/* Checkbox — hidden when skipped */}
      {!isSkipped ? (
        <button
          onClick={onToggle}
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
            item.checked ? `${colors.dot} border-transparent` : 'border-gray-200 bg-white'
          }`}
        >
          {item.checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-200 shrink-0" />
      )}

      {/* Name + source badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-sm font-medium truncate ${
            item.checked ? 'line-through text-gray-300'
            : isSkipped ? 'line-through text-gray-300'
            : 'text-gray-700'
          }`}>
            {item.name}
          </span>
          {isSkipped ? (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-400">
              skipped
            </span>
          ) : (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[item.source]}`}>
              {SOURCE_LABELS[item.source]}
            </span>
          )}
        </div>

        {/* Price row — hidden when skipped */}
        {!isSkipped && (
          editingPrice ? (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') commitPrice(); if (e.key === 'Escape') setEditingPrice(false); }}
                onBlur={commitPrice}
                className="w-16 text-xs text-right bg-white border border-amber-200 rounded-md px-1.5 py-0.5 outline-none"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={startPriceEdit}
              className="flex items-center gap-1 mt-0.5 text-xs text-gray-400 hover:text-amber-500 transition-colors"
            >
              {item.price != null ? (
                <>
                  <span className={item.estimated ? 'text-gray-400' : 'text-emerald-600 font-medium'}>
                    ${item.price.toFixed(2)}
                  </span>
                  {item.estimated && <span className="text-gray-300">est.</span>}
                </>
              ) : (
                <span className="text-gray-300">+ price</span>
              )}
              <Pencil size={9} className="text-gray-300" />
            </button>
          )
        )}
      </div>

      {/* Add to main list — hidden when skipped */}
      {!isSkipped && (
        <button
          onClick={onAddToList}
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-gray-100 ${colors.text} hover:shadow-sm active:scale-95 transition-all`}
          title="Add to today's list"
        >
          + List
        </button>
      )}

      {/* Skip toggle */}
      <button
        onClick={onSkip}
        title={isSkipped ? 'Restore item' : 'Not needed this week'}
        className={`shrink-0 p-1 rounded-lg transition-colors active:scale-95 ${
          isSkipped
            ? 'text-amber-400 hover:text-amber-500 bg-amber-50'
            : 'text-gray-300 hover:text-amber-400'
        }`}
      >
        {isSkipped ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>

      {/* Remove */}
      <button
        onClick={onRemove}
        title="Remove from list"
        className="shrink-0 p-1 rounded-lg text-gray-200 hover:text-red-400 hover:bg-red-50 transition-colors active:scale-95"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Weekly tab ───────────────────────────────────────────────────────────────

function WeeklyTab({
  weeklyList,
  weeklyLoading,
  weeklyBudget,
  estimatedTotal,
  onToggleWeekly,
  onSkipWeekly,
  onRemoveWeekly,
  onAddWeekly,
  onRegenerateWeekly,
  onAddToMainList,
  onUpdateItemPrice,
  onSetWeeklyBudget,
  meals,
  mealsLoading,
  onAddMeal,
  onDeleteMeal,
  onPlanMeals,
  spendingSnapshots,
  spendingInsights,
  onOpenReceiptScanner,
}: {
  weeklyList: WeeklyGroceryList | null;
  weeklyLoading: boolean;
  weeklyBudget: number;
  estimatedTotal: number;
  onToggleWeekly: (name: string, checked: boolean) => Promise<void>;
  onSkipWeekly: (name: string) => Promise<void>;
  onRemoveWeekly: (name: string) => Promise<void>;
  onAddWeekly: (name: string, category: GroceryCategory, source: WeeklyGrocerySource) => Promise<void>;
  onRegenerateWeekly: () => Promise<void>;
  onAddToMainList: (name: string, category: GroceryCategory) => Promise<void>;
  onUpdateItemPrice: (name: string, price: number) => Promise<void>;
  onSetWeeklyBudget: (amount: number) => Promise<void>;
  meals: Meal[];
  mealsLoading: boolean;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onDeleteMeal: (id: string) => void;
  onPlanMeals: (mealIds: string[], ingredients: MealIngredient[]) => Promise<void>;
  spendingSnapshots: SpendingSnapshot[];
  spendingInsights: string[];
  onOpenReceiptScanner: () => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState<GroceryCategory>('Produce');
  const [addingItem, setAddingItem] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMealPlanner, setShowMealPlanner] = useState(false);

  async function handleAddItem() {
    if (!newItem.trim()) return;
    setAddingItem(true);
    await onAddWeekly(newItem.trim(), newCategory, 'manual');
    setNewItem('');
    setAddingItem(false);
    setShowAddForm(false);
  }

  const weekStart = getWeekStart();
  const weekEnd = (() => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();
  const weekStartLabel = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  async function handleRegenerate() {
    setRegenerating(true);
    await onRegenerateWeekly();
    setRegenerating(false);
  }

  if (weeklyLoading) {
    return (
      <div className="space-y-3">
        {[90, 75, 110, 65, 80, 95].map((w) => (
          <div key={w} className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl shadow-sm border border-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-gray-100 animate-pulse" />
              <div className="h-3.5 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
            </div>
            <div className="h-6 w-14 rounded-full bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!weeklyList || weeklyList.items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Calendar size={24} className="text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-400">No weekly list yet</p>
            <p className="text-xs text-gray-300 mt-0.5">Add routines and habits to auto-generate one</p>
          </div>
        </div>
        {/* Add form even when empty */}
        <AddWeeklyItemForm
          newItem={newItem}
          newCategory={newCategory}
          adding={addingItem}
          onChangeItem={setNewItem}
          onChangeCategory={setNewCategory}
          onAdd={handleAddItem}
        />
        <button
          onClick={() => setShowMealPlanner(true)}
          className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 font-semibold text-sm py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
        >
          <UtensilsCrossed size={15} />
          Plan Meals → Auto Grocery List
        </button>
        {showMealPlanner && (
          <MealPlannerSheet
            meals={meals}
            loadingMeals={mealsLoading}
            onAddMeal={onAddMeal}
            onDeleteMeal={onDeleteMeal}
            onPlanMeals={onPlanMeals}
            onClose={() => setShowMealPlanner(false)}
          />
        )}
      </div>
    );
  }

  const totalItems = weeklyList.items.length;
  const checkedCount = weeklyList.items.filter((i) => i.checked).length;

  const grouped: Record<string, WeeklyGroceryItem[]> = {};
  for (const item of weeklyList.items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return (
    <div className="space-y-4">
      {/* LifeBestie intro message */}
      {weeklyList.weekly_message && (
        <div className="flex items-start gap-3 bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-100 rounded-2xl px-4 py-3.5">
          <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles size={13} className="text-amber-500" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{weeklyList.weekly_message}</p>
        </div>
      )}

      {/* Week header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500">
            {weekStartLabel} – {weekEnd}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {checkedCount} of {totalItems} items ready
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors active:scale-95 ${
              showAddForm
                ? 'bg-amber-400 text-white'
                : 'text-gray-400 bg-white border border-gray-100 hover:text-gray-600'
            }`}
          >
            <Plus size={11} />
            Add
          </button>
          <button
            onClick={() => setShowMealPlanner(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 hover:bg-emerald-100 transition-colors active:scale-95"
          >
            <UtensilsCrossed size={11} />
            Meals
          </button>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1.5 hover:text-gray-600 transition-colors active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Refreshing…' : 'Refresh My List'}
          </button>
        </div>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <AddWeeklyItemForm
          newItem={newItem}
          newCategory={newCategory}
          adding={addingItem}
          onChangeItem={setNewItem}
          onChangeCategory={setNewCategory}
          onAdd={handleAddItem}
        />
      )}

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-300 to-rose-300 rounded-full transition-all duration-500"
          style={{ width: `${totalItems > 0 ? (checkedCount / totalItems) * 100 : 0}%` }}
        />
      </div>

      {/* Budget bar + Scan Receipt */}
      <BudgetBar
        weeklyBudget={weeklyBudget}
        estimatedTotal={estimatedTotal}
        items={weeklyList?.items ?? []}
        onSetBudget={onSetWeeklyBudget}
        onScanReceipt={onOpenReceiptScanner}
      />

      {/* Spending trends */}
      <SpendingTrends
        snapshots={spendingSnapshots}
        insights={spendingInsights}
        weeklyBudget={weeklyBudget}
      />

      {/* Items by category */}
      {Object.keys(grouped).map((cat) => {
          const group = grouped[cat];
          const colors = getCategoryColors(cat);
          return (
            <div key={cat} className={`${colors.bg} rounded-2xl px-4 py-3`}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {cat}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.map((item) => (
                  <WeeklyItemRow
                    key={item.name}
                    item={item}
                    colors={colors}
                    onToggle={() => onToggleWeekly(item.name, !item.checked)}
                    onAddToList={() => onAddToMainList(item.name, item.category)}
                    onSkip={() => onSkipWeekly(item.name)}
                    onRemove={() => onRemoveWeekly(item.name)}
                    onUpdatePrice={(price) => onUpdateItemPrice(item.name, price)}
                  />
                ))}
              </div>
            </div>
          );
        })}

      {/* Plan Meals → Auto Grocery List button (bottom of list) */}
      <button
        onClick={() => setShowMealPlanner(true)}
        className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 font-semibold text-sm py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
      >
        <UtensilsCrossed size={15} />
        Plan Meals → Auto Grocery List
      </button>

      {showMealPlanner && (
        <MealPlannerSheet
          meals={meals}
          loadingMeals={mealsLoading}
          onAddMeal={onAddMeal}
          onDeleteMeal={onDeleteMeal}
          onPlanMeals={onPlanMeals}
          onClose={() => setShowMealPlanner(false)}
        />
      )}
    </div>
  );
}

// ─── Meal Planner Modal ───────────────────────────────────────────────────────

const INGREDIENT_CATEGORY_DEFAULTS: Record<string, GroceryCategory> = {
  milk: 'Dairy', cheese: 'Dairy', eggs: 'Dairy', butter: 'Dairy', yogurt: 'Dairy',
  bread: 'Pantry', pasta: 'Pantry', rice: 'Pantry', flour: 'Pantry', sugar: 'Pantry', oil: 'Pantry',
  chicken: 'Meat', beef: 'Meat', pork: 'Meat', turkey: 'Meat', bacon: 'Meat',
  salmon: 'Seafood', shrimp: 'Seafood', tuna: 'Seafood',
  apple: 'Produce', banana: 'Produce', tomato: 'Produce', lettuce: 'Produce',
  spinach: 'Produce', broccoli: 'Produce', onion: 'Produce', garlic: 'Produce',
  chips: 'Snacks', crackers: 'Snacks', granola: 'Snacks',
  juice: 'Beverages', coffee: 'Beverages', tea: 'Beverages', water: 'Beverages',
};

function guessCategory(name: string): GroceryCategory {
  const lower = name.toLowerCase();
  for (const [keyword, cat] of Object.entries(INGREDIENT_CATEGORY_DEFAULTS)) {
    if (lower.includes(keyword)) return cat;
  }
  return 'Pantry';
}

function parseIngredients(raw: string): MealIngredient[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, category: guessCategory(name) }));
}

const MEAL_TYPE_COLORS: Record<MealType, { bg: string; text: string; dot: string }> = {
  Breakfast: { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400'   },
  Lunch:     { bg: 'bg-sky-50',     text: 'text-sky-600',     dot: 'bg-sky-400'     },
  Dinner:    { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  Snack:     { bg: 'bg-rose-50',    text: 'text-rose-600',    dot: 'bg-rose-400'    },
};

function MealPlannerModal({
  onAddMealFull,
  onAddWeekly,
  onClose,
}: {
  onAddMealFull: (opts: { name: string; meal_type: MealType; meal_date: string; ingredients: MealIngredient[] }) => Promise<Meal | null>;
  onAddWeekly: (name: string, category: GroceryCategory, source: WeeklyGrocerySource) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealType>('Dinner');
  const [mealDate, setMealDate] = useState(today);
  const [ingredientsRaw, setIngredientsRaw] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Please enter a meal name.'); return; }
    setError('');
    setSaving(true);
    const ingredients = parseIngredients(ingredientsRaw);
    const meal = await onAddMealFull({ name: name.trim(), meal_type: mealType, meal_date: mealDate, ingredients });
    if (meal && ingredients.length > 0) {
      for (const ing of ingredients) {
        await onAddWeekly(ing.name, ing.category, 'meal');
      }
    }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl px-5 pt-5 pb-8 space-y-5 animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-800">Plan a Meal</h2>
              <p className="text-xs text-gray-400">Ingredients go straight to your grocery list</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition-colors">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check size={22} className="text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700">Meal saved!</p>
            <p className="text-xs text-gray-400">Ingredients added to your grocery list</p>
          </div>
        ) : (
          <>
            {/* Meal name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meal Name</label>
              <input
                type="text"
                placeholder="e.g. Pasta Bolognese"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                autoFocus
              />
              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>

            {/* Meal type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meal Type</label>
              <div className="flex gap-2 flex-wrap">
                {MEAL_TYPES.map((type) => {
                  const colors = MEAL_TYPE_COLORS[type];
                  const active = mealType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setMealType(type)}
                      className={`text-xs font-semibold px-3.5 py-2 rounded-full transition-all ${
                        active
                          ? `${colors.bg} ${colors.text} ring-1 ring-current`
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
              <input
                type="date"
                value={mealDate}
                onChange={(e) => setMealDate(e.target.value)}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
              />
            </div>

            {/* Ingredients */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Ingredients
                <span className="ml-1 font-normal text-gray-300 normal-case">(one per line or comma-separated)</span>
              </label>
              <textarea
                rows={4}
                placeholder={"Pasta\nGround beef\nTomato sauce\nOnion, Garlic"}
                value={ingredientsRaw}
                onChange={(e) => setIngredientsRaw(e.target.value)}
                className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 outline-none focus:ring-2 focus:ring-emerald-300 transition-all resize-none"
              />
              {ingredientsRaw.trim() && (
                <p className="text-xs text-gray-400">
                  {parseIngredients(ingredientsRaw).length} ingredient{parseIngredients(ingredientsRaw).length !== 1 ? 's' : ''} will be added to your grocery list
                </p>
              )}
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 text-white font-semibold text-sm shadow-sm shadow-emerald-200 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={15} />
                  Save Meal & Add to Grocery List
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Weekly Meal Overview ─────────────────────────────────────────────────────

const MEAL_TYPE_CHIP: Record<MealType, { bg: string; text: string }> = {
  Breakfast: { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  Lunch:     { bg: 'bg-sky-100',     text: 'text-sky-700'     },
  Dinner:    { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Snack:     { bg: 'bg-rose-100',    text: 'text-rose-600'    },
};

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function WeeklyMealOverview({
  meals,
  onOpenMealPlanner,
  onPlanMeals,
}: {
  meals: Meal[];
  onOpenMealPlanner: () => void;
  onPlanMeals: (mealIds: string[], ingredients: MealIngredient[]) => Promise<void>;
}) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const weekStart = getWeekStart();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const mealsByDate = new Map<string, Meal[]>();
  for (const meal of meals) {
    if (!meal.meal_date) continue;
    const existing = mealsByDate.get(meal.meal_date) ?? [];
    mealsByDate.set(meal.meal_date, [...existing, meal]);
  }

  const weekMeals = weekDates.flatMap((d) => mealsByDate.get(d) ?? []);
  const hasAnyMeals = weekMeals.length > 0;

  async function handleGenerate() {
    if (generating || !hasAnyMeals) return;
    setGenerating(true);
    const seen = new Map<string, MealIngredient>();
    for (const meal of weekMeals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        if (!seen.has(key)) seen.set(key, ing);
      }
    }
    const ingredients = Array.from(seen.values());
    await onPlanMeals(weekMeals.map((m) => m.id), ingredients);
    setGenerating(false);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  }

  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div>
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <UtensilsCrossed size={14} className="text-emerald-500 shrink-0" />
            This Week's Meals
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Planned meals for the week</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !hasAnyMeals}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all active:scale-95 disabled:opacity-40 ${
            generated
              ? 'bg-emerald-100 text-emerald-600'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {generating ? (
            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : generated ? (
            <><Check size={11} /> Added!</>
          ) : (
            <>Generate Grocery List</>
          )}
        </button>
      </div>

      {/* Day rows */}
      <div className="divide-y divide-gray-50">
        {weekDates.map((dateStr, i) => {
          const dayMeals = mealsByDate.get(dateStr) ?? [];
          const today = new Date().toISOString().split('T')[0];
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              className={`flex items-start gap-3 px-4 py-2.5 ${isToday ? 'bg-emerald-50/50' : ''}`}
            >
              {/* Day label */}
              <div className="w-8 shrink-0 pt-0.5">
                <p className={`text-xs font-bold ${isToday ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {SHORT_DAYS[i]}
                </p>
                {isToday && (
                  <div className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5" />
                )}
              </div>

              {/* Meals or empty state */}
              <div className="flex-1 min-w-0">
                {dayMeals.length === 0 ? (
                  <button
                    onClick={onOpenMealPlanner}
                    className="flex items-center gap-1 text-xs text-gray-300 hover:text-emerald-500 transition-colors py-0.5"
                  >
                    <Plus size={11} />
                    Plan meal
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    {dayMeals.map((meal) => (
                      <div key={meal.id} className="flex items-center gap-1.5 flex-wrap">
                        {meal.meal_type && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${MEAL_TYPE_CHIP[meal.meal_type].bg} ${MEAL_TYPE_CHIP[meal.meal_type].text}`}>
                            {meal.meal_type}
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">
                          {meal.name}
                        </span>
                        {meal.ingredients.length > 0 && (
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {meal.ingredients.length} ingredient{meal.ingredients.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state footer */}
      {!hasAnyMeals && (
        <div className="px-4 py-3 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400">
            No meals planned yet. Add one to build your grocery list.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PageTab = 'today' | 'weekly';

export default function GroceryPage({
  items,
  habits,
  routines,
  recentHistory,
  weeklyList,
  weeklyLoading,
  meals,
  mealsLoading,
  weeklyBudget,
  estimatedTotal,
  onToggle,
  onAdd,
  onDelete,
  onToggleWeekly,
  onAddWeekly,
  onSkipWeekly,
  onRemoveWeekly,
  onRegenerateWeekly,
  onUpdateWeeklyItemPrice,
  onSetWeeklyBudget,
  onAddMeal,
  onAddMealFull,
  onDeleteMeal,
  onPlanMeals,
  spendingSnapshots,
  spendingInsights,
  onScanReceipt,
  onSaveReceipt,
  receiptScanning,
  receiptScanError,
}: GroceryPageProps) {
  const [pageTab, setPageTab] = useState<PageTab>('today');
  const [showMealModal, setShowMealModal] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [shoppingMode, setShoppingMode] = useState<'today' | 'weekly' | null>(null);
  const [newItem, setNewItem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GroceryCategory>('Produce');
  const [saving, setSaving] = useState(false);

  const [aiResult, setAiResult] = useState<AISuggestionsResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const lastFetchSnapshotRef = useRef<string>('');

  useEffect(() => {
const snapshot = (items ?? [])
  .map((i) => i.name.toLowerCase())
  .sort()
  .join(',');
    if (snapshot === lastFetchSnapshotRef.current) return;
    lastFetchSnapshotRef.current = snapshot;
    setDismissed(new Set());
    setAiLoading(true);
    fetchAISuggestions(habits, routines, recentHistory, items).then((result) => {
      setAiResult(result);
      setAiLoading(false);
    });
  }, [items, habits, routines, recentHistory]);

  async function handleAdd() {
    if (!newItem.trim()) return;
    setSaving(true);
    await onAdd(newItem.trim(), selectedCategory);
    setNewItem('');
    setSaving(false);
  }

  async function handleAddSuggestion(name: string, category: GroceryCategory) {
    setDismissed((prev) => new Set([...prev, name.toLowerCase()]));
    await onAdd(name, category);
  }

  const grouped: Record<string, GroceryItem[]> = {};
  (items ?? []).forEach((item) => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

const totalUnchecked = (items ?? []).filter((i) => !i.checked).length;

const existingNames = new Set(
  (items ?? []).map((i) => i.name.toLowerCase())
);

  const aiItems = (aiResult?.items ?? []).filter(
    (s) => !existingNames.has(s.name.toLowerCase()) && !dismissed.has(s.name.toLowerCase())
  );

  const aiGrouped: Record<string, AISuggestion[]> = {};
  for (const s of (aiItems ?? [])) {
    if (!aiGrouped[s.category]) aiGrouped[s.category] = [];
    aiGrouped[s.category].push(s);
  }

  const hasContext = habits.length > 0 || routines.length > 0;
  const fallbackItems = FALLBACK_SUGGESTIONS.filter(
    (s) => !existingNames.has(s.name.toLowerCase()) && !dismissed.has(s.name.toLowerCase())
  );
  const showFallback = !aiLoading && aiItems.length === 0 && !hasContext;
  const showSuggestions = aiLoading || aiItems.length > 0 || showFallback;

  // Weekly list stats for tab badge
  const weeklyUnchecked = (weeklyList?.items ?? []).filter((i) => !i.checked).length;

  const lowStockSuggestions = getLowStockSuggestions(habits, 3);

  return (
    <div className="px-4 pt-6 pb-28 space-y-5 max-w-md mx-auto">
      {/* Shopping mode overlays */}
      {shoppingMode === 'today' && (
        <ShoppingMode
          items={items.map((i) => ({ id: i.id, name: i.name, category: i.category, checked: i.checked }))}
          onToggle={(id, checked) => onToggle(id, checked)}
          onClose={() => setShoppingMode(null)}
        />
      )}
      {shoppingMode === 'weekly' && weeklyList && (
        <ShoppingMode
          items={(weeklyList.items).map((i) => ({ id: i.name, name: i.name, category: i.category, checked: i.checked }))}
          onToggle={(id, checked) => onToggleWeekly(id, checked)}
          onClose={() => setShoppingMode(null)}
        />
      )}

      {/* Meal Planner Modal */}
      {showMealModal && (
        <MealPlannerModal
          onAddMealFull={onAddMealFull}
          onAddWeekly={onAddWeekly}
          onClose={() => setShowMealModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Grocery List</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {pageTab === 'today'
              ? `${totalUnchecked} item${totalUnchecked !== 1 ? 's' : ''} to get`
              : `${weeklyUnchecked} item${weeklyUnchecked !== 1 ? 's' : ''} remaining this week`}
          </p>
        </div>
       {pageTab === 'today' && (aiItems ?? []).length > 0 && (
          <button
            onClick={() => setShoppingMode('today')}
            className="flex items-center gap-1.5 bg-rose-400 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <Play size={11} fill="white" />
            Start Shopping
          </button>
        )}
        {pageTab === 'weekly' && (weeklyList?.items.length ?? 0) > 0 && (
          <button
            onClick={() => setShoppingMode('weekly')}
            className="flex items-center gap-1.5 bg-amber-400 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
          >
            <Play size={11} fill="white" />
            Start Shopping
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
        {([['today', 'Today'], ['weekly', 'This Week']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setPageTab(tab)}
            className={`flex-1 text-sm font-semibold py-2 rounded-xl transition-all ${
              pageTab === tab
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
            {tab === 'weekly' && weeklyUnchecked > 0 && (
              <span className="ml-1.5 text-xs font-bold bg-rose-100 text-rose-500 rounded-full px-1.5 py-0.5">
                {weeklyUnchecked}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Meal Planner entry card */}
      <button
        onClick={() => setShowMealModal(true)}
        className="w-full flex items-center gap-3.5 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-emerald-100 active:scale-[0.98] transition-all text-left"
      >
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
          <UtensilsCrossed size={20} className="text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Meal Planner</p>
          <p className="text-xs text-gray-400 leading-snug mt-0.5">
            Plan breakfast, lunch & dinner — ingredients go straight to your list
          </p>
        </div>
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      </button>

      {/* Weekly Meal Overview */}
      <WeeklyMealOverview
        meals={meals}
        onOpenMealPlanner={() => setShowMealModal(true)}
        onPlanMeals={onPlanMeals}
      />

      {/* Low stock strip — only on Today tab */}
      {pageTab === 'today' && lowStockSuggestions.length > 0 && (
        <LowStockBanner
          suggestions={lowStockSuggestions}
          onAddToList={onAdd}
          compact
        />
      )}

      {pageTab === 'weekly' ? (
        <>
          <WeeklyTab
            weeklyList={weeklyList}
            weeklyLoading={weeklyLoading}
            weeklyBudget={weeklyBudget}
            estimatedTotal={estimatedTotal}
            onToggleWeekly={onToggleWeekly}
            onSkipWeekly={onSkipWeekly}
            onRemoveWeekly={onRemoveWeekly}
            onAddWeekly={onAddWeekly}
            onRegenerateWeekly={onRegenerateWeekly}
            onAddToMainList={onAdd}
            onUpdateItemPrice={onUpdateWeeklyItemPrice}
            onSetWeeklyBudget={onSetWeeklyBudget}
            meals={meals}
            mealsLoading={mealsLoading}
            onAddMeal={onAddMeal}
            onDeleteMeal={onDeleteMeal}
            onPlanMeals={onPlanMeals}
            spendingSnapshots={spendingSnapshots}
            spendingInsights={spendingInsights}
            onOpenReceiptScanner={() => setShowReceiptScanner(true)}
          />

          {showReceiptScanner && (
            <ReceiptScanner
              onClose={() => setShowReceiptScanner(false)}
              onScan={onScanReceipt}
              onSave={async (result, items) => {
                await onSaveReceipt(result, items);
              }}
              scanning={receiptScanning}
              scanError={receiptScanError}
            />
          )}
        </>
      ) : (
        <>
          {/* Add Item */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add an item…"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-rose-200 transition-colors"
              />
              <button
                onClick={handleAdd}
                disabled={!newItem.trim() || saving}
                className="w-10 h-10 rounded-xl bg-rose-400 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
              >
                <Plus size={18} className="text-white" />
              </button>
            </div>
            <CategoryPicker selected={selectedCategory} accentClass="border-rose-200" onChange={setSelectedCategory} />
          </div>

          {/* AI Suggestions */}
          {showSuggestions && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-amber-400" />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Suggested Items
                </h2>
              </div>

              {aiLoading ? (
                <div className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-gray-400">LifeBestie is thinking…</span>
                  </div>
                  <div className="space-y-2">
                    {[85, 70, 95, 60, 80].map((w) => (
                      <div key={w} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/60">
                        <div className="h-3.5 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
                        <div className="h-7 w-16 rounded-full bg-gray-100 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : showFallback ? (
                <div className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl p-4 border border-amber-100 space-y-2">
                  <p className="text-xs text-gray-400">
                    Add items a few times and suggestions will personalise for you.
                  </p>
                  {fallbackItems.map((s) => (
                    <SuggestionRow
                      key={s.name}
                      name={s.name}
                      category={s.category}
                      onAdd={() => handleAddSuggestion(s.name, s.category)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {aiResult?.message && (
                    <div className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl px-4 py-3 border border-amber-100">
                      <p className="text-sm text-gray-600 leading-relaxed">{aiResult.message}</p>
                    </div>
                  )}
                  {Object.keys(aiGrouped).map((cat) => {
                      const group = aiGrouped[cat];
                      const colors = getCategoryColors(cat);
                      return (
                        <div key={cat} className={`${colors.bg} rounded-2xl px-4 py-3`}>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                              {cat}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {group.map((s) => (
                              <SuggestionRow
                                key={s.name}
                                name={s.name}
                                category={s.category}
                                onAdd={() => handleAddSuggestion(s.name, s.category)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {/* Current list grouped by category */}
          {Object.keys(grouped).map((cat) => {
            const catItems = grouped[cat];
            if (catItems.length === 0) return null;
            const colors = getCategoryColors(cat);
            return (
              <section key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{cat}</h2>
                  <span className="text-xs text-gray-300 ml-auto">
                    {catItems.filter((i) => !i.checked).length} left
                  </span>
                </div>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50"
                    >
                      <button
                        onClick={() => onToggle(item.id, !item.checked)}
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                          item.checked ? `${colors.dot} border-transparent` : 'border-gray-200 bg-white'
                        }`}
                      >
                        {item.checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          item.checked ? 'line-through text-gray-300' : 'text-gray-700'
                        }`}
                      >
                        {item.name}
                      </span>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="text-gray-200 hover:text-gray-300 text-lg leading-none px-1 active:scale-95 transition-transform"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Empty state */}
          {(items ?? []).length === 0 && !showSuggestions && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                <ShoppingCart size={24} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">Your list is empty</p>
                <p className="text-xs text-gray-300 mt-0.5">Add items above to get started</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
