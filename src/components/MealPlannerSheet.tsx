import { useState } from 'react';
import { Plus, Trash2, ChevronRight, Sparkles, UtensilsCrossed, Check } from 'lucide-react';
import { Meal, MealIngredient, getCategoryColors } from '../lib/supabase';

interface Props {
  meals: Meal[];
  loadingMeals: boolean;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onDeleteMeal: (id: string) => void;
  onPlanMeals: (mealIds: string[], ingredients: MealIngredient[]) => Promise<void>;
  onClose: () => void;
}

type View = 'list' | 'select' | 'preview';

/** Parse a quantity string like "2", "1/2", "1.5" into a float. Returns null if unparseable. */
function parseQty(q?: string): number | null {
  if (!q) return null;
  const trimmed = q.trim();
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/** Format a float quantity back to a clean string (e.g. 2.5 → "2.5", 0.5 → "1/2"). */
function formatQty(n: number): string {
  if (n === 0.25) return '1/4';
  if (n === 0.5)  return '1/2';
  if (n === 0.75) return '3/4';
  if (n === 1/3)  return '1/3';
  if (n === 2/3)  return '2/3';
  // round to 2 decimal places and strip trailing zeros
  return parseFloat(n.toFixed(2)).toString();
}

/** Merge a new ingredient into the consolidated map. */
function mergeIngredient(
  map: Map<string, MealIngredient>,
  ing: MealIngredient,
  mealName: string
) {
  // Key by name+unit so "1 cup cheese" and "1 oz cheese" stay as separate rows
  const normName = ing.name.toLowerCase().trim().replace(/\s+/g, ' ');
  const normUnit = (ing.unit ?? '').toLowerCase().trim();
  const key = `${normName}|${normUnit}`;

  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...ing, mealSources: [mealName] });
    return;
  }

  // Append source if not already listed
  if (!existing.mealSources) {
    existing.mealSources = [mealName];
  } else if (!existing.mealSources.includes(mealName)) {
    existing.mealSources.push(mealName);
  }

  // Sum quantities (units already match since they share the same key)
  const existingQty = parseQty(existing.quantity);
  const incomingQty = parseQty(ing.quantity);
  if (existingQty !== null && incomingQty !== null) {
    existing.quantity = formatQty(existingQty + incomingQty);
  } else if (incomingQty !== null && existingQty === null && !existing.quantity) {
    existing.quantity = ing.quantity;
    existing.unit = ing.unit;
  }
}

