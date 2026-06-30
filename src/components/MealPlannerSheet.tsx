import { useState } from 'react';
import { Plus, Trash2, ChevronRight, UtensilsCrossed, Check, Pencil, X } from 'lucide-react';
import { Meal, MealIngredient, GroceryCategory, GROCERY_CATEGORIES, getCategoryColors } from '../lib/supabase';

interface Props {
  meals: Meal[];
  loadingMeals: boolean;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onDeleteMeal: (id: string) => void;
  onUpdateMeal: (id: string, patch: Partial<Pick<Meal, 'name' | 'meal_type' | 'meal_date' | 'ingredients'>>) => Promise<void>;
  onPlanMeals: (mealIds: string[], ingredients: MealIngredient[]) => Promise<void>;
  onClose: () => void;
}

type View = 'list' | 'select' | 'preview';

function parseQty(q?: string): number | null {
  if (!q) return null;
  const trimmed = q.trim();
  const frac = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

function formatQty(n: number): string {
  if (Math.abs(n - 0.25) < 0.005) return '1/4';
  if (Math.abs(n - 0.5)  < 0.005) return '1/2';
  if (Math.abs(n - 0.75) < 0.005) return '3/4';
  if (Math.abs(n - 1/3)  < 0.005) return '1/3';
  if (Math.abs(n - 2/3)  < 0.005) return '2/3';
  return parseFloat(n.toFixed(2)).toString();
}

function mergeIngredient(
  map: Map<string, MealIngredient>,
  ing: MealIngredient,
  mealName: string
) {
  const normName = ing.name.toLowerCase().trim().replace(/\s+/g, ' ');
  const normUnit = (ing.unit ?? '').toLowerCase().trim();
  const key = `${normName}|${normUnit}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...ing, mealSources: [mealName] });
    return;
  }
  if (!existing.mealSources) {
    existing.mealSources = [mealName];
  } else if (!existing.mealSources.includes(mealName)) {
    existing.mealSources.push(mealName);
  }
  const existingQty = parseQty(existing.quantity);
  const incomingQty = parseQty(ing.quantity);
  if (existingQty !== null && incomingQty !== null) {
    existing.quantity = formatQty(existingQty + incomingQty);
  } else if (incomingQty !== null && existingQty === null && !existing.quantity) {
    existing.quantity = ing.quantity;
    existing.unit = ing.unit;
  }
}

// ─── Inline ingredient editor for a single meal ───────────────────────────────

const CATEGORY_HINTS: [RegExp, GroceryCategory][] = [
  [/cheese|milk|yogurt|cream|butter|egg/i, 'Dairy'],
  [/beef|chicken|turkey|pork|lamb|bacon|sausage|steak|mince|ground/i, 'Meat'],
  [/fish|salmon|tuna|shrimp|prawn|cod|tilapia/i, 'Seafood'],
  [/tortilla|bread|rice|pasta|noodle|flour|oat|cereal/i, 'Pantry'],
  [/lettuce|tomato|onion|pepper|garlic|potato|carrot|cucumber|spinach|kale|broccoli|zucchini|mushroom/i, 'Produce'],
  [/frozen/i, 'Frozen'],
  [/juice|soda|water|coffee|tea|beer|wine/i, 'Beverages'],
  [/chip|cookie|cracker|snack|popcorn/i, 'Snacks'],
];

function guessCategory(ingredientName: string): GroceryCategory {
  for (const [pattern, cat] of CATEGORY_HINTS) {
    if (pattern.test(ingredientName)) return cat;
  }
  return 'Pantry';
}

interface IngredientEditorProps {
  meal: Meal;
  onSave: (ingredients: MealIngredient[]) => Promise<void>;
  onClose: () => void;
}

function IngredientEditor({ meal, onSave, onClose }: IngredientEditorProps) {
  const [ingredients, setIngredients] = useState<MealIngredient[]>(
    meal.ingredients.length > 0 ? meal.ingredients : []
  );
  const aiUnavailable = meal.ingredients.length === 0;
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<GroceryCategory>('Pantry');
  const [saving, setSaving] = useState(false);

  function handleNameChange(val: string) {
    setName(val);
    setCategory(guessCategory(val));
  }

  function addRow() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIngredients((prev) => [...prev, {
      name: trimmed,
      category,
      quantity: qty.trim() || undefined,
      unit: unit.trim() || undefined,
    }]);
    setName('');
    setQty('');
    setUnit('');
  }

  function removeRow(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(ingredients);
    setSaving(false);
    onClose();
  }

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-2xl p-3 space-y-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Ingredients — {meal.name}
      </p>

      {aiUnavailable && (
        <p className="text-xs text-gray-400">
          AI help is not available right now — add ingredients manually below.
        </p>
      )}

      {/* Existing rows */}
      {ingredients.length > 0 && (
        <div className="space-y-1.5">
          {ingredients.map((ing, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs bg-gray-50 rounded-xl px-3 py-2">
              <span className="flex-1 font-medium text-gray-700 truncate">{ing.name}</span>
              {(ing.quantity || ing.unit) && (
                <span className="text-gray-400 shrink-0">
                  {ing.quantity}{ing.unit ? ' ' + ing.unit : ''}
                </span>
              )}
              <button
                onClick={() => removeRow(idx)}
                className="shrink-0 text-gray-300 hover:text-rose-400 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add row form */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder="Ingredient name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRow()}
            className="flex-1 text-xs bg-gray-50 rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-amber-200 transition-colors"
            style={{ fontSize: 16 }}
          />
          <input
            type="text"
            placeholder="Qty"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRow()}
            className="w-14 text-xs bg-gray-50 rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-amber-200 transition-colors text-center"
            style={{ fontSize: 16 }}
          />
          <input
            type="text"
            placeholder="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRow()}
            className="w-16 text-xs bg-gray-50 rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-amber-200 transition-colors"
            style={{ fontSize: 16 }}
          />
        </div>
        <div className="flex gap-1.5">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GroceryCategory)}
            className="flex-1 text-xs bg-gray-50 rounded-lg px-2.5 py-2 outline-none border border-transparent focus:border-amber-200 transition-colors"
          >
            {GROCERY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            onClick={addRow}
            disabled={!name.trim()}
            className="px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold disabled:opacity-40 hover:bg-amber-200 transition-colors active:scale-95"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Save / cancel */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-xl text-xs text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-white disabled:opacity-60 transition-colors active:scale-95"
        >
          {saving ? 'Saving…' : `Save ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export default function MealPlannerSheet({
  meals,
  loadingMeals,
  onAddMeal,
  onDeleteMeal,
  onUpdateMeal,
  onPlanMeals,
  onClose,
}: Props) {
  const [view, setView] = useState<View>('list');
  const [newMealName, setNewMealName] = useState('');
  const [addingMeal, setAddingMeal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewIngredients, setPreviewIngredients] = useState<MealIngredient[]>([]);
  const [planning, setPlanning] = useState(false);
  const [done, setDone] = useState(false);

  async function handleAddMeal() {
    if (!newMealName.trim() || addingMeal) return;
    setAddingMeal(true);
    const meal = await onAddMeal(newMealName.trim());
    setNewMealName('');
    setAddingMeal(false);
    // Open ingredient editor when AI couldn't fetch ingredients
    if (meal && meal.ingredients.length === 0) {
      setEditingId(meal.id);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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

  const grouped: Record<string, MealIngredient[]> = {};
  for (const ing of previewIngredients) {
    if (!grouped[ing.category]) grouped[ing.category] = [];
    grouped[ing.category]!.push(ing);
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[92dvh]">
        <div className="shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-2"
          style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
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
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Spaghetti Bolognese…"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
                  className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-amber-200 transition-colors"
                  style={{ fontSize: 16 }}
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
                <p className="text-xs text-gray-400 px-1">Saving meal…</p>
              )}

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
                  <p className="text-xs text-gray-300">Type a meal name above to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {meals.map((meal) => (
                    <div key={meal.id} className="bg-gray-50 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{meal.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {meal.ingredients.length > 0
                              ? meal.ingredients.slice(0, 4).map((i) => i.name).join(', ') +
                                (meal.ingredients.length > 4 ? ` +${meal.ingredients.length - 4} more` : '')
                              : 'No ingredients — tap edit to add'}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingId(editingId === meal.id ? null : meal.id)}
                          className="shrink-0 text-gray-300 hover:text-amber-500 transition-colors active:scale-95"
                          title="Edit ingredients"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDeleteMeal(meal.id)}
                          className="shrink-0 text-gray-300 hover:text-rose-400 transition-colors active:scale-95"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {editingId === meal.id && (
                        <IngredientEditor
                          meal={meal}
                          onSave={(ingredients) => onUpdateMeal(meal.id, { ingredients })}
                          onClose={() => setEditingId(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

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
                        selected ? 'bg-amber-50 ring-1 ring-amber-300' : 'bg-gray-50 hover:bg-gray-100'
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
                const group = grouped[cat]!;
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
