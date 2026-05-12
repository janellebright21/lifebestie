import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, CheckCircle2, Circle, Clock, Trash2, Repeat, Target,
  Timer, ChevronDown, ChevronUp, Sparkles, Calendar, MapPin,
  Flag, Zap, AlarmClock, X, Pencil, Check,
  Lock, Unlock, ArrowUp, ArrowDown, RefreshCw, ListPlus, Palette,
  UtensilsCrossed, ShoppingCart,
} from 'lucide-react';
import {
  Task, Event, Routine, Goal, Meal,
  TASK_CATEGORIES, TaskCategory, TaskPriority,
  EVENT_CATEGORIES, EventCategory,
  PASTEL_COLORS, PastelColorKey, PastelColor, PASTEL_COLOR_MAP,
} from '../lib/supabase';
import { useCategoryColors, seedDefaultColors } from '../hooks/useCategoryColors';
import PrepareForTomorrowBanner from '../components/PrepareForTomorrowBanner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlannerPageProps {
  tasks: Task[];
  events: Event[];
  routines: Routine[];
  goals: Goal[];
  meals: Meal[];
  onAddEvent: (title: string, date: string, time: string, category?: EventCategory, location?: string, notes?: string) => Promise<void>;
  onAddTask: (title: string, dueDate?: string, linkedGoalId?: string, duration?: number, category?: TaskCategory, priority?: TaskPriority) => Promise<void>;
  onToggleTask: (id: string, completed: boolean) => void;
  onUpdateTask: (id: string, patch: Partial<Pick<Task, 'title' | 'due_date' | 'duration' | 'linked_goal_id' | 'category' | 'priority'>>) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (id: string, patch: Partial<Pick<Event, 'title' | 'event_date' | 'event_time' | 'category' | 'location' | 'notes'>>) => Promise<void>;
  onDeleteRoutine: (name: string) => void;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onLinkMealToEvent: (eventId: string, meal: Meal) => Promise<void>;
  tomorrowReminders: string[];
  tomorrowRemindersLoading: boolean;
  onDismissTomorrowReminder: (reminder: string) => void;
  onRefreshTomorrowReminders: () => void;
}

type PageView = 'today' | 'tasks' | 'events';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string; bg: string }> = {
  high:   { label: 'High',   color: 'text-rose-500',   dot: 'bg-rose-400',   bg: 'bg-rose-50'   },
  medium: { label: 'Medium', color: 'text-amber-500',  dot: 'bg-amber-400',  bg: 'bg-amber-50'  },
  low:    { label: 'Low',    color: 'text-sky-400',    dot: 'bg-sky-300',    bg: 'bg-sky-50'    },
};

// ─── Category color context ───────────────────────────────────────────────────
// All sub-components read colors via getCatColor() without prop drilling.

const CatColorCtx = React.createContext<(cat: string) => PastelColor>(
  (cat) => PASTEL_COLOR_MAP[cat as PastelColorKey] ?? PASTEL_COLOR_MAP['gray']
);

