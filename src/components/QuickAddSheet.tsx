import { useState, useEffect, useRef } from 'react';
import { CheckSquare, Calendar, ShoppingCart, X, ArrowLeft } from 'lucide-react';
import { GROCERY_CATEGORIES, GroceryCategory, getCategoryColors, Event } from '../lib/supabase';

type Mode = null | 'task' | 'event' | 'grocery';

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  onAddTask: (title: string, dueDate?: string) => Promise<void>;
  onAddEvent: (title: string, date: string, time: string) => Promise<Event>;
  onAddGrocery: (name: string, category: GroceryCategory) => Promise<void>;
}

function CategoryPicker({
  selected,
  onChange,
}: {
  selected: GroceryCategory;
  onChange: (v: GroceryCategory) => void;
}) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const isCustom = !GROCERY_CATEGORIES.includes(selected);

  function commitCustom() {
    const trimmed = custom.trim();
    if (trimmed) { onChange(trimmed); setCustom(''); }
    setShowCustom(false);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {GROCERY_CATEGORIES.map((cat) => {
          const c = getCategoryColors(cat);
          const active = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => { onChange(cat); setShowCustom(false); }}
              className={`text-xs py-2 rounded-xl font-medium truncate px-1.5 transition-colors ${
                active ? `${c.bg} ${c.text} ring-1 ring-current` : 'bg-gray-50 text-gray-500'
              }`}
            >
              {cat}
            </button>
          );
        })}
        {isCustom && (
          <button
            onClick={() => setShowCustom(false)}
            className={`text-xs py-2 rounded-xl font-medium truncate px-1.5 ${getCategoryColors(selected).bg} ${getCategoryColors(selected).text} ring-1 ring-current`}
          >
            {selected}
          </button>
        )}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="text-xs py-2 rounded-xl font-medium bg-gray-50 text-gray-400 transition-colors"
        >
          + Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Frozen, Beverages…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') setShowCustom(false); }}
            className="flex-1 text-xs bg-gray-50 rounded-xl px-3 py-2 outline-none border border-transparent focus:border-rose-200 transition-colors"
            autoFocus
          />
          <button
            onClick={commitCustom}
            disabled={!custom.trim()}
            className="text-xs font-semibold text-white theme-bg-primary disabled:opacity-50 px-3 py-2 rounded-xl transition-colors"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

const ADD_OPTIONS = [
  {
    id: 'task'    as Mode,
    icon: CheckSquare,
    label: 'Add Task',
    description: 'Track something to do',
    accent: 'bg-rose-50 border-rose-100',
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-500',
  },
  {
    id: 'event'   as Mode,
    icon: Calendar,
    label: 'Add Event',
    description: 'Schedule something on a date',
    accent: 'bg-amber-50 border-amber-100',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
  },
  {
    id: 'grocery' as Mode,
    icon: ShoppingCart,
    label: 'Add Grocery Item',
    description: 'Add to your shopping list',
    accent: 'bg-emerald-50 border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-500',
  },
] as const;

export default function QuickAddSheet({
  open,
  onClose,
  onAddTask,
  onAddEvent,
  onAddGrocery,
}: QuickAddSheetProps) {
  const [mode, setMode]         = useState<Mode>(null);
  const [title, setTitle]       = useState('');
  const [dueDate, setDueDate]   = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('');
  const [category, setCategory] = useState<GroceryCategory>('Pantry');
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state after the close animation finishes
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setMode(null);
        setTitle('');
        setDueDate('');
        setEventDate(new Date().toISOString().split('T')[0]);
        setEventTime('');
        setCategory('Pantry');
        setSuccess('');
        setSaving(false);
      }, 300);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Auto-focus text input when a mode is selected
  useEffect(() => {
    if (mode) {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [mode]);

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      if (mode === 'task')    await onAddTask(title.trim(), dueDate || undefined);
      if (mode === 'event')   await onAddEvent(title.trim(), eventDate, eventTime);
      if (mode === 'grocery') await onAddGrocery(title.trim(), category);
      const labels = { task: 'Task added!', event: 'Event added!', grocery: 'Item added!' };
      setSuccess(mode ? labels[mode] : '');
      setTimeout(onClose, 900);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const formTitle =
    mode === 'task'    ? 'New Task' :
    mode === 'event'   ? 'New Event' :
    mode === 'grocery' ? 'New Grocery Item' :
    'Add Something';

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[61] flex justify-center pointer-events-none">
        <div
          className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl pointer-events-auto sheet-slide-up"
          style={{ maxHeight: '90dvh', overflowY: 'auto' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3">
            {mode ? (
              <button
                onClick={() => setMode(null)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 active:scale-95 transition-all"
                aria-label="Back"
              >
                <ArrowLeft size={15} />
                Back
              </button>
            ) : (
              <span />
            )}
            <h2 className="text-base font-bold text-gray-800 absolute left-1/2 -translate-x-1/2">
              {formTitle}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-transform"
              aria-label="Close"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-8 space-y-3 sheet-safe-bottom">
            {/* Success banner */}
            {success && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm text-emerald-600 font-medium text-center">
                {success}
              </div>
            )}

            {/* Phase 1: option selection */}
            {!mode && !success && (
              <div className="space-y-2.5 pb-2">
                {ADD_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setMode(opt.id)}
                      className={`w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 border active:scale-[0.98] transition-transform ${opt.accent}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.iconBg}`}>
                        <Icon size={18} className={opt.iconColor} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-800 text-sm">{opt.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Phase 2: form */}
            {mode && !success && (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    mode === 'task'    ? 'What needs to be done?' :
                    mode === 'event'   ? 'Event name' :
                    'Item name'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                />

                {mode === 'task' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Due date (optional)</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                    />
                  </div>
                )}

                {mode === 'event' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Date</label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Time</label>
                      <input
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                      />
                    </div>
                  </div>
                )}

                {mode === 'grocery' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-2 block">Category</label>
                    <CategoryPicker selected={category} onChange={setCategory} />
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setMode(null)}
                    className="flex-1 text-sm text-gray-400 bg-gray-50 rounded-xl py-3 font-medium active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!title.trim() || saving}
                    className="flex-1 text-sm text-white theme-bg-primary rounded-xl py-3 font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
