import { useState, useEffect } from 'react';
import { X, ShoppingCart, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { getCategoryColors, getCategoryEmoji } from '../lib/supabase';

export interface ShoppingItem {
  id: string;       // unique key — for today items use item.id, for weekly use item.name
  name: string;
  category: string;
  checked: boolean;
}

interface Props {
  items: ShoppingItem[];
  onToggle: (id: string, checked: boolean) => void;
  onClose: () => void;
}

function CheckCircle({ checked, category }: { checked: boolean; category: string }) {
  const cfg = getCategoryColors(category);
  return (
    <div
      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
        checked
          ? `${cfg.check} border-transparent scale-95`
          : `border-gray-200 bg-white`
      }`}
    >
      {checked && (
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
          <path d="M1.5 5L5 8.5L11.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function ProgressRing({ checked, total }: { checked: number; total: number }) {
  const pct = total === 0 ? 0 : checked / total;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={pct === 1 ? '#10b981' : '#fb923c'}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-gray-700">{checked}/{total}</span>
    </div>
  );
}

export default function ShoppingMode({ items, onToggle, onClose }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  const total = items.length;
  const checkedCount = items.filter((i) => i.checked).length;
  const pct = total === 0 ? 0 : Math.round((checkedCount / total) * 100);

  useEffect(() => {
    if (total > 0 && checkedCount === total) {
      const t = setTimeout(() => setDone(true), 400);
      return () => clearTimeout(t);
    }
    setDone(false);
  }, [checkedCount, total]);

  const grouped: Record<string, ShoppingItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  function toggleCollapse(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 animate-slide-up">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-4 shrink-0">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <ShoppingCart size={18} className="text-rose-400" />
              <h2 className="text-lg font-bold text-gray-800">Shopping Mode</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 active:scale-95 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress bar + fraction */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-rose-300 to-amber-300'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-sm font-bold tabular-nums shrink-0 transition-colors ${pct === 100 ? 'text-emerald-500' : 'text-gray-500'}`}>
              {checkedCount}/{total}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
          {done ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
              <CheckCircle2 size={56} className="text-emerald-400" />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-800">All done!</p>
                <p className="text-sm text-gray-400 mt-1">You got everything on the list.</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 bg-emerald-400 text-white font-semibold text-sm px-6 py-3 rounded-2xl active:scale-95 transition-transform"
              >
                Finish Shopping
              </button>
            </div>
          ) : (
            Object.keys(grouped)
              .map((cat) => {
                const group = grouped[cat];
                const cfg = getCategoryColors(cat);
                const catChecked = group.filter((i) => i.checked).length;
                const isCollapsed = collapsed.has(cat);
                const allDone = catChecked === group.length;

                return (
                  <div key={cat} className={`rounded-2xl overflow-hidden border ${allDone ? 'border-gray-100 opacity-60' : 'border-transparent'}`}>
                    {/* Category header */}
                    <button
                      onClick={() => toggleCollapse(cat)}
                      className={`w-full flex items-center justify-between px-4 py-3 ${cfg.header} transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{getCategoryEmoji(cat)}</span>
                        <span className="text-sm font-bold text-gray-700">{cat}</span>
                        <span className="text-xs text-gray-400 font-medium">
                          {catChecked}/{group.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {allDone && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            Done
                          </span>
                        )}
                        {isCollapsed
                          ? <ChevronDown size={14} className="text-gray-400" />
                          : <ChevronUp size={14} className="text-gray-400" />
                        }
                      </div>
                    </button>

                    {/* Items */}
                    {!isCollapsed && (
                      <div className={`${cfg.bg} divide-y divide-white/60`}>
                        {group.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => onToggle(item.id, !item.checked)}
                            className={`w-full flex items-center gap-4 px-4 py-4 text-left active:scale-[0.99] transition-all duration-150 ${
                              item.checked ? 'opacity-50' : ''
                            }`}
                          >
                            <CheckCircle category={cat} checked={item.checked} />
                            <span
                              className={`flex-1 text-base font-medium leading-tight transition-all ${
                                item.checked ? 'line-through text-gray-300' : 'text-gray-700'
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.checked && (
                              <span className="text-emerald-400 shrink-0">
                                <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                                  <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Floating bottom summary */}
      {!done && total > 0 && (
        <div className="fixed bottom-0 left-0 right-0 pointer-events-none">
          <div className="max-w-md mx-auto px-4 pb-6">
            <div className="pointer-events-auto bg-white rounded-2xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
              <ProgressRing checked={checkedCount} total={total} />
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">
                  {checkedCount === 0
                    ? 'Ready to shop!'
                    : checkedCount === total - 1
                    ? 'Almost there!'
                    : `${total - checkedCount} item${total - checkedCount !== 1 ? 's' : ''} remaining`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{pct}% complete</p>
              </div>
              <button
                onClick={onClose}
                className="text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-2 rounded-xl active:scale-95 transition-transform"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
