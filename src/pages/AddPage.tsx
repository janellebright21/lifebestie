import { useState } from 'react';
import { CheckSquare, Calendar, ShoppingCart, X } from 'lucide-react';
import { GROCERY_CATEGORIES, GroceryCategory, getCategoryColors, Goal, Event } from '../lib/supabase';

interface AddPageProps {
  onAddTask: (title: string, dueDate?: string) => Promise<void>;
  onAddEvent: (title: string, date: string, time: string) => Promise<Event>;
  onAddGrocery: (name: string, category: GroceryCategory) => Promise<void>;
  goals?: Goal[];
}

type Mode = null | 'task' | 'event' | 'grocery';

function CategoryPickerGrid({
  selected,
  onChange,
}: {
  selected: GroceryCategory;
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

  const isCustom = !GROCERY_CATEGORIES.includes(selected);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {GROCERY_CATEGORIES.map((cat) => {
          const colors = getCategoryColors(cat);
          const isActive = selected === cat;
          return (
            <button
              key={cat}
              onClick={() => { onChange(cat); setShowCustom(false); }}
              className={`text-xs py-2.5 rounded-xl font-medium transition-colors truncate px-2 ${
                isActive ? `${colors.bg} ${colors.text} ring-1 ring-current` : 'bg-gray-50 text-gray-500'
              }`}
            >
              {cat}
            </button>
          );
        })}
        {isCustom && (
          <button
            onClick={() => setShowCustom(false)}
            className={`text-xs py-2.5 rounded-xl font-medium truncate px-2 ${getCategoryColors(selected).bg} ${getCategoryColors(selected).text} ring-1 ring-current`}
          >
            {selected}
          </button>
        )}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className="text-xs py-2.5 rounded-xl font-medium bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
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
            className="text-xs font-semibold text-white theme-bg-primary hover:opacity-90 disabled:opacity-50 px-3 py-2 rounded-xl transition-colors"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}

export default function AddPage({ onAddTask, onAddEvent, onAddGrocery }: AddPageProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('');
  const [groceryCategory, setGroceryCategory] = useState<GroceryCategory>('Pantry');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  function reset() {
    setTitle('');
    setDueDate('');
    setEventDate(new Date().toISOString().split('T')[0]);
    setEventTime('');
    setGroceryCategory('Pantry');
    setMode(null);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (mode === 'task') {
        await onAddTask(title.trim(), dueDate || undefined);
        setSuccess('Task added!');
      } else if (mode === 'event') {
        await onAddEvent(title.trim(), eventDate, eventTime);
        setSuccess('Event added!');
      } else if (mode === 'grocery') {
        await onAddGrocery(title.trim(), groceryCategory);
        setSuccess('Item added!');
      }
      setTimeout(() => {
        setSuccess('');
        reset();
      }, 1200);
    } finally {
      setSaving(false);
    }
  }

  const addOptions = [
    {
      id: 'task' as Mode,
      icon: CheckSquare,
      label: 'Add Task',
      description: 'Track something you need to do',
      color: 'rose',
    },
    {
      id: 'event' as Mode,
      icon: Calendar,
      label: 'Add Event',
      description: 'Schedule something on a date',
      color: 'amber',
    },
    {
      id: 'grocery' as Mode,
      icon: ShoppingCart,
      label: 'Add Grocery Item',
      description: 'Add to your shopping list',
      color: 'emerald',
    },
  ];

  const colorMap: Record<string, string> = {
    rose: 'bg-rose-50 border-rose-100 text-rose-500',
    amber: 'bg-amber-50 border-amber-100 text-amber-500',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-500',
  };
  const iconBgMap: Record<string, string> = {
    rose: 'bg-rose-100',
    amber: 'bg-amber-100',
    emerald: 'bg-emerald-100',
  };

  return (
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="bl-page-title">Add New</h1>
        {mode && (
          <button
            onClick={reset}
            className="p-2 rounded-full bg-gray-100 active:scale-95 transition-transform"
          >
            <X size={16} className="text-gray-500" />
          </button>
        )}
      </div>

      {success && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm text-emerald-600 font-medium text-center">
          {success}
        </div>
      )}

      {!mode ? (
        <div className="space-y-3">
          {addOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={`w-full flex items-center gap-4 rounded-2xl px-4 py-4 border active:scale-[0.98] transition-transform ${colorMap[opt.color]}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBgMap[opt.color]}`}>
                  <Icon size={20} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-800 text-sm">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">
            {mode === 'task' ? 'New Task' : mode === 'event' ? 'New Event' : 'New Grocery Item'}
          </h2>

          <input
            autoFocus
            type="text"
            placeholder={
              mode === 'task'
                ? 'What needs to be done?'
                : mode === 'event'
                ? 'Event name'
                : 'Item name'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
          />

          {mode === 'task' && (
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
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
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Time</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-3 outline-none border border-transparent focus:border-rose-200 transition-colors"
                />
              </div>
            </div>
          )}

          {mode === 'grocery' && (
            <div>
              <label className="text-xs text-gray-400 mb-2 block">Category</label>
              <CategoryPickerGrid selected={groceryCategory} onChange={setGroceryCategory} />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
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
  );
}