function useCatColor() {
  return React.useContext(CatColorCtx);
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const SUGGESTIONS = [
  "You've got a full afternoon — tackle one big thing this morning while it's quieter.",
  "Small wins add up! Even 15 minutes on a task moves it forward.",
  "You have a busy day ahead — be kind to yourself and focus on what truly matters.",
  "Morning tasks tend to get done more reliably. Consider moving something there.",
  "If a task has been sitting for days, it might need to be broken into smaller steps.",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string, today: string) {
  if (dateStr === today) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  const tomorrow = new Date(today + 'T00:00:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getToday() { return new Date().toISOString().split('T')[0]; }

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// dateColorDots: date string → array of hex colors (up to ~4 shown)
function MiniCalendar({
  selectedDate,
  today,
  dateColorDots,
  onSelect,
  onCustomizeColors,
}: {
  selectedDate: string;
  today: string;
  dateColorDots: Map<string, string[]>;
  onSelect: (date: string) => void;
  onCustomizeColors: () => void;
}) {
  const [viewYear, setViewYear] = useState(() => new Date(selectedDate + 'T12:00:00').getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate + 'T12:00:00').getMonth());

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }
  function goToToday() {
    const t = new Date(today + 'T12:00:00');
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onSelect(today);
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden mb-4">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          <ChevronDown size={14} className="text-gray-500 rotate-90" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          {(viewYear !== new Date(today + 'T12:00:00').getFullYear() || viewMonth !== new Date(today + 'T12:00:00').getMonth()) && (
            <button
              onClick={goToToday}
              className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-500 hover:bg-sky-100 transition-colors"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 active:scale-95 transition-all"
        >
          <ChevronDown size={14} className="text-gray-500 -rotate-90" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-2 pt-2 pb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-300 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-2 pb-3 gap-y-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const dots = dateColorDots.get(dateStr) ?? [];
          const visibleDots = dots.slice(0, 4);

          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center h-9 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                isSelected
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-200'
                  : isToday
                  ? 'bg-sky-50 text-sky-600 font-bold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {day}
              {visibleDots.length > 0 && (
                <div className="flex gap-[2px] absolute bottom-[3px]">
                  {visibleDots.map((hex, i) => (
                    <span
                      key={i}
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : hex }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer: legend + customize */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-50 bg-gray-50/40">
        <p className="text-xs text-gray-400">Colored dots show categories</p>
        <button
          onClick={onCustomizeColors}
          className="flex items-center gap-1 text-xs font-semibold text-sky-500 hover:text-sky-600 transition-colors"
        >
          <Palette size={11} />
          Customize
        </button>
      </div>
    </div>
  );
}

// ─── Customize Colors Sheet ────────────────────────────────────────────────────

function CustomizeColorsSheet({
  colorMap,
  onSetColor,
  onClose,
}: {
  colorMap: Record<string, PastelColorKey>;
  onSetColor: (category: string, key: PastelColorKey) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center">
              <Palette size={15} className="text-sky-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Customize Category Colors</h2>
              <p className="text-xs text-gray-400">Pick a color for each category</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={13} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {TASK_CATEGORIES.map((cat) => {
            const current = colorMap[cat] ?? 'gray';
            return (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 mb-2">{cat}</p>
                <div className="flex gap-2 flex-wrap">
                  {PASTEL_COLORS.map((color) => (
                    <button
                      key={color.key}
                      onClick={() => onSetColor(cat, color.key)}
                      title={color.label}
                      className={`w-9 h-9 rounded-full transition-all active:scale-95 ${
                        current === color.key
                          ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
                {/* Preview of current selection */}
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: PASTEL_COLORS.find(p => p.key === current)?.bgHex, color: PASTEL_COLORS.find(p => p.key === current)?.hex }}
                  >
                    {cat}
                  </span>
                  <span className="text-xs text-gray-400">{PASTEL_COLORS.find(p => p.key === current)?.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-50 shrink-0">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 active:scale-[0.98] transition-all">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Task Form ────────────────────────────────────────────────────────────

function AddTaskForm({
  goals,
  defaultDueDate,
  onAdd,
  onCancel,
}: {
  goals: Goal[];
  defaultDueDate?: string;
  onAdd: PlannerPageProps['onAddTask'];
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate ?? '');
  const [linkedGoalId, setLinkedGoalId] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [category, setCategory] = useState<TaskCategory>('Other');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const getCatColor = useCatColor();

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd(title.trim(), dueDate || undefined, linkedGoalId || undefined, duration !== '' ? Number(duration) : undefined, category, priority);
    setSaving(false);
    onCancel();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sky-100 overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Title row */}
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="What needs to get done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!title.trim() || saving}
            className="w-10 h-10 rounded-xl bg-sky-500 flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-transform"
          >
            {saving
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Check size={17} className="text-white" />}
          </button>
        </div>

        {/* Priority pills */}
        <div className="flex gap-2">
          {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                  priority === p ? `${cfg.bg} ${cfg.color} ring-1 ring-current` : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Flag size={9} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {TASK_CATEGORIES.map((cat) => {
            const cfg = getCatColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                  category === cat ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.border}` : 'bg-gray-50 text-gray-400'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showAdvanced ? 'Fewer options' : 'Due date, duration, goal…'}
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors text-gray-700"
                >
                  <option value="">No estimate</option>
                  {DURATION_PRESETS.map((p) => <option key={p} value={p}>{formatDuration(p)}</option>)}
                </select>
              </div>
            </div>

            {goals.length > 0 && (
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">Link to goal</label>
                <select
                  value={linkedGoalId}
                  onChange={(e) => setLinkedGoalId(e.target.value)}
                  className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors text-gray-700"
                >
                  <option value="">No goal</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-50">
        <button onClick={onCancel} className="w-full text-sm text-gray-400 py-3 font-medium hover:bg-gray-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Add Event Form ───────────────────────────────────────────────────────────

function AddEventForm({
  onAdd,
  onCancel,
}: {
  onAdd: PlannerPageProps['onAddEvent'];
  onCancel: () => void;
}) {
  const today = getToday();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [category, setCategory] = useState<EventCategory>('Other');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const getCatColor = useCatColor();

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd(title.trim(), date, time, category, location || undefined, notes || undefined);
    setSaving(false);
    onCancel();
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden">
      <div className="p-4 space-y-3">
        <input
          autoFocus
          type="text"
          placeholder="What's happening?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-rose-200 transition-colors"
        />

        {/* Category */}
        <div className="flex gap-1.5 flex-wrap">
          {EVENT_CATEGORIES.map((cat) => {
            const cfg = getCatColor(cat);
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                  category === cat ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.border}` : 'bg-gray-50 text-gray-400'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-rose-200 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400 block mb-1">Time (optional)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-rose-200 transition-colors"
            />
          </div>
        </div>

        {/* Location + Notes toggle */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showMore ? 'Fewer options' : 'Location, notes…'}
        </button>

        {showMore && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <MapPin size={13} className="text-gray-300 shrink-0" />
              <input
                type="text"
                placeholder="Location (optional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-300"
              />
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-rose-200 transition-colors resize-none"
            />
          </div>
        )}
      </div>

      <div className="flex border-t border-gray-50">
        <button onClick={onCancel} className="flex-1 text-sm text-gray-400 py-3 font-medium hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <div className="w-px bg-gray-50" />
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 text-sm text-rose-500 font-semibold py-3 hover:bg-rose-50 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Event'}
        </button>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  goal,
  onToggle,
  onDelete,
  onMoveToToday,
  onMoveToTomorrow,
}: {
  task: Task;
  goal: Goal | undefined;
  onToggle: () => void;
  onDelete: () => void;
  onMoveToToday?: () => void;
  onMoveToTomorrow?: () => void;
}) {
  const today = getToday();
  const isOverdue = !task.completed && task.due_date && task.due_date < today;
  const isMissed = isOverdue;
  const priorityCfg = PRIORITY_CONFIG[task.priority ?? 'medium'];
  const getCatColor = useCatColor();
  const catCfg = getCatColor(task.category ?? 'Other');

  return (
    <div className={`bg-white rounded-2xl px-4 py-3 shadow-sm border transition-all ${
      task.completed ? 'border-gray-50 opacity-60' : isMissed ? 'border-rose-100' : 'border-gray-50'
    }`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="shrink-0 mt-0.5 transition-transform active:scale-90">
          {task.completed
            ? <CheckCircle2 size={20} className="text-sky-400" />
            : <Circle size={20} className="text-gray-200 hover:text-sky-300 transition-colors" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${task.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Priority badge */}
            <span className={`text-xs font-semibold flex items-center gap-0.5 ${priorityCfg.color}`}>
              <Flag size={9} />
              {priorityCfg.label}
            </span>

            {/* Category badge */}
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catCfg.bg} ${catCfg.text}`}>
              {task.category}
            </span>

            {/* Due date */}
            {task.due_date && (
              <span className={`text-xs font-medium flex items-center gap-1 ${isMissed ? 'text-rose-500' : 'text-gray-400'}`}>
                <Clock size={10} />
                {formatDate(task.due_date, today)}
              </span>
            )}

            {/* Duration */}
            {task.duration != null && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Timer size={10} />
                {formatDuration(task.duration)}
              </span>
            )}

            {/* Goal link */}
            {goal && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 flex items-center gap-1">
                <Target size={9} />
                {goal.title.length > 18 ? goal.title.slice(0, 18) + '…' : goal.title}
              </span>
            )}
          </div>
        </div>

        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 active:scale-95 transition-all shrink-0 mt-0.5">
          <Trash2 size={14} className="text-gray-200 hover:text-rose-300 transition-colors" />
        </button>
      </div>

      {/* Missed task reschedule banner */}
      {isMissed && (onMoveToToday || onMoveToTomorrow) && (
        <div className="mt-2.5 pt-2.5 border-t border-rose-50 flex items-center gap-2">
          <AlarmClock size={11} className="text-rose-400 shrink-0" />
          <span className="text-xs text-rose-400 flex-1">Looks like this one got missed</span>
          {onMoveToToday && (
            <button
              onClick={onMoveToToday}
              className="text-xs font-semibold text-sky-500 hover:text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full transition-colors"
            >
              Move to Today
            </button>
          )}
          {onMoveToTomorrow && (
            <button
              onClick={onMoveToTomorrow}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full transition-colors"
            >
              Tomorrow
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Meal event detection ─────────────────────────────────────────────────────

const MEAL_EVENT_KEYWORDS = [
  'dinner', 'supper', 'lunch', 'breakfast', 'brunch', 'meal prep', 'meal plan',
  'food prep', 'batch cook', 'taco', 'pizza', 'pasta', 'bbq', 'barbecue',
  'cookout', 'potluck', 'date night', 'family dinner', 'family meal',
  'taco night', 'pizza night', 'cooking', 'cook', 'bake', 'baking',
  'birthday cake', 'birthday dinner', 'holiday meal', 'thanksgiving',
];

function isMealEvent(title: string, category: string): boolean {
  const text = title.toLowerCase();
  if (['Home', 'Kids'].includes(category) && MEAL_EVENT_KEYWORDS.some((kw) => text.includes(kw))) return true;
  return MEAL_EVENT_KEYWORDS.some((kw) => text.includes(kw));
}

// ─── Link Meal Sheet ──────────────────────────────────────────────────────────

function LinkMealSheet({
  event,
  meals,
  onAddMeal,
  onLink,
  onClose,
}: {
  event: Event;
  meals: Meal[];
  onAddMeal: (name: string) => Promise<Meal | null>;
  onLink: (meal: Meal) => Promise<void>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkedMeal, setLinkedMeal] = useState<Meal | null>(
    event.meal_id ? meals.find((m) => m.id === event.meal_id) ?? null : null
  );

  // Suggest a default meal name from the event title
  const suggestedName = event.title
    .replace(/\b(event|night|day|prep|plan|family|weekly|our)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  async function handleCreate() {
    const name = newName.trim() || suggestedName;
    if (!name || adding) return;
    setAdding(true);
    const meal = await onAddMeal(name);
    if (meal) {
      setLinkedMeal(meal);
      setLinking(true);
      await onLink(meal);
      setLinking(false);
    }
    setAdding(false);
  }

  async function handleLink(meal: Meal) {
    setLinking(true);
    setLinkedMeal(meal);
    await onLink(meal);
    setLinking(false);
  }

  const busy = adding || linking;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <UtensilsCrossed size={15} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Add Meal</h2>
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{event.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={13} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Linked meal confirmation */}
          {linkedMeal && (
            <div className="bg-emerald-50 rounded-2xl px-4 py-3 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <Check size={14} className="text-emerald-500 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700">{linkedMeal.name}</p>
              </div>
              <p className="text-xs text-emerald-500 ml-5">
                {linkedMeal.ingredients.length} ingredient{linkedMeal.ingredients.length !== 1 ? 's' : ''} added to your weekly grocery list
              </p>
              {linkedMeal.ingredients.length > 0 && (
                <div className="mt-2 ml-5 flex flex-wrap gap-1">
                  {linkedMeal.ingredients.slice(0, 6).map((ing) => (
                    <span key={ing.name} className="text-xs bg-white text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">
                      {ing.name}
                    </span>
                  ))}
                  {linkedMeal.ingredients.length > 6 && (
                    <span className="text-xs text-emerald-400">+{linkedMeal.ingredients.length - 6} more</span>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-3 w-full py-2 rounded-xl bg-emerald-400 text-white text-sm font-semibold hover:bg-emerald-500 active:scale-[0.98] transition-all"
              >
                Done
              </button>
            </div>
          )}

          {!linkedMeal && (
            <>
              {/* Create new meal */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Create new meal</p>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder={suggestedName || 'e.g. Taco Night…'}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="flex-1 text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-amber-200 transition-colors"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={busy}
                    className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    {busy
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Plus size={17} className="text-white" />}
                  </button>
                </div>
                {adding && (
                  <p className="text-xs text-amber-500 flex items-center gap-1.5 mt-2 px-1">
                    <Sparkles size={11} />
                    Finding ingredients…
                  </p>
                )}
              </div>

              {/* Pick from saved meals */}
              {meals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Or use a saved meal</p>
                  <div className="space-y-2">
                    {meals.map((meal) => (
                      <button
                        key={meal.id}
                        onClick={() => handleLink(meal)}
                        disabled={busy}
                        className="w-full flex items-center gap-3 bg-gray-50 hover:bg-amber-50 rounded-2xl px-4 py-3 text-left transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                          <UtensilsCrossed size={13} className="text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{meal.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {meal.ingredients.slice(0, 3).map((i) => i.name).join(', ')}
                            {meal.ingredients.length > 3 ? ` +${meal.ingredients.length - 3} more` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-amber-500 shrink-0">
                          <ShoppingCart size={11} />
                          Add
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({
  event,
  meals,
  onDelete,
  onUpdate,
  onAddMeal,
  onLinkMeal,
}: {
  event: Event;
  meals: Meal[];
  onDelete: () => void;
  onUpdate: (
  patch: Partial<
    Pick<
      Event,
      'title' |
      'event_date' |
      'event_time' |
      'category' |
      'location' |
      'notes'
    >
  >
) => Promise<void>;
  onAddMeal: (name: string) => Promise<Meal | null>;
  onLinkMeal: (meal: Meal) => Promise<void>;
}) {
  const getCatColor = useCatColor();
  const catCfg = getCatColor(event.category ?? 'Other');
  const [expanded, setExpanded] = useState(false);
  const [showLinkMeal, setShowLinkMeal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const hasExtra = event.location || event.notes;
  const showMealButton = isMealEvent(event.title, event.category ?? 'Other');
  const linkedMeal = event.meal_id ? meals.find((m) => m.id === event.meal_id) : null;

  return (
    <>
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl ${catCfg.bg} flex items-center justify-center shrink-0`}>
            <Calendar size={14} className={catCfg.text} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">{event.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {event.event_time && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  {formatTime(event.event_time)}
                </span>
              )}
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catCfg.bg} ${catCfg.text}`}>
                {event.category}
              </span>
              {linkedMeal && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                  <UtensilsCrossed size={9} />
                  {linkedMeal.name}
                </span>
              )}
            </div>
          </div>
          {hasExtra && (
            <button onClick={() => setExpanded((v) => !v)} className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 active:scale-95 transition-all">
            <Trash2 size={14} className="text-gray-200 hover:text-rose-300 transition-colors" />
          </button>
        </div>

        {/* Meal link row */}
        {showMealButton && (
          <div className="mt-2.5 pt-2.5 border-t border-gray-50 flex items-center justify-between">
            {linkedMeal ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <UtensilsCrossed size={11} className="text-amber-400 shrink-0" />
                <span className="text-xs text-amber-600 truncate">
                  {linkedMeal.name} · {linkedMeal.ingredients.length} ingredients in grocery list
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <ShoppingCart size={11} className="text-gray-300" />
                <span className="text-xs text-gray-400">Groceries not planned yet</span>
              </div>
            )}
            <button
              onClick={() => setShowLinkMeal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-600 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full transition-all shrink-0 ml-2"
            >
              <UtensilsCrossed size={10} />
              {linkedMeal ? 'Change meal' : 'Add meal'}
            </button>
          </div>
        )}

        {expanded && (
          <div className="mt-2 pl-11 space-y-1">
            {event.location && (
              <p className="text-xs text-gray-400 flex items-center gap-1.5">
                <MapPin size={11} /> {event.location}
              </p>
            )}
            {event.notes && <p className="text-xs text-gray-400 leading-relaxed">{event.notes}</p>}
          </div>
        )}
      </div>

      {showLinkMeal && (
        <LinkMealSheet
          event={event}
          meals={meals}
          onAddMeal={onAddMeal}
          onLink={async (meal) => {
            await onLinkMeal(meal);
            setShowLinkMeal(false);
          }}
          onClose={() => setShowLinkMeal(false)}
        />
      )}
    </>
  );
}

// ─── Plan My Day ─────────────────────────────────────────────────────────────

interface PlanItem {
  taskId: string;
  title: string;
  priority: TaskPriority;
  category: TaskCategory;
  duration: number | null;
  time: string;        // HH:MM or ''
  notes: string;
  completed: boolean;
  locked: boolean;     // locked items survive replanning
}

function buildInitialPlan(tasks: Task[], events: Event[], today: string): { items: PlanItem[]; message: string; suggestion: string } {
  const todayEvents = events.filter((e) => e.event_date === today);
  const incomplete = tasks.filter((t) => !t.completed);

  const sorted = [...incomplete].sort((a, b) => {
    const o = { high: 0, medium: 1, low: 2 };
    const aOver = a.due_date && a.due_date <= today ? -1 : 0;
    const bOver = b.due_date && b.due_date <= today ? -1 : 0;
    if (aOver !== bOver) return aOver - bOver;
    return (o[a.priority ?? 'medium']) - (o[b.priority ?? 'medium']);
  });

  const maxPicks = todayEvents.length >= 3 ? 3 : todayEvents.length >= 1 ? 4 : 5;
  const picks = sorted.slice(0, maxPicks);

  const items: PlanItem[] = picks.map((t) => ({
    taskId: t.id,
    title: t.title,
    priority: t.priority ?? 'medium',
    category: (t.category as TaskCategory) ?? 'Other',
    duration: t.duration,
    time: '',
    notes: '',
    completed: false,
    locked: false,
  }));

  let message = "Here's a realistic plan for today — you've got this!";
  if (picks.length === 0) message = "No open tasks right now. Enjoy a breather!";
  else if (todayEvents.length >= 3) message = "You have a busy day ahead, so I kept this short and sweet.";
  else if (picks.some((t) => t.priority === 'high')) message = "There's something important on your list — let's make sure it gets done today.";

  const totalDuration = picks.reduce((s, t) => s + (t.duration ?? 30), 0);
  let suggestion = SUGGESTIONS[0];
  if (todayEvents.length > 2) suggestion = "You have a busy afternoon — try finishing one small task this morning.";
  else if (totalDuration < 60 && picks.length > 0) suggestion = `Your picks today add up to about ${formatDuration(totalDuration)} — very doable!`;
  else if (incomplete.some((t) => t.due_date && t.due_date < today)) suggestion = "A few tasks are overdue. Moving them forward will help you feel caught up.";

  return { items, message, suggestion };
}

function getTomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

// ─── Plan Item Edit Sheet ─────────────────────────────────────────────────────

function PlanItemEditSheet({
  item,
  onSave,
  onClose,
}: {
  item: PlanItem;
  onSave: (patch: Partial<PlanItem>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [time, setTime] = useState(item.time);
  const [priority, setPriority] = useState<TaskPriority>(item.priority);
  const [duration, setDuration] = useState<number | ''>(item.duration ?? '');
  const [category, setCategory] = useState<TaskCategory>(item.category);
  const [notes, setNotes] = useState(item.notes);
  const getCatColor = useCatColor();

  function handleSave() {
    onSave({ title: title.trim() || item.title, time, priority, duration: duration === '' ? null : Number(duration), category, notes });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">Edit Plan Item</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={13} className="text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors"
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Scheduled time (optional)</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Priority</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-xl transition-all ${priority === p ? `${cfg.bg} ${cfg.color} ring-1 ring-current` : 'bg-gray-100 text-gray-400'}`}>
                    <Flag size={9} />{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {TASK_CATEGORIES.map((cat) => {
                const cfg = getCatColor(cat);
                return (
                  <button key={cat} onClick={() => setCategory(cat)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${category === cat ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.border}` : 'bg-gray-100 text-gray-400'}`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Duration</label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map((p) => (
                <button key={p} onClick={() => setDuration(duration === p ? '' : p)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${duration === p ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {formatDuration(p)}
                </button>
              ))}
              <input type="number" min={1} placeholder="Custom min" value={duration === '' ? '' : duration}
                onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-24 text-xs bg-gray-50 rounded-xl px-3 py-1.5 outline-none border border-transparent focus:border-sky-200 transition-colors" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any notes for this task…"
              className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-gray-50 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex-[2] py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 active:scale-[0.98] transition-all">Save changes</button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Item Move Sheet ─────────────────────────────────────────────────────

function PlanItemMoveSheet({
  item,
  onMove,
  onClose,
}: {
  item: PlanItem;
  onMove: (time: string) => void;
  onClose: () => void;
}) {
  const [customTime, setCustomTime] = useState(item.time);

  const quickOptions = [
    { label: 'Early morning', sublabel: 'Before 9 AM', value: '07:00' },
    { label: 'Late morning',  sublabel: '9 AM – noon', value: '10:00' },
    { label: 'Afternoon',     sublabel: 'Noon – 4 PM', value: '13:00' },
    { label: 'Evening',       sublabel: 'After 4 PM',  value: '17:00' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[80dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">Move to…</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={13} className="text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400">Pick a time slot for <span className="font-semibold text-gray-600">{item.title}</span> today</p>

          {/* Quick slots */}
          <div className="grid grid-cols-2 gap-2">
            {quickOptions.map((opt) => (
              <button key={opt.value} onClick={() => { onMove(opt.value); onClose(); }}
                className={`text-left px-3 py-2.5 rounded-xl border transition-all ${item.time === opt.value ? 'border-sky-200 bg-sky-50' : 'border-gray-100 bg-white hover:border-sky-100 hover:bg-sky-50/50'}`}>
                <p className="text-sm font-semibold text-gray-700">{opt.label}</p>
                <p className="text-xs text-gray-400">{opt.sublabel}</p>
              </button>
            ))}
          </div>

          {/* Custom time */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <label className="text-xs font-semibold text-gray-400">Pick exact time</label>
            <div className="flex gap-2">
              <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)}
                className="flex-1 text-sm bg-white rounded-xl px-3 py-2 outline-none border border-gray-200 focus:border-sky-200 transition-colors" />
              <button onClick={() => { if (customTime) { onMove(customTime); onClose(); } }}
                disabled={!customTime}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-sky-600 transition-colors">
                Set
              </button>
            </div>
          </div>

          {/* Clear time */}
          {item.time && (
            <button onClick={() => { onMove(''); onClose(); }}
              className="w-full py-2.5 rounded-xl border border-gray-100 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
              Clear scheduled time
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add to Plan Sheet ────────────────────────────────────────────────────────

function AddToPlanSheet({
  tasks,
  planTaskIds,
  today,
  onAdd,
  onAddNewTask,
  onClose,
}: {
  tasks: Task[];
  planTaskIds: Set<string>;
  today: string;
  onAdd: (task: Task) => void;
  onAddNewTask: (title: string, category: TaskCategory, priority: TaskPriority) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('Other');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const getCatColor = useCatColor();

  const available = tasks.filter((t) => !t.completed && !planTaskIds.has(t.id));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <h3 className="text-sm font-bold text-gray-800">Add to Today's Plan</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><X size={13} className="text-gray-500" /></button>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 mx-5 mt-4 bg-gray-100 rounded-xl p-1 shrink-0">
          <button onClick={() => setTab('existing')} className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${tab === 'existing' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400'}`}>
            From my tasks
          </button>
          <button onClick={() => setTab('new')} className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${tab === 'new' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-400'}`}>
            Create new
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'existing' ? (
            available.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">All your tasks are already in today's plan!</p>
            ) : (
              <div className="space-y-2">
                {available.map((task) => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority ?? 'medium'];
                  const catCfg = getCatColor(task.category ?? 'Other');
                  return (
                    <button key={task.id} onClick={() => { onAdd(task); onClose(); }}
                      className="w-full flex items-center gap-3 bg-white rounded-xl px-3 py-3 border border-gray-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all text-left">
                      <div className={`w-8 h-8 rounded-lg ${catCfg.bg} flex items-center justify-center shrink-0`}>
                        <Flag size={12} className={catCfg.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${priorityCfg.color}`}>{priorityCfg.label}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${catCfg.bg} ${catCfg.text}`}>{task.category}</span>
                          {task.due_date && <span className="text-xs text-gray-400">{formatDate(task.due_date, today)}</span>}
                        </div>
                      </div>
                      <Plus size={16} className="text-sky-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <input autoFocus type="text" placeholder="What needs to get done?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-sky-200 transition-colors" />
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Priority</label>
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    return (
                      <button key={p} onClick={() => setNewPriority(p)}
                        className={`flex-1 flex items-center justify-center gap-1 text-xs font-semibold py-2 rounded-xl transition-all ${newPriority === p ? `${cfg.bg} ${cfg.color} ring-1 ring-current` : 'bg-gray-100 text-gray-400'}`}>
                        <Flag size={9} />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1.5">Category</label>
                <div className="flex gap-1.5 flex-wrap">
                  {TASK_CATEGORIES.map((cat) => {
                    const cfg = getCatColor(cat);
                    return (
                      <button key={cat} onClick={() => setNewCategory(cat)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${newCategory === cat ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.border}` : 'bg-gray-100 text-gray-400'}`}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={() => { if (newTitle.trim()) { onAddNewTask(newTitle.trim(), newCategory, newPriority); onClose(); } }}
                disabled={!newTitle.trim()}
                className="w-full py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold disabled:opacity-40 hover:bg-sky-600 active:scale-[0.98] transition-all">
                Add to today's plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Remove Sheet ─────────────────────────────────────────────────────

function ConfirmRemoveSheet({
  title,
  onRemoveFromPlan,
  onDeleteTask,
  onClose,
}: {
  title: string;
  onRemoveFromPlan: () => void;
  onDeleteTask: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl w-full max-w-md shadow-2xl px-5 pt-6 pb-8 space-y-4">
        <div className="flex justify-center mb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-gray-800">Remove "{title}"?</p>
          <p className="text-xs text-gray-400">It stays in your task list — just not in today's plan.</p>
        </div>
        <div className="space-y-2 pt-1">
          <button onClick={() => { onRemoveFromPlan(); onClose(); }}
            className="w-full py-3 rounded-xl bg-gray-100 text-sm font-semibold text-gray-600 hover:bg-gray-200 active:scale-[0.98] transition-all">
            Remove from today's plan
          </button>
          <button onClick={() => { onDeleteTask(); onClose(); }}
            className="w-full py-3 rounded-xl bg-rose-50 text-sm font-semibold text-rose-500 hover:bg-rose-100 active:scale-[0.98] transition-all">
            Delete task entirely
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-xl border border-gray-100 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan My Day Sheet ────────────────────────────────────────────────────────

function PlanMyDaySheet({
  tasks,
  events,
  today,
  selectedDate,
  onToggleTask,
  onDeleteTask,
  onAddTask,
  onClose,
}: {
  tasks: Task[];
  events: Event[];
  today: string;
  selectedDate: string;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onAddTask: (title: string, dueDate?: string, linkedGoalId?: string, duration?: number, category?: TaskCategory, priority?: TaskPriority) => Promise<void>;
  onClose: () => void;
}) {
  const initial = useMemo(() => buildInitialPlan(tasks, events, selectedDate), [tasks, events, selectedDate]);
  const [items, setItems] = useState<PlanItem[]>(initial.items);
  const [message] = useState(initial.message);
  const [suggestion] = useState(initial.suggestion);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [movingItem, setMovingItem] = useState<PlanItem | null>(null);
  const [removingItem, setRemovingItem] = useState<PlanItem | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const getCatColor = useCatColor();

  const planTaskIds = useMemo(() => new Set(items.map((i) => i.taskId)), [items]);

  const updateItem = useCallback((taskId: string, patch: Partial<PlanItem>) => {
    setItems((prev) => prev.map((i) => i.taskId === taskId ? { ...i, ...patch } : i));
  }, []);

  function moveUp(idx: number) {
    if (idx === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx: number) {
    setItems((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function replan() {
    // Keep locked + completed items; rebuild unlocked/incomplete picks from remaining tasks
    const lockedOrDone = items.filter((i) => i.locked || i.completed);
    const lockedIds = new Set(lockedOrDone.map((i) => i.taskId));
    const available = tasks.filter((t) => !t.completed && !lockedIds.has(t.id));

    const sorted = [...available].sort((a, b) => {
      const o = { high: 0, medium: 1, low: 2 };
      const aOver = a.due_date && a.due_date <= selectedDate ? -1 : 0;
      const bOver = b.due_date && b.due_date <= selectedDate ? -1 : 0;
      if (aOver !== bOver) return aOver - bOver;
      return (o[a.priority ?? 'medium']) - (o[b.priority ?? 'medium']);
    });

    const todayEvents = events.filter((e) => e.event_date === selectedDate);
    const targetTotal = todayEvents.length >= 3 ? 3 : todayEvents.length >= 1 ? 4 : 5;
    const remainingSlots = Math.max(0, targetTotal - lockedOrDone.length);
    const newPicks: PlanItem[] = sorted.slice(0, remainingSlots).map((t) => ({
      taskId: t.id, title: t.title, priority: t.priority ?? 'medium',
      category: (t.category as TaskCategory) ?? 'Other', duration: t.duration,
      time: '', notes: '', completed: false, locked: false,
    }));

    setItems([...lockedOrDone, ...newPicks]);
  }

  function addFromTask(task: Task) {
    setItems((prev) => [...prev, {
      taskId: task.id, title: task.title, priority: task.priority ?? 'medium',
      category: (task.category as TaskCategory) ?? 'Other', duration: task.duration,
      time: '', notes: '', completed: false, locked: false,
    }]);
  }

  async function addNewTask(title: string, category: TaskCategory, priority: TaskPriority) {
    await onAddTask(title, selectedDate, undefined, undefined, category, priority);
    // The new task will appear in the tasks prop on next render; add it optimistically
    const tempId = `temp-${Date.now()}`;
    setItems((prev) => [...prev, { taskId: tempId, title, priority, category, duration: null, time: '', notes: '', completed: false, locked: false }]);
  }

  const todayEvents = events.filter((e) => e.event_date === selectedDate).sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Sparkles size={16} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800">
                  {selectedDate === today ? 'Plan My Day' : `Plan · ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </h2>
                <p className="text-xs text-gray-400">{items.filter((i) => i.completed).length}/{items.length} done</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={replan}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100 hover:bg-sky-100 transition-colors">
                <RefreshCw size={11} /> Replan
              </button>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                <X size={13} className="text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-4">
              {/* LifeBestie message */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
                <p className="text-sm text-amber-800 leading-relaxed font-medium">{message}</p>
              </div>

              {/* Suggestion */}
              <div className="flex items-start gap-2.5 bg-sky-50 border border-sky-100 rounded-xl px-3.5 py-3">
                <Zap size={14} className="text-sky-400 shrink-0 mt-0.5" />
                <p className="text-xs text-sky-700 leading-relaxed">{suggestion}</p>
              </div>

              {/* Today's events */}
              {todayEvents.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">On your calendar</p>
                  <div className="space-y-1.5">
                    {todayEvents.map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2 border border-gray-50">
                        <Calendar size={12} className="text-rose-300 shrink-0" />
                        <span className="text-sm text-gray-600 flex-1 truncate">{e.title}</span>
                        {e.event_time && <span className="text-xs text-gray-400">{formatTime(e.event_time)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {items.length > 0 ? `Today's focus (${items.length})` : 'No items yet'}
                  </p>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const priorityCfg = PRIORITY_CONFIG[item.priority];
                    const catCfg = getCatColor(item.category);
                    return (
                      <div key={item.taskId}
                        className={`bg-white rounded-2xl border shadow-sm transition-all ${
                          item.completed ? 'border-gray-50 opacity-60' : item.locked ? 'border-sky-100' : 'border-gray-100'
                        }`}>
                        {/* Main row */}
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2">
                          {/* Complete toggle */}
                          <button
                            onClick={() => {
                              const newCompleted = !item.completed;
                              updateItem(item.taskId, { completed: newCompleted });
                              onToggleTask(item.taskId, newCompleted);
                            }}
                            className="shrink-0 mt-0.5 transition-transform active:scale-90"
                          >
                            {item.completed
                              ? <CheckCircle2 size={20} className="text-sky-400" />
                              : <Circle size={20} className="text-gray-200 hover:text-sky-300 transition-colors" />}
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium leading-snug ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs font-semibold flex items-center gap-0.5 ${priorityCfg.color}`}>
                                <Flag size={9} />{priorityCfg.label}
                              </span>
                              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${catCfg.bg} ${catCfg.text}`}>
                                {item.category}
                              </span>
                              {item.time && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock size={9} />{formatTime(item.time)}
                                </span>
                              )}
                              {item.duration && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                  <Timer size={9} />{formatDuration(item.duration)}
                                </span>
                              )}
                              {item.locked && (
                                <span className="text-xs text-sky-500 flex items-center gap-1 font-medium">
                                  <Lock size={9} />Locked
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.notes}</p>
                            )}
                          </div>

                          {/* Reorder arrows */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveUp(idx)} disabled={idx === 0}
                              className="p-1 rounded-lg disabled:opacity-20 hover:bg-gray-100 transition-colors">
                              <ArrowUp size={12} className="text-gray-400" />
                            </button>
                            <button onClick={() => moveDown(idx)} disabled={idx === items.length - 1}
                              className="p-1 rounded-lg disabled:opacity-20 hover:bg-gray-100 transition-colors">
                              <ArrowDown size={12} className="text-gray-400" />
                            </button>
                          </div>
                        </div>

                        {/* Action bar */}
                        {!item.completed && (
                          <div className="flex items-center border-t border-gray-50 divide-x divide-gray-50">
                            <button onClick={() => setEditingItem(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-400 hover:text-sky-500 hover:bg-sky-50/50 transition-colors rounded-bl-2xl">
                              <Pencil size={11} />Edit
                            </button>
                            <button onClick={() => setMovingItem(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-400 hover:text-amber-500 hover:bg-amber-50/50 transition-colors">
                              <Clock size={11} />Move
                            </button>
                            <button onClick={() => updateItem(item.taskId, { locked: !item.locked })}
                              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                                item.locked ? 'text-sky-500 hover:text-sky-600 hover:bg-sky-50/50' : 'text-gray-400 hover:text-sky-500 hover:bg-sky-50/50'
                              }`}>
                              {item.locked ? <Lock size={11} /> : <Unlock size={11} />}
                              {item.locked ? 'Locked' : 'Lock'}
                            </button>
                            <button onClick={() => setRemovingItem(item)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-50/50 transition-colors rounded-br-2xl">
                              <X size={11} />Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add to plan button */}
                <button onClick={() => setShowAddSheet(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-sky-200 hover:text-sky-500 hover:bg-sky-50/30 transition-all">
                  <ListPlus size={16} />
                  Add to today's plan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-sheets rendered outside the main sheet so z-index stacks correctly */}
      {editingItem && (
        <PlanItemEditSheet
          item={editingItem}
          onSave={(patch) => updateItem(editingItem.taskId, patch)}
          onClose={() => setEditingItem(null)}
        />
      )}
      {movingItem && (
        <PlanItemMoveSheet
          item={movingItem}
          onMove={(time) => updateItem(movingItem.taskId, { time })}
          onClose={() => setMovingItem(null)}
        />
      )}
      {removingItem && (
        <ConfirmRemoveSheet
          title={removingItem.title}
          onRemoveFromPlan={() => setItems((prev) => prev.filter((i) => i.taskId !== removingItem.taskId))}
          onDeleteTask={() => {
            setItems((prev) => prev.filter((i) => i.taskId !== removingItem.taskId));
            onDeleteTask(removingItem.taskId);
          }}
          onClose={() => setRemovingItem(null)}
        />
      )}
      {showAddSheet && (
        <AddToPlanSheet
          tasks={tasks}
          planTaskIds={planTaskIds}
          today={today}
          onAdd={addFromTask}
          onAddNewTask={addNewTask}
          onClose={() => setShowAddSheet(false)}
        />
      )}
    </>
  );
}

// ─── Today View ───────────────────────────────────────────────────────────────

function TodayView({
  tasks,
  events,
  routines,
  goals,
  meals,
  selectedDate,
  today,
  onToggleTask,
  onDeleteTask,
  onDeleteEvent,
  onUpdateEvent,
  onUpdateTask,
  onOpenPlanMyDay,
  onAddMeal,
  onLinkMealToEvent,
}: {
  tasks: Task[];
  events: Event[];
  routines: Routine[];
  goals: Goal[];
  meals: Meal[];
  selectedDate: string;
  today: string;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvent: (
  id: string,
  patch: Partial<
    Pick<
      Event,
      'title' |
      'event_date' |
      'event_time' |
      'category' |
      'location' |
      'notes'
    >
  >
) => Promise<void>;
  onUpdateTask: PlannerPageProps['onUpdateTask'];
  onOpenPlanMyDay: () => void;
  onAddMeal: PlannerPageProps['onAddMeal'];
  onLinkMealToEvent: PlannerPageProps['onLinkMealToEvent'];
}) {
  const goalMap = new Map(goals.map((g) => [g.id, g]));
  const isToday = selectedDate === today;
  const nextDay = addDays(selectedDate, 1);

  const dayEvents = useMemo(() =>
    events
      .filter((e) => e.event_date === selectedDate)
      .sort((a, b) => (a.event_time || '99').localeCompare(b.event_time || '99')),
    [events, selectedDate]
  );

  const dayTasks = useMemo(() => {
    const byPriority = (a: Task, b: Task) => {
      const o = { high: 0, medium: 1, low: 2 };
      return (o[a.priority ?? 'medium']) - (o[b.priority ?? 'medium']);
    };

    if (isToday) {
      // Today: show overdue, due today, no-due, and completed-today
      const overdue = tasks.filter((t) => !t.completed && t.due_date && t.due_date < today);
      const dueToday = tasks.filter((t) => !t.completed && t.due_date === today);
      const noDue = tasks.filter((t) => !t.completed && !t.due_date);
      const done = tasks.filter((t) => t.completed && t.due_date === today);
      return [
        ...overdue.sort(byPriority),
        ...dueToday.sort(byPriority),
        ...noDue.sort(byPriority),
        ...done,
      ];
    } else {
      // Future/past date: only show tasks due on that date
      return [...tasks.filter((t) => t.due_date === selectedDate)].sort(byPriority);
    }
  }, [tasks, selectedDate, today, isToday]);

  // Progress counts for today's actual tasks
  const completedCount = isToday
    ? tasks.filter((t) => t.completed).length
    : dayTasks.filter((t) => t.completed).length;
  const totalCount = isToday ? tasks.length : dayTasks.length;

  // Routines for the selected weekday
  const dayName = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  const dayRoutines = routines.filter((r) => r.days.includes(dayName));

  const isEmpty = dayEvents.length === 0 && dayTasks.length === 0 && dayRoutines.length === 0;

  return (
    <div className="space-y-5">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {isToday ? 'Today' : formatDate(selectedDate, today)} · {dayName}
          </p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Progress ring */}
        {totalCount > 0 && (
          <div className="flex flex-col items-center">
            <div className="relative w-12 h-12">
              <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                <circle cx="24" cy="24" r="19" fill="none" stroke="#f3f4f6" strokeWidth="4" />
                <circle
                  cx="24" cy="24" r="19" fill="none"
                  stroke="#38bdf8" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 19}`}
                  strokeDashoffset={`${2 * Math.PI * 19 * (1 - completedCount / totalCount)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-600">
                {completedCount}/{totalCount}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">done</p>
          </div>
        )}
      </div>

      {/* Plan My Day button */}
      <button
        onClick={onOpenPlanMyDay}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-sky-500 text-white font-semibold text-sm shadow-sm shadow-sky-200 hover:from-sky-500 hover:to-sky-600 active:scale-[0.98] transition-all"
      >
        <Sparkles size={16} />
        {isToday ? 'Plan My Day' : `Plan ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
      </button>

      {isEmpty ? (
        <div className="bg-white rounded-2xl px-4 py-10 text-center shadow-sm border border-gray-50">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Calendar size={20} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-400">
            {isToday ? 'Nothing scheduled for today' : 'Nothing on this day'}
          </p>
          <p className="text-xs text-gray-300 mt-1">Add a task or event to get started</p>
        </div>
      ) : (
        <>
          {/* Day routines */}
          {dayRoutines.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Routines</p>
              <div className="space-y-2">
                {dayRoutines.map((r) => (
                  <div key={r.name} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <Repeat size={14} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-700 capitalize">{r.name}</p>
                      {r.time && <p className="text-xs text-gray-400">{formatTime(r.time)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Day events */}
          {dayEvents.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Events</p>
              <div className="space-y-2">
                {dayEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    meals={meals}
                   onDelete={() => onDeleteEvent(e.id)}
                    onAddMeal={onAddMeal}
                    onLinkMeal={(meal) => onLinkMealToEvent(e.id, meal)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Day tasks */}
          {dayTasks.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Tasks</p>
              <div className="space-y-2">
                {dayTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    goal={task.linked_goal_id ? goalMap.get(task.linked_goal_id) : undefined}
                    onToggle={() => onToggleTask(task.id, !task.completed)}
                    onDelete={() => onDeleteTask(task.id)}
                    onMoveToToday={!task.completed && task.due_date && task.due_date < today
                      ? () => onUpdateTask(task.id, { due_date: today }) : undefined}
                    onMoveToTomorrow={!task.completed && task.due_date && task.due_date < today
                      ? () => onUpdateTask(task.id, { due_date: nextDay }) : undefined}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── All Tasks View ───────────────────────────────────────────────────────────

function AllTasksView({
  tasks,
  goals,
  today,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
}: {
  tasks: Task[];
  goals: Goal[];
  today: string;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: PlannerPageProps['onUpdateTask'];
}) {
  const [filter, setFilter] = useState<'all' | TaskPriority>('all');
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const filtered = useMemo(() => {
    const base = filter === 'all' ? tasks : tasks.filter((t) => (t.priority ?? 'medium') === filter);
    return [...base].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const o = { high: 0, medium: 1, low: 2 };
      return (o[a.priority ?? 'medium']) - (o[b.priority ?? 'medium']);
    });
  }, [tasks, filter]);

  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {tasks.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-50 shadow-sm">
            <p className="text-lg font-bold text-gray-800">{tasks.length}</p>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-50 shadow-sm">
            <p className="text-lg font-bold text-sky-500">{doneCount}</p>
            <p className="text-xs text-gray-400">Done</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-2.5 text-center border border-gray-50 shadow-sm">
            <p className="text-lg font-bold text-rose-500">{tasks.filter((t) => !t.completed && t.due_date && t.due_date < today).length}</p>
            <p className="text-xs text-gray-400">Overdue</p>
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['all', 'high', 'medium', 'low'] as const).map((f) => {
          const cfg = f === 'all' ? null : PRIORITY_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                filter === f
                  ? f === 'all' ? 'bg-gray-700 text-white' : `${cfg!.bg} ${cfg!.color} ring-1 ring-current`
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {f === 'all' ? 'All tasks' : cfg!.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl px-4 py-10 text-center shadow-sm border border-gray-50">
          <p className="text-sm text-gray-400">{tasks.length === 0 ? 'No tasks yet — add one above!' : 'No tasks match this filter.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              goal={task.linked_goal_id ? goalMap.get(task.linked_goal_id) : undefined}
              onToggle={() => onToggleTask(task.id, !task.completed)}
              onDelete={() => onDeleteTask(task.id)}
              onMoveToToday={!task.completed && task.due_date && task.due_date < today ? () => onUpdateTask(task.id, { due_date: today }) : undefined}
              onMoveToTomorrow={!task.completed && task.due_date && task.due_date < today ? () => onUpdateTask(task.id, { due_date: getTomorrow() }) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── All Events View ──────────────────────────────────────────────────────────

function AllEventsView({
  events,
  routines,
  meals,
  today,
  onDeleteEvent,
  onDeleteRoutine,
  onAddMeal,
  onLinkMealToEvent,
}: {
  events: Event[];
  routines: Routine[];
  meals: Meal[];
  today: string;
  onDeleteEvent: (id: string) => void;
  onDeleteRoutine: (name: string) => void;
  onAddMeal: PlannerPageProps['onAddMeal'];
  onLinkMealToEvent: PlannerPageProps['onLinkMealToEvent'];
}) {
  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const dc = a.event_date.localeCompare(b.event_date);
      return dc !== 0 ? dc : (a.event_time || '').localeCompare(b.event_time || '');
    });
    const g: Record<string, Event[]> = {};
    for (const e of sorted) {
      if (!g[e.event_date]) g[e.event_date] = [];
      g[e.event_date].push(e);
    }
    return g;
  }, [events]);

  const isEmpty = events.length === 0 && routines.length === 0;

  return (
    <div className="space-y-5">
      {isEmpty ? (
        <div className="bg-white rounded-2xl px-4 py-10 text-center shadow-sm border border-gray-50">
          <p className="text-sm text-gray-400">No events yet — add one above!</p>
        </div>
      ) : (
        <>
          {/* Routines */}
          {routines.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Routines</p>
              <div className="space-y-2">
                {routines.map((r) => (
                  <div key={r.name} className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Repeat size={14} className="text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 capitalize">{r.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatTime(r.time)} · {r.days.map((d) => d.slice(0, 3)).join(', ')}</p>
                      {r.tasks.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {r.tasks.map((t) => <p key={t} className="text-xs text-gray-400">· {t}</p>)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => onDeleteRoutine(r.name)} className="p-1.5 rounded-lg hover:bg-red-50 transition-all mt-0.5">
                      <Trash2 size={14} className="text-gray-200 hover:text-rose-300 transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Events by date */}
          {Object.entries(grouped).map(([date, dateEvents]) => (
            <section key={date}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${date < today ? 'text-gray-300' : date === today ? 'text-sky-500' : 'text-gray-400'}`}>
                {formatDate(date, today)}
              </p>
              <div className="space-y-2">
                {dateEvents.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    meals={meals}
                    onDelete={() => onDeleteEvent(e.id)}
                    onAddMeal={onAddMeal}
                    onLinkMeal={(meal) => onLinkMealToEvent(e.id, meal)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlannerPage({
  tasks,
  events,
  routines,
  goals,
  meals,
  onAddEvent,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteEvent,
  onUpdateEvent,
  onDeleteRoutine,
  onAddMeal,
  onLinkMealToEvent,
  tomorrowReminders,
  tomorrowRemindersLoading,
  onDismissTomorrowReminder,
  onRefreshTomorrowReminders,
}: PlannerPageProps) {
  const today = getToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<PageView>('today');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showPlanMyDay, setShowPlanMyDay] = useState(false);
  const [showCustomizeColors, setShowCustomizeColors] = useState(false);

  const { colorMap, getColor, setColor } = useCategoryColors();

  // Seed defaults on first load
  useMemo(() => { seedDefaultColors(); }, []);

  const overdueCount = tasks.filter((t) => !t.completed && t.due_date && t.due_date < today).length;
  const selectedEventCount = events.filter((e) => e.event_date === selectedDate).length;
  const selectedTaskCount = tasks.filter((t) => !t.completed && t.due_date === selectedDate).length;

  // Build per-date color dot arrays for the calendar
  const dateColorDots = useMemo(() => {
    const map = new Map<string, string[]>();
    function addDot(date: string, hex: string) {
      const arr = map.get(date) ?? [];
      if (!arr.includes(hex)) arr.push(hex);
      map.set(date, arr);
    }
    for (const e of events) addDot(e.event_date, getColor(e.category ?? 'Other').hex);
    for (const t of tasks) { if (t.due_date) addDot(t.due_date, getColor(t.category ?? 'Other').hex); }
    return map;
  }, [events, tasks, getColor]);

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setView('today'); // always jump to day view when a date is picked
  }

  return (
    <CatColorCtx.Provider value={getColor}>
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Planner</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowAddTask((v) => !v); setShowAddEvent(false); }}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full shadow-sm active:scale-95 transition-all ${
              showAddTask ? 'bg-sky-500 text-white' : 'bg-sky-50 text-sky-600 border border-sky-100'
            }`}
          >
            <Plus size={14} />
            Task
          </button>
          <button
            onClick={() => { setShowAddEvent((v) => !v); setShowAddTask(false); }}
            className={`flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-full shadow-sm active:scale-95 transition-all ${
              showAddEvent ? 'bg-rose-400 text-white' : 'bg-rose-50 text-rose-500 border border-rose-100'
            }`}
          >
            <Plus size={14} />
            Event
          </button>
        </div>
      </div>

      {/* Add forms */}
      {showAddTask && (
        <div className="mb-4">
          <AddTaskForm
            goals={goals}
            defaultDueDate={selectedDate}
            onAdd={onAddTask}
            onCancel={() => setShowAddTask(false)}
          />
        </div>
      )}
      {showAddEvent && (
        <div className="mb-4">
          <AddEventForm onAdd={onAddEvent} onCancel={() => setShowAddEvent(false)} />
        </div>
      )}

      {/* Prepare for Tomorrow */}
      {(tomorrowRemindersLoading || tomorrowReminders.length > 0) && (
        <PrepareForTomorrowBanner
          reminders={tomorrowReminders}
          loading={tomorrowRemindersLoading}
          onDismiss={onDismissTomorrowReminder}
          onRefresh={onRefreshTomorrowReminders}
          compact
        />
      )}

      {/* Calendar */}
      <MiniCalendar
        selectedDate={selectedDate}
        today={today}
        dateColorDots={dateColorDots}
        onSelect={handleSelectDate}
        onCustomizeColors={() => setShowCustomizeColors(true)}
      />

      {/* Tab bar */}
      <div className="flex bg-gray-100 rounded-2xl p-1 gap-1 mb-5">
        {([
          { key: 'today', label: 'Day', badge: selectedEventCount + selectedTaskCount },
          { key: 'tasks', label: 'Tasks', badge: overdueCount },
          { key: 'events', label: 'Events', badge: 0 },
        ] as { key: PageView; label: string; badge: number }[]).map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl transition-all ${
              view === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {label}
            {badge > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                view === key
                  ? key === 'tasks' && overdueCount > 0 ? 'bg-rose-100 text-rose-500' : 'bg-sky-100 text-sky-500'
                  : 'bg-gray-200 text-gray-400'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Views */}
      {view === 'today' && (
        <TodayView
          tasks={tasks}
          events={events}
          routines={routines}
          goals={goals}
          meals={meals}
          selectedDate={selectedDate}
          today={today}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onDeleteEvent={onDeleteEvent}
          onUpdateEvent={onUpdateEvent}
          onUpdateTask={onUpdateTask}
onOpenPlanMyDay={() => setShowPlanMyDay(true)}
        />
      )}
      {view === 'tasks' && (
        <AllTasksView
          tasks={tasks}
          goals={goals}
          today={today}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
        />
      )}
      {view === 'events' && (
        <AllEventsView
          events={events}
          routines={routines}
          meals={meals}
          today={today}
          onDeleteEvent={onDeleteEvent}
          onDeleteRoutine={onDeleteRoutine}
          onAddMeal={onAddMeal}
          onLinkMealToEvent={onLinkMealToEvent}
        />
      )}

      {/* Plan My Day sheet */}
      {showPlanMyDay && (
        <PlanMyDaySheet
          tasks={tasks}
          events={events}
          today={today}
          selectedDate={selectedDate}
          onToggleTask={onToggleTask}
          onDeleteTask={onDeleteTask}
          onAddTask={onAddTask}
          onClose={() => setShowPlanMyDay(false)}
        />
      )}

      {/* Customize Colors sheet */}
      {showCustomizeColors && (
        <CustomizeColorsSheet
          colorMap={colorMap}
          onSetColor={setColor}
          onClose={() => setShowCustomizeColors(false)}
        />
      )}
    </div>
    </CatColorCtx.Provider>
  );
}
