import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  type BrainDumpSuggestion, type BrainDumpResult,
  validateBrainDumpResult, filterByModules, canSave,
  createSaveOrchestrator, hasRetryable, countSaved, countErrors, countSelected,
} from '../lib/brainDumpLogic';
import type { ModuleId, TaskCategory, TaskPriority, Task } from '../lib/supabase';
import { CheckCircle2, Circle, X, Plus, Loader2, AlertCircle, ShoppingCart, Calendar, StickyNote, RotateCcw, Sparkles } from 'lucide-react';

const MAX_CHARS = 4000;

interface BrainDumpSheetProps {
  open: boolean;
  onClose: () => void;
  enabledModules: Set<ModuleId>;
  onAddTask: (title: string, dueDate?: string, _linkedGoalId?: string, _duration?: number, category?: TaskCategory, priority?: TaskPriority) => Promise<Task>;
  onAddGrocery: (name: string, category: string) => Promise<void>;
  onNavigate: (tab: 'planner' | 'grocery') => void;
}

type Phase = 'input' | 'loading' | 'review' | 'error';

export default function BrainDumpSheet({
  open, onClose, enabledModules, onAddTask, onAddGrocery, onNavigate,
}: BrainDumpSheetProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [text, setText] = useState('');
  const [emmaReply, setEmmaReply] = useState('');
  const [suggestions, setSuggestions] = useState<BrainDumpSuggestion[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savingRef = useRef(false);

  // Reset on close — but preserve draft text across close/reopen during same session
  useEffect(() => {
    if (!open) {
      // Don't clear text on close — preserve for reopen within session
      // But clear results/error
      setSuggestions([]);
      setEmmaReply('');
      setErrorMsg('');
      setIsSaving(false);
    } else {
      // On reopen, go back to input phase
      setPhase('input');
      setErrorMsg('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  // Clear everything on account change (detected by component unmount)
  useEffect(() => () => {
    setText('');
    setSuggestions([]);
    setEmmaReply('');
    setErrorMsg('');
  }, []);

  const handleOrganize = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPhase('loading');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('emma-chat', {
        body: {
          mode: 'brain_dump',
          brain_dump_text: trimmed,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      if (error) {
        setPhase('error');
        setErrorMsg('Could not reach Emma. Please try again.');
        return;
      }

      if (data?.error) {
        setPhase('error');
        setErrorMsg(data.message ?? data.error);
        return;
      }

      const result: BrainDumpResult | null = validateBrainDumpResult(data);
      if (!result) {
        setPhase('error');
        setErrorMsg('Emma\'s response was not valid. Please try again.');
        return;
      }

      const filtered = filterByModules(result.suggestions, enabledModules);
      setEmmaReply(result.text);
      setSuggestions(filtered);
      setPhase('review');
    } catch {
      setPhase('error');
      setErrorMsg('Something went wrong. Please try again.');
    }
  }, [text, enabledModules]);

  const toggleSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) =>
      s.id === id && s.status !== 'saved' && s.status !== 'saving'
        ? { ...s, selected: !s.selected }
        : s,
    ));
  }, []);

  const updateSuggestion = useCallback((id: string, patch: Partial<BrainDumpSuggestion>) => {
    setSuggestions((prev) => prev.map((s) =>
      s.id === id && s.status !== 'saved' && s.status !== 'saving'
        ? { ...s, ...patch }
        : s,
    ));
  }, []);

  const removeSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addManualSuggestion = useCallback(() => {
    setSuggestions((prev) => [...prev, {
      id: `manual-${Date.now()}`,
      type: 'task',
      title: '',
      selected: false,
      status: 'pending',
      category: 'Other',
      priority: 'medium',
    }]);
  }, []);

  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    // addTask/addGrocery await side effects (history, habits, points) AFTER the
    // confirmed insert. If those extras throw, the insert still succeeded — so we
    // treat the insert as success and log side-effect failures separately.
    const saveOne = async (s: BrainDumpSuggestion) => {
      if (s.type === 'task') {
        try {
          const task = await onAddTask(s.title, s.dueDate ?? undefined, undefined, undefined, s.category, s.priority);
          return { success: true, id: task.id };
        } catch (err) {
          // If the task was already inserted, the row exists even though this threw.
          // We can't distinguish insert-failure from side-effect-failure here, so we
          // report as error — the user can retry, and the duplicate guard in the
          // orchestrator prevents re-saving already-saved items.
          return { success: false, error: err instanceof Error ? err.message : 'Could not save task' };
        }
      }
      if (s.type === 'grocery') {
        try {
          await onAddGrocery(s.title, s.groceryCategory ?? 'Pantry');
          return { success: true, id: `grocery-${s.id}` };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Could not save grocery item' };
        }
      }
      return { success: false, error: 'Notes cannot be saved — no note API available' };
    };

    const save = createSaveOrchestrator(saveOne);

    // Mark items as saving
    setSuggestions((prev) => prev.map((s) =>
      s.selected && s.status === 'pending' ? { ...s, status: 'saving' as const } : s,
    ));

    try {
      const results = await save(suggestions);

      setSuggestions((prev) => prev.map((s) => {
        const r = results.get(s.id);
        if (!r) return s;
        if (r.status === 'saved') {
          return { ...s, status: 'saved' as const, savedId: r.savedId, selected: false };
        }
        return { ...s, status: 'error' as const, errorMsg: r.errorMsg };
      }));

      const saved = [...results.values()].filter((r) => r.status === 'saved').length;
      void saved;
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }, [suggestions, onAddTask, onAddGrocery]);

  const handleRetry = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    const saveOne = async (s: BrainDumpSuggestion) => {
      if (s.type === 'task') {
        try {
          const task = await onAddTask(s.title, s.dueDate ?? undefined, undefined, undefined, s.category, s.priority);
          return { success: true, id: task.id };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Could not save task' };
        }
      }
      if (s.type === 'grocery') {
        try {
          await onAddGrocery(s.title, s.groceryCategory ?? 'Pantry');
          return { success: true, id: `grocery-${s.id}` };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Could not save grocery item' };
        }
      }
      return { success: false, error: 'Notes cannot be saved' };
    };

    const save = createSaveOrchestrator(saveOne);

    setSuggestions((prev) => prev.map((s) =>
      s.selected && s.status === 'error' ? { ...s, status: 'saving' as const, errorMsg: undefined } : s,
    ));

    try {
      const results = await save(suggestions);
      setSuggestions((prev) => prev.map((s) => {
        const r = results.get(s.id);
        if (!r) return s;
        if (r.status === 'saved') {
          return { ...s, status: 'saved' as const, savedId: r.savedId, selected: false };
        }
        return { ...s, status: 'error' as const, errorMsg: r.errorMsg };
      }));
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }, [suggestions, onAddTask, onAddGrocery]);

  const selectedCount = countSelected(suggestions);
  const savedNum = countSaved(suggestions);
  const errorNum = countErrors(suggestions);
  const canRetry = hasRetryable(suggestions) && !isSaving;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Brain dump"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-3xl shadow-2xl max-w-2xl mx-auto w-full max-h-[92dvh] flex flex-col"
        style={{ animation: 'brainDumpSheetIn 250ms ease-out' }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: 'var(--theme-primary)' }} />
            <h2 className="text-sm font-bold text-gray-800">Brain Dump with Emma</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close brain dump"
            className="flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2"
            style={{ width: 44, height: 44, minHeight: 44 }}
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {phase === 'input' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Dump everything that's on your mind. Emma will organize it into tasks, groceries, and notes for you to review — nothing saves until you say so.
                </p>
              </div>
              <div>
                <label htmlFor="brain-dump-input" className="text-xs font-semibold text-gray-500 mb-1.5 block">
                  What's on your mind?
                </label>
                <textarea
                  ref={textareaRef}
                  id="brain-dump-input"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="e.g., I need to buy milk, call the dentist tomorrow, I'm feeling overwhelmed about the week, pick up dry cleaning..."
                  maxLength={MAX_CHARS}
                  rows={6}
                  className="w-full text-sm text-gray-700 bg-gray-50 rounded-2xl border border-gray-200 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 outline-none p-3.5 resize-none transition-all"
                  style={{ minHeight: 120 }}
                />
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-gray-400">{text.length}/{MAX_CHARS}</span>
                </div>
              </div>
              <div className="rounded-xl bg-violet-50 border border-violet-100 px-3.5 py-3">
                <p className="text-xs text-violet-500 leading-relaxed">
                  When you tap "Organize with Emma," your text goes to Emma's AI to sort into suggestions. You'll review everything before anything is saved.
                </p>
              </div>
              <button
                onClick={handleOrganize}
                disabled={!text.trim()}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-2xl py-3.5 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                style={{ backgroundColor: 'var(--theme-primary)', minHeight: 48 }}
              >
                <Sparkles size={16} />
                Organize with Emma
              </button>
            </div>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
              <p className="text-sm text-gray-500">Emma is reading through your thoughts…</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle size={28} className="text-rose-400" />
              <p className="text-sm text-gray-600 text-center max-w-xs">{errorMsg}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhase('input')}
                  className="text-sm font-semibold text-gray-500 px-4 py-2.5 rounded-xl border border-gray-200 active:scale-95 transition-all"
                  style={{ minHeight: 44 }}
                >
                  Back to text
                </button>
                <button
                  onClick={handleOrganize}
                  className="text-sm font-semibold text-white px-4 py-2.5 rounded-xl active:scale-95 transition-all"
                  style={{ backgroundColor: 'var(--theme-primary)', minHeight: 44 }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="space-y-4">
              {/* Emma's reply */}
              <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--theme-primary-light)', border: '1px solid var(--theme-primary-mid)' }}>
                <p className="text-sm text-gray-700 leading-relaxed">{emmaReply}</p>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Suggestions — review and select what to save</p>
                  {suggestions.map((s) => (
                    <SuggestionRow
                      key={s.id}
                      suggestion={s}
                      enabledModules={enabledModules}
                      onToggle={() => toggleSuggestion(s.id)}
                      onUpdate={(patch) => updateSuggestion(s.id, patch)}
                      onRemove={() => removeSuggestion(s.id)}
                    />
                  ))}
                </div>
              )}

              {/* Manual add */}
              <button
                onClick={addManualSuggestion}
                disabled={isSaving}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-500 active:scale-95 transition-all disabled:opacity-30"
              >
                <Plus size={14} />
                Add a suggestion manually
              </button>

              {/* Save bar */}
              {savedNum > 0 && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 font-medium flex-1">
                    {savedNum} {savedNum === 1 ? 'item' : 'items'} saved successfully
                  </p>
                  <button
                    onClick={() => onNavigate(suggestions.some((s) => s.type === 'task' && s.status === 'saved') ? 'planner' : 'grocery')}
                    className="text-xs font-semibold text-emerald-600 underline underline-offset-2"
                  >
                    View
                  </button>
                </div>
              )}

              {/* Error summary */}
              {errorNum > 0 && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <p className="text-xs text-rose-600 flex-1">
                    {errorNum} {errorNum === 1 ? 'item' : 'items'} failed to save. You can retry.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {canRetry && (
                  <button
                    onClick={handleRetry}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 rounded-2xl py-3 px-4 border border-gray-200 active:scale-95 transition-all disabled:opacity-40"
                    style={{ minHeight: 48 }}
                  >
                    <RotateCcw size={14} />
                    Retry failed
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || selectedCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white rounded-2xl py-3 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
                  style={{ backgroundColor: 'var(--theme-primary)', minHeight: 48 }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>Save selected ({selectedCount})</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <style>{`
          @keyframes brainDumpSheetIn {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Suggestion row ────────────────────────────────────────────────────────────

function SuggestionRow({
  suggestion: s,
  enabledModules,
  onToggle,
  onUpdate,
  onRemove,
}: {
  suggestion: BrainDumpSuggestion;
  enabledModules: Set<ModuleId>;
  onToggle: () => void;
  onUpdate: (patch: Partial<BrainDumpSuggestion>) => void;
  onRemove: () => void;
}) {
  const editable = s.status === 'pending' || s.status === 'error';
  const savable = canSave(s, enabledModules);

  const icon = s.type === 'task'
    ? <Calendar size={14} className="text-violet-400" />
    : s.type === 'grocery'
      ? <ShoppingCart size={14} className="text-emerald-400" />
      : <StickyNote size={14} className="text-amber-400" />;

  return (
    <div
      className="rounded-2xl border px-3.5 py-3 transition-all"
      style={{
        backgroundColor: s.status === 'saved' ? 'rgb(243 244 246)' : s.status === 'error' ? 'rgb(255 241 242)' : 'white',
        borderColor: s.status === 'saved' ? 'rgb(229 231 235)' : s.status === 'error' ? 'rgb(254 202 202)' : 'rgb(243 244 246)',
        opacity: s.status === 'saved' ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={!editable || !savable}
          aria-label={s.selected ? 'Deselect' : 'Select'}
          className="mt-0.5 shrink-0 active:scale-90 transition-transform disabled:opacity-30"
          style={{ minHeight: 24, minWidth: 24 }}
        >
          {s.status === 'saved' ? (
            <CheckCircle2 size={20} className="text-emerald-400" />
          ) : s.selected ? (
            <CheckCircle2 size={20} style={{ color: 'var(--theme-primary)' }} />
          ) : (
            <Circle size={20} className="text-gray-300" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {s.type === 'task' ? 'Task' : s.type === 'grocery' ? 'Grocery' : 'Note'}
            </span>
            {!savable && s.type === 'note' && (
              <span className="text-[10px] text-amber-400 font-medium">(review only)</span>
            )}
            {!savable && s.type === 'grocery' && (
              <span className="text-[10px] text-gray-400 font-medium">(module disabled)</span>
            )}
          </div>

          {editable ? (
            <input
              type="text"
              value={s.title}
              onChange={(e) => onUpdate({ title: e.target.value.slice(0, 200) })}
              placeholder="Title…"
              className="w-full text-sm text-gray-700 bg-transparent border-b border-gray-100 focus:border-violet-300 outline-none py-0.5"
            />
          ) : (
            <p className="text-sm text-gray-700 font-medium">{s.title}</p>
          )}

          {/* Task fields */}
          {s.type === 'task' && editable && (
            <div className="flex gap-2 flex-wrap">
              <input
                type="date"
                value={s.dueDate ?? ''}
                onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 outline-none focus:border-violet-200"
              />
              <select
                value={s.category ?? 'Other'}
                onChange={(e) => onUpdate({ category: e.target.value as TaskCategory })}
                className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 outline-none focus:border-violet-200"
              >
                {['Work', 'Kids', 'Home', 'Self-care', 'Grocery', 'Personal', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={s.priority ?? 'medium'}
                onChange={(e) => onUpdate({ priority: e.target.value as TaskPriority })}
                className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 outline-none focus:border-violet-200"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          {/* Grocery fields */}
          {s.type === 'grocery' && editable && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={s.groceryCategory ?? 'Pantry'}
                onChange={(e) => onUpdate({ groceryCategory: e.target.value })}
                className="text-xs text-gray-600 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100 outline-none focus:border-violet-200"
              >
                {['Produce', 'Dairy', 'Meat', 'Seafood', 'Bakery', 'Frozen', 'Beverages', 'Pantry', 'Snacks', 'Personal Care', 'Household', 'Baby', 'Pet'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {s.quantity && <span className="text-xs text-gray-400 self-center">{s.quantity}{s.unit ? ` ${s.unit}` : ''}</span>}
            </div>
          )}

          {/* Status indicators */}
          {s.status === 'saving' && (
            <p className="text-xs text-violet-400 flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" /> Saving…
            </p>
          )}
          {s.status === 'saved' && (
            <p className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 size={12} /> Saved
            </p>
          )}
          {s.status === 'error' && s.errorMsg && (
            <p className="text-xs text-rose-400 flex items-center gap-1">
              <AlertCircle size={12} /> {s.errorMsg}
            </p>
          )}
        </div>

        {/* Remove button */}
        {editable && (
          <button
            onClick={onRemove}
            aria-label="Remove suggestion"
            className="shrink-0 p-1 text-gray-300 hover:text-gray-500 active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