export default function MealPlannerSheet({
  meals,
  loadingMeals,
  onAddMeal,
  onDeleteMeal,
  onPlanMeals,
  onClose,
}: Props) {
  const [view, setView] = useState<View>('list');
  const [newMealName, setNewMealName] = useState('');
  const [addingMeal, setAddingMeal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewIngredients, setPreviewIngredients] = useState<MealIngredient[]>([]);
  const [planning, setPlanning] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAddMeal() {
    if (!newMealName.trim() || addingMeal) return;
    setAddingMeal(true);
    await onAddMeal(newMealName.trim());
    setNewMealName('');
    setAddingMeal(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function buildPreview() {
    const consolidated = new Map<string, MealIngredient>();
    for (const meal of meals) {
      if (!selectedIds.has(meal.id)) continue;
      for (const ing of meal.ingredients) {
        mergeIngredient(consolidated, ing, meal.name);
      }
    }
    setPreviewIngredients(Array.from(consolidated.values()));
    setView('preview');
  }

  async function handleConfirm() {
    setPlanning(true);
    await onPlanMeals(Array.from(selectedIds), previewIngredients);
    setPlanning(false);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  // Group preview ingredients by category
  const grouped: Record<string, MealIngredient[]> = {};
  for (const ing of previewIngredients) {
    if (!grouped[ing.category]) grouped[ing.category] = [];
    grouped[ing.category]!.push(ing);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div className="px-5 pb-8 pt-2 max-h-[82dvh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              {view !== 'list' && (
                <button
                  onClick={() => setView(view === 'preview' ? 'select' : 'list')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ←
                </button>
              )}
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {view === 'list' && 'My Meals'}
                  {view === 'select' && 'Plan This Week'}
                  {view === 'preview' && 'Grocery Preview'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {view === 'list' && 'Save meals and plan your week'}
                  {view === 'select' && 'Choose meals for this week'}
                  {view === 'preview' && `${previewIngredients.length} items to add to your list`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-sm leading-none"
            >
              ×
            </button>
          </div>

          {/* ── List view ── */}
          {view === 'list' && (
            <div className="space-y-4">
              {/* Add meal input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Spaghetti Bolognese…"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
                  className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-amber-200 transition-colors"
                />
                <button
                  onClick={handleAddMeal}
                  disabled={!newMealName.trim() || addingMeal}
                  className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
                >
                  {addingMeal ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus size={18} className="text-white" />
                  )}
                </button>
              </div>

              {addingMeal && (
                <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <Sparkles size={11} className="text-amber-400" />
                  LifeBestie is finding ingredients…
                </div>
              )}

              {/* Meal list */}
              {loadingMeals ? (
                <div className="space-y-2">
                  {[120, 90, 110].map((w) => (
                    <div key={w} className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                      <div className="h-4 rounded-full bg-gray-200 animate-pulse" style={{ width: w }} />
                    </div>
                  ))}
                </div>
              ) : meals.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <UtensilsCrossed size={20} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">No meals saved yet</p>
                  <p className="text-xs text-gray-300">Type a meal name above — LifeBestie will find the ingredients</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {meals.map((meal) => (
                    <div
                      key={meal.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{meal.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {meal.ingredients.length > 0
                            ? meal.ingredients.slice(0, 4).map((i) => i.name).join(', ') +
                              (meal.ingredients.length > 4 ? ` +${meal.ingredients.length - 4} more` : '')
                            : 'No ingredients yet'}
                        </p>
                      </div>
                      <button
                        onClick={() => onDeleteMeal(meal.id)}
                        className="shrink-0 text-gray-300 hover:text-rose-400 transition-colors active:scale-95"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Plan Meals CTA */}
              {meals.length > 0 && (
                <button
                  onClick={() => setView('select')}
                  className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-semibold text-sm py-3.5 rounded-2xl transition-colors active:scale-[0.98]"
                >
                  Plan Meals → Auto Grocery List
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}

          {/* ── Select view ── */}
          {view === 'select' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                Tap meals to select — their ingredients will be merged into your weekly grocery list.
              </p>
              <div className="space-y-2">
                {meals.map((meal) => {
                  const selected = selectedIds.has(meal.id);
                  return (
                    <button
                      key={meal.id}
                      onClick={() => toggleSelect(meal.id)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ${
                        selected
                          ? 'bg-amber-50 ring-1 ring-amber-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                        selected ? 'bg-amber-400 border-amber-400' : 'border-gray-200 bg-white'
                      }`}>
                        {selected && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-700">{meal.name}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {meal.ingredients.length} ingredient{meal.ingredients.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={buildPreview}
                disabled={selectedIds.size === 0}
                className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold text-sm py-3.5 rounded-2xl transition-all active:scale-[0.98]"
              >
                Preview Grocery List ({selectedIds.size} meal{selectedIds.size !== 1 ? 's' : ''})
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── Preview view ── */}
          {view === 'preview' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">
                These ingredients will be added to your weekly list tagged as "meal". Quantities from multiple meals have been combined.
              </p>

              {Object.keys(grouped).map((cat) => {
                const colors = getCategoryColors(cat);
                const group = grouped[cat];
                return (
                  <div key={cat} className={`${colors.bg} rounded-2xl px-4 py-3`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                        {cat}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {group.map((ing) => {
                        const qtyLabel = ing.quantity
                          ? `${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}`
                          : null;
                        return (
                          <div key={ing.name} className="bg-white/70 rounded-xl px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                                <span className="text-sm text-gray-700 font-medium truncate">{ing.name}</span>
                              </div>
                              {qtyLabel && (
                                <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                                  {qtyLabel}
                                </span>
                              )}
                            </div>
                            {ing.mealSources && ing.mealSources.length > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1 pl-3.5">
                                Used in: {ing.mealSources.join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <button
                onClick={handleConfirm}
                disabled={planning || done}
                className={`w-full flex items-center justify-center gap-2 font-semibold text-sm py-3.5 rounded-2xl transition-all active:scale-[0.98] ${
                  done
                    ? 'bg-emerald-400 text-white'
                    : 'bg-amber-400 hover:bg-amber-500 text-white disabled:opacity-60'
                }`}
              >
                {done ? (
                  <><Check size={16} /> Added to Weekly List!</>
                ) : planning ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding…</>
                ) : (
                  <>Add {previewIngredients.length} Items to Weekly List</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
