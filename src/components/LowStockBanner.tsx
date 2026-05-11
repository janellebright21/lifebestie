import { useState } from 'react';
import { ShoppingCart, X, Check } from 'lucide-react';
import { LowStockSuggestion, getCategoryEmoji } from '../lib/supabase';

// Per-item emoji overrides for common staples
const NAME_EMOJI: Record<string, string> = {
  milk:           '🥛',
  eggs:           '🥚',
  bread:          '🍞',
  butter:         '🧈',
  cheese:         '🧀',
  apples:         '🍎',
  bananas:        '🍌',
  berries:        '🫐',
  coffee:         '☕',
  juice:          '🧃',
  yogurt:         '🫙',
  chicken:        '🍗',
  pasta:          '🍝',
  rice:           '🍚',
  tomatoes:       '🍅',
  carrots:        '🥕',
  spinach:        '🥬',
  broccoli:       '🥦',
  lettuce:        '🥗',
  onions:         '🧅',
  garlic:         '🧄',
  chips:          '🥔',
  crackers:       '🍘',
  granola:        '🌾',
  oats:           '🌾',
  hummus:         '🫙',
  salsa:          '🌶️',
};

function getEmoji(habit: LowStockSuggestion['habit']): string {
  const nameLower = habit.name.toLowerCase();
  for (const [key, emoji] of Object.entries(NAME_EMOJI)) {
    if (nameLower.includes(key)) return emoji;
  }
  return getCategoryEmoji(habit.category);
}

interface Props {
  suggestions: LowStockSuggestion[];
  onAddToList: (name: string, category: string) => Promise<void>;
  compact?: boolean; // true → inline strip style (Grocery page), false → card style (Home page)
}

export default function LowStockBanner({ suggestions, onAddToList, compact = false }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  if (dismissed || suggestions.length === 0) return null;

  async function handleAdd(name: string, category: string) {
    if (added.has(name) || adding) return;
    setAdding(name);
    await onAddToList(name, category);
    setAdded((prev) => new Set(prev).add(name));
    setAdding(null);
  }

  if (compact) {
    // ── Grocery page: compact horizontal strip ────────────────────────────────
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <ShoppingCart size={12} className="text-amber-500" />
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Running low
            </span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-300 hover:text-amber-500 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {suggestions.map(({ habit }) => {
            const isDone = added.has(habit.name);
            const isAdding = adding === habit.name;
            return (
              <button
                key={habit.name}
                onClick={() => handleAdd(habit.name, habit.category)}
                disabled={isDone || !!adding}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span>{getEmoji(habit)}</span>
                {isAdding ? (
                  <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                ) : isDone ? (
                  <Check size={11} />
                ) : null}
                {habit.name}
                {!isDone && !isAdding && (
                  <span className="text-amber-400 ml-0.5">+</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Home page: card style ─────────────────────────────────────────────────
  return (
    <div className="bg-white border border-amber-100 rounded-2xl px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ShoppingCart size={14} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Might be running low
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Based on your shopping patterns</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-400 transition-colors shrink-0 mt-0.5"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map(({ habit, daysSinceAdded }) => {
          const isDone = added.has(habit.name);
          const isAdding = adding === habit.name;
          return (
            <div
              key={habit.name}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                isDone ? 'bg-emerald-50' : 'bg-gray-50'
              }`}
            >
              <span className="text-lg leading-none shrink-0">{getEmoji(habit)}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDone ? 'text-emerald-600' : 'text-gray-700'}`}>
                  {isDone ? `Added ${habit.name}!` : `You might be running low on ${habit.name}`}
                </p>
                {!isDone && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last bought {daysSinceAdded === 1 ? 'yesterday' : `${daysSinceAdded} days ago`}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleAdd(habit.name, habit.category)}
                disabled={isDone || !!adding}
                className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${
                  isDone
                    ? 'text-emerald-500 bg-emerald-100'
                    : 'text-amber-600 bg-amber-100 hover:bg-amber-200 disabled:opacity-50'
                }`}
              >
                {isAdding ? (
                  <span className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                ) : isDone ? (
                  <Check size={12} />
                ) : (
                  <ShoppingCart size={12} />
                )}
                {isDone ? 'Added' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
