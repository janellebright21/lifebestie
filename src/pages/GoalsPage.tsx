import { useState } from 'react';
import {
  Plus, Target, ChevronRight, X, Check, Pencil, Trash2,
  Calendar, Flag, CheckCircle2, Circle, Timer, ListTodo,
} from 'lucide-react';
import {
  Goal, Task, GoalCategory, GoalPriority,
  GOAL_CATEGORIES, GOAL_PRIORITIES,
} from '../lib/supabase';

interface GoalsPageProps {
  goals: Goal[];
  tasks: Task[];
  loading: boolean;
  onAdd: (fields: { title: string; category: GoalCategory; priority: GoalPriority; deadline?: string }) => Promise<Goal | null>;
  onUpdate: (id: string, patch: Partial<Pick<Goal, 'title' | 'category' | 'priority' | 'deadline' | 'progress' | 'linked_tasks'>>) => Promise<void>;
  onSetProgress: (id: string, progress: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddTask: (title: string, dueDate?: string, linkedGoalId?: string, duration?: number) => Promise<void>;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<GoalCategory, { bg: string; text: string; dot: string; light: string; bar: string }> = {
  health:   { bg: 'bg-emerald-500', text: 'text-emerald-700', dot: 'bg-emerald-400', light: 'bg-emerald-50', bar: 'bg-emerald-400' },
  work:     { bg: 'bg-sky-500',     text: 'text-sky-700',     dot: 'bg-sky-400',     light: 'bg-sky-50',     bar: 'bg-sky-400'     },
  personal: { bg: 'bg-amber-500',   text: 'text-amber-700',   dot: 'bg-amber-400',   light: 'bg-amber-50',   bar: 'bg-amber-400'   },
  finance:  { bg: 'bg-teal-500',    text: 'text-teal-700',    dot: 'bg-teal-400',    light: 'bg-teal-50',    bar: 'bg-teal-400'    },
};

const PRIORITY_STYLES: Record<GoalPriority, { label: string; text: string; bg: string }> = {
  low:    { label: 'Low',    text: 'text-gray-500',  bg: 'bg-gray-100'  },
  medium: { label: 'Medium', text: 'text-amber-600', bg: 'bg-amber-50'  },
  high:   { label: 'High',   text: 'text-rose-600',  bg: 'bg-rose-50'   },
};

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  health: 'Health', work: 'Work', personal: 'Personal', finance: 'Finance',
};

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Goal form ────────────────────────────────────────────────────────────────

function GoalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Goal;
  onSave: (fields: { title: string; category: GoalCategory; priority: GoalPriority; deadline?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<GoalCategory>(initial?.category ?? 'personal');
  const [priority, setPriority] = useState<GoalPriority>(initial?.priority ?? 'medium');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({ title: title.trim(), category, priority, deadline: deadline || undefined });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-2" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800">{initial ? 'Edit Goal' : 'New Goal'}</h2>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          placeholder="What do you want to achieve?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-gray-200 transition-colors"
        />

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
          <div className="flex gap-2 flex-wrap">
            {GOAL_CATEGORIES.map((cat) => {
              const s = CATEGORY_STYLES[cat];
              return (
                <button key={cat} onClick={() => setCategory(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${category === cat ? `${s.bg} text-white shadow-sm` : `${s.light} ${s.text}`}`}>
                  {CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Priority</p>
          <div className="flex gap-2">
            {GOAL_PRIORITIES.map((p) => {
              const s = PRIORITY_STYLES[p];
              return (
                <button key={p} onClick={() => setPriority(p)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-all ${priority === p ? `${s.bg} ${s.text} ring-1 ring-current` : 'bg-gray-50 text-gray-400'}`}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Deadline <span className="normal-case font-normal">(optional)</span>
          </p>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-gray-200 transition-colors text-gray-700"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="w-full py-3.5 rounded-2xl bg-gray-800 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Goal'}
        </button>
      </div>
    </div>
  );
}

// ─── Progress sheet ───────────────────────────────────────────────────────────

function ProgressSheet({ goal, onSave, onClose }: { goal: Goal; onSave: (p: number) => Promise<void>; onClose: () => void }) {
  const [value, setValue] = useState(goal.progress);
  const [saving, setSaving] = useState(false);
  const cat = CATEGORY_STYLES[goal.category];

  async function handleSave() {
    setSaving(true);
    await onSave(value);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">Update Progress</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">{goal.title}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 py-2">
          <span className={`text-5xl font-black ${cat.text}`}>{value}%</span>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${cat.bg} rounded-full transition-all duration-200`} style={{ width: `${value}%` }} />
          </div>
        </div>

        <input
          type="range" min={0} max={100} step={1} value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full accent-gray-800 h-1"
        />

        <div className="flex justify-between">
          {[0, 25, 50, 75, 100].map((m) => (
            <button key={m} onClick={() => setValue(m)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${value === m ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {m}%
            </button>
          ))}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-gray-800 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform">
          {saving ? 'Saving…' : 'Save Progress'}
        </button>
      </div>
    </div>
  );
}

// ─── Add Task to Goal sheet ───────────────────────────────────────────────────

function AddTaskSheet({
  goalId,
  goalTitle,
  onAdd,
  onClose,
}: {
  goalId: string;
  goalTitle: string;
  onAdd: (title: string, dueDate?: string, linkedGoalId?: string, duration?: number) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

  async function handleAdd() {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd(title.trim(), dueDate || undefined, goalId, duration !== '' ? Number(duration) : undefined);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-2" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">New Task</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[240px]">Linked to: {goalTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="w-full text-sm bg-gray-50 rounded-xl px-4 py-3 outline-none border border-transparent focus:border-gray-200 transition-colors"
        />

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1">Due date <span className="font-normal">(optional)</span></label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full text-sm bg-gray-50 rounded-xl px-4 py-2.5 outline-none border border-transparent focus:border-gray-200 transition-colors text-gray-700"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-400 block mb-1.5">Duration <span className="font-normal">(optional)</span></label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setDuration(duration === p ? '' : p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${duration === p ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {formatDuration(p)}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={!title.trim() || saving}
          className="w-full py-3.5 rounded-2xl bg-gray-800 text-white text-sm font-bold disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  linkedTasks,
  onEdit,
  onProgress,
  onDelete,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: {
  goal: Goal;
  linkedTasks: Task[];
  onEdit: () => void;
  onProgress: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORY_STYLES[goal.category];
  const pri = PRIORITY_STYLES[goal.priority];
  const isDone = goal.progress === 100;

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = goal.deadline && goal.deadline < today && !isDone;

  const deadlineLabel = goal.deadline
    ? new Date(goal.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const completedTasks = linkedTasks.filter((t) => t.completed).length;
  const totalTasks = linkedTasks.length;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden transition-all ${isDone ? 'opacity-75' : ''}`}>
      <div className={`h-1 w-full ${cat.bg}`} />

      <div className="px-4 pt-3.5 pb-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat.light} ${cat.text}`}>
                {CATEGORY_LABELS[goal.category]}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pri.bg} ${pri.text}`}>
                <Flag size={9} className="inline mr-0.5 -mt-px" />
                {pri.label}
              </span>
              {totalTasks > 0 && (
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <ListTodo size={10} />
                  {completedTasks}/{totalTasks}
                </span>
              )}
            </div>
            <h3 className={`text-sm font-bold leading-snug ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {goal.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors active:scale-95">
              <Pencil size={13} />
            </button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-50 text-gray-300 hover:text-rose-400 transition-colors active:scale-95">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Deadline */}
        {deadlineLabel && (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-rose-500' : 'text-gray-400'}`}>
            <Calendar size={11} />
            <span>{isOverdue ? 'Overdue · ' : ''}{deadlineLabel}</span>
          </div>
        )}

        {/* Progress bar */}
        <button onClick={onProgress} className="w-full group text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-500">Progress</span>
            <span className={`text-xs font-bold ${isDone ? cat.text : 'text-gray-500'}`}>
              {isDone
                ? <span className="flex items-center gap-1"><Check size={11} /> Done</span>
                : `${goal.progress}%`}
            </span>
          </div>
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`absolute inset-y-0 left-0 ${cat.bar} rounded-full transition-all duration-500`}
              style={{ width: `${goal.progress}%` }} />
          </div>
          <p className="text-xs text-gray-300 mt-1 group-hover:text-gray-400 transition-colors flex items-center gap-1">
            <ChevronRight size={10} /> Tap to update manually
          </p>
        </button>

        {/* Tasks toggle */}
        <div className="border-t border-gray-50 pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ListTodo size={13} />
              {totalTasks === 0 ? 'Tasks' : `${totalTasks} task${totalTasks !== 1 ? 's' : ''}`}
              <ChevronRight size={11} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            <button
              onClick={onAddTask}
              className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full transition-all active:scale-95 ${cat.light} ${cat.text}`}
            >
              <Plus size={11} />
              Add Task
            </button>
          </div>

          {/* Expanded task list */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {totalTasks === 0 ? (
                <p className="text-xs text-gray-300 text-center py-3">No tasks yet — add one above</p>
              ) : (
                linkedTasks.map((task) => {
                  const isTaskOverdue = task.due_date && task.due_date < today && !task.completed;
                  return (
                    <div key={task.id} className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition-opacity ${cat.light} ${task.completed ? 'opacity-50' : ''}`}>
                      <button onClick={() => onToggleTask(task.id, !task.completed)} className="shrink-0 mt-0.5">
                        {task.completed
                          ? <CheckCircle2 size={16} className={cat.text} />
                          : <Circle size={16} className="text-gray-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${task.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.due_date && (
                            <span className={`text-xs ${isTaskOverdue ? 'text-rose-400' : 'text-gray-400'} flex items-center gap-1`}>
                              <Calendar size={9} />
                              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {task.duration != null && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Timer size={9} />
                              {formatDuration(task.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="shrink-0 p-1 rounded-lg hover:bg-white/60 text-gray-300 hover:text-rose-400 active:scale-95 transition-all mt-0.5"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterCategory = GoalCategory | 'all';

export default function GoalsPage({
  goals, tasks, loading,
  onAdd, onUpdate, onSetProgress, onDelete,
  onAddTask, onToggleTask, onDeleteTask,
}: GoalsPageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [addingTaskFor, setAddingTaskFor] = useState<Goal | null>(null);
  const [filter, setFilter] = useState<FilterCategory>('all');

  async function handleAdd(fields: { title: string; category: GoalCategory; priority: GoalPriority; deadline?: string }) {
    await onAdd(fields);
    setShowAdd(false);
  }

  async function handleEdit(fields: { title: string; category: GoalCategory; priority: GoalPriority; deadline?: string }) {
    if (!editingGoal) return;
    await onUpdate(editingGoal.id, { ...fields, deadline: fields.deadline ?? null });
    setEditingGoal(null);
  }

  async function handleProgress(progress: number) {
    if (!progressGoal) return;
    await onSetProgress(progressGoal.id, progress);
  }

  const filtered = filter === 'all' ? goals : goals.filter((g) => g.category === filter);
  const activeGoals = filtered.filter((g) => g.progress < 100);
  const doneGoals = filtered.filter((g) => g.progress === 100);

  const totalGoals = goals.length;
  const doneCount = goals.filter((g) => g.progress === 100).length;
  const avgProgress = totalGoals > 0 ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / totalGoals) : 0;

  const categoryFilters: { id: FilterCategory; label: string }[] = [
    { id: 'all', label: 'All' },
    ...GOAL_CATEGORIES.map((c) => ({ id: c as FilterCategory, label: CATEGORY_LABELS[c] })),
  ];

  function getLinkedTasks(goal: Goal): Task[] {
    return tasks.filter((t) => t.linked_goal_id === goal.id);
  }

  return (
    <div className="px-4 pt-6 pb-28 space-y-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Goals</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalGoals === 0 ? 'No goals yet' : `${doneCount} of ${totalGoals} complete · ${avgProgress}% avg`}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-gray-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm active:scale-95 transition-transform"
        >
          <Plus size={13} />
          New Goal
        </button>
      </div>

      {/* Summary */}
      {totalGoals > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl px-3 py-3 border border-gray-50 shadow-sm text-center">
            <p className="text-2xl font-black text-gray-800">{totalGoals}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Total</p>
          </div>
          <div className="bg-white rounded-2xl px-3 py-3 border border-gray-50 shadow-sm text-center">
            <p className="text-2xl font-black text-emerald-500">{doneCount}</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Done</p>
          </div>
          <div className="bg-white rounded-2xl px-3 py-3 border border-gray-50 shadow-sm text-center">
            <p className="text-2xl font-black text-amber-500">{avgProgress}%</p>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Avg</p>
          </div>
        </div>
      )}

      {/* Category filter */}
      {totalGoals > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {categoryFilters.map(({ id, label }) => {
            const isActive = filter === id;
            const catStyle = id !== 'all' ? CATEGORY_STYLES[id as GoalCategory] : null;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                  isActive
                    ? catStyle ? `${catStyle.bg} text-white` : 'bg-gray-800 text-white'
                    : catStyle ? `${catStyle.light} ${catStyle.text}` : 'bg-gray-100 text-gray-500'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-50 overflow-hidden">
              <div className="h-1 bg-gray-100 animate-pulse" />
              <div className="px-4 py-4 space-y-2.5">
                <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/3" />
                <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
                <div className="h-2 bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active goals */}
      {!loading && activeGoals.length > 0 && (
        <div className="space-y-3">
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              linkedTasks={getLinkedTasks(goal)}
              onEdit={() => setEditingGoal(goal)}
              onProgress={() => setProgressGoal(goal)}
              onDelete={() => onDelete(goal.id)}
              onAddTask={() => setAddingTaskFor(goal)}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Completed goals */}
      {!loading && doneGoals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Check size={13} className="text-emerald-400" />
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Completed</h2>
          </div>
          {doneGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              linkedTasks={getLinkedTasks(goal)}
              onEdit={() => setEditingGoal(goal)}
              onProgress={() => setProgressGoal(goal)}
              onDelete={() => onDelete(goal.id)}
              onAddTask={() => setAddingTaskFor(goal)}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <Target size={28} className="text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-400">
              {filter === 'all' ? 'No goals yet' : `No ${CATEGORY_LABELS[filter as GoalCategory]} goals`}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {filter === 'all' ? 'Tap "New Goal" to get started' : 'Switch category or add a new goal'}
            </p>
          </div>
          {filter === 'all' && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-gray-800 text-white text-sm font-bold px-5 py-2.5 rounded-2xl active:scale-95 transition-transform"
            >
              <Plus size={14} />
              Add Your First Goal
            </button>
          )}
        </div>
      )}

      {/* Sheets */}
      {showAdd && <GoalForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}
      {editingGoal && <GoalForm initial={editingGoal} onSave={handleEdit} onCancel={() => setEditingGoal(null)} />}
      {progressGoal && <ProgressSheet goal={progressGoal} onSave={handleProgress} onClose={() => setProgressGoal(null)} />}
      {addingTaskFor && (
        <AddTaskSheet
          goalId={addingTaskFor.id}
          goalTitle={addingTaskFor.title}
          onAdd={onAddTask}
          onClose={() => setAddingTaskFor(null)}
        />
      )}
    </div>
  );
}
