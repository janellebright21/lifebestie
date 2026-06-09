import { CheckCircle2, Circle, Sparkles, Plus, Calendar, ShoppingCart, X, Pencil, Sunrise, UtensilsCrossed } from 'lucide-react';
import { Task, Event, UserMemory, GroceryHabit, GroceryCategory, Goal, getLowStockSuggestions, Meal } from '../lib/supabase';
import { PatternCandidate } from '../hooks/useUserMemory';
import { DailyPlan } from '../hooks/useDailyPlanner';
import { TabName } from '../components/BottomNav';
import LowStockBanner from '../components/LowStockBanner';
import DailyPlanCard from '../components/DailyPlanCard';
import PrepareForTomorrowBanner from '../components/PrepareForTomorrowBanner';

interface HomePageProps {
  tasks: Task[];
  events: Event[];
  meals: Meal[];
  memory: UserMemory | null;
  habits: GroceryHabit[];
  goals: Goal[];
  dailyPlan: DailyPlan | null;
  dailyPlanLoading: boolean;
  dailyPlanGenerating: boolean;
  pendingRoutineSuggestions: PatternCandidate[];
  onToggleTask: (id: string, completed: boolean) => void;
  onTabChange: (tab: TabName) => void;
  onOpenRoutineSheet: (candidate: PatternCandidate) => void;
  onDismissRoutine: (taskTitle: string) => void;
  getProactiveSuggestions: () => string[];
  onAddGrocery: (name: string, category: GroceryCategory) => Promise<void>;
  onGeneratePlan: () => void;
  onTogglePlanTask: (taskId: string, completed: boolean) => void;
  onDismissPlanAdaptation: (id: string) => void;
  tomorrowReminders: string[];
  tomorrowRemindersLoading: boolean;
  onDismissTomorrowReminder: (reminder: string) => void;
  onRefreshTomorrowReminders: () => void;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const FALLBACK_SUGGESTIONS = [
  "Breaking big tasks into smaller steps makes everything feel more manageable.",
  "Don't forget to drink water between tasks. Small self-care moments matter.",
  "Consider batching your errands to save time and energy.",
  "You're doing better than you think. One task at a time.",
];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m ?? 0).padStart(2, '0')} ${ampm}`;
}

const PREP_CHECKLIST = [
  "Review tomorrow's schedule",
  'Set out clothes or bags',
  'Prep lunch or snacks',
  'Check dinner plan',
];

function TomorrowPrepCard({
  tomorrowEvents,
  tomorrowMeals,
}: {
  tomorrowEvents: Event[];
  tomorrowMeals: Meal[];
}) {
  const hasContent = tomorrowEvents.length > 0 || tomorrowMeals.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50">
        <div className="w-7 h-7 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
          <Sunrise size={14} className="text-sky-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Tomorrow Prep</p>
          <p className="text-xs text-gray-400">Get ahead for tomorrow</p>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {tomorrowEvents.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-sky-600 uppercase tracking-wide mb-1.5">
              On the calendar
            </p>
            <div className="space-y-1">
              {tomorrowEvents.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <Calendar size={11} className="text-sky-400 shrink-0" />
                  <span className="text-xs text-gray-700 font-medium">{e.title}</span>
                  {e.event_time && (
                    <span className="text-xs text-sky-500 font-semibold ml-auto shrink-0">
                      {formatTime(e.event_time)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tomorrowMeals.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">
              Meals planned
            </p>
            <div className="space-y-1">
              {tomorrowMeals.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <UtensilsCrossed size={11} className="text-emerald-400 shrink-0" />
                  <span className="text-xs text-gray-700 font-medium">{m.name}</span>
                  {m.meal_type && (
                    <span className="text-xs text-emerald-500 ml-auto shrink-0">{m.meal_type}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          {hasContent && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Prep checklist
            </p>
          )}
          <div className="space-y-1.5">
            {PREP_CHECKLIST.map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                <span className="text-xs text-gray-600">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage({
  tasks,
  events,
  meals,
  memory,
  habits,
  goals,
  dailyPlan,
  dailyPlanLoading,
  dailyPlanGenerating,
  pendingRoutineSuggestions,
  onToggleTask,
  onTabChange,
  onOpenRoutineSheet,
  onDismissRoutine,
  getProactiveSuggestions,
  onAddGrocery,
  onGeneratePlan,
  onTogglePlanTask,
  onDismissPlanAdaptation,
  tomorrowReminders,
  tomorrowRemindersLoading,
  onDismissTomorrowReminder,
  onRefreshTomorrowReminders,
}: HomePageProps) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrowDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayTasks = tasks.slice(0, 4);
  const todayEvents = events
    .filter((e) => e.event_date === today)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));

  const tomorrowEvents = events
    .filter((e) => e.event_date === tomorrowDate)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
  const tomorrowMeals = meals.filter((m) => m.meal_date === tomorrowDate);

  const proactive = getProactiveSuggestions();
  const suggestion =
    proactive.length > 0
      ? proactive[0]
      : FALLBACK_SUGGESTIONS[new Date().getDay() % FALLBACK_SUGGESTIONS.length];

  const todayRoutines = memory?.routines.filter((r) => r.days.includes(todayName)) ?? [];
  const topSuggestion = pendingRoutineSuggestions[0] ?? null;
  const lowStockSuggestions = getLowStockSuggestions(habits, 3);

  const hasPlanContext = goals.length > 0 || tasks.filter((t) => !t.completed).length > 0;
  const showPlanCard = dailyPlan || dailyPlanLoading || dailyPlanGenerating || hasPlanContext;

  return (
    <div className="px-4 pt-6 pb-28 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div>
        <p className="text-xs font-medium text-rose-300 uppercase tracking-widest mb-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold text-gray-800 leading-tight">
          {getGreeting()}, Mama 💛
        </h1>
        <p className="text-sm text-gray-400 mt-1">Here's what's on your plate today.</p>
      </div>

      {/* Routine Suggestion Banner */}
      {topSuggestion && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 animate-fade-in">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1.5">
            Pattern noticed ✨
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            You've added{' '}
            <span className="font-semibold text-gray-800">
              "{capitalize(topSuggestion.taskTitle)}"
            </span>{' '}
            across {topSuggestion.count} different days. Save it as a{' '}
            <span className="font-semibold">{topSuggestion.timeOfDay}</span> routine?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onOpenRoutineSheet(topSuggestion)}
              className="flex items-center gap-1.5 bg-amber-400 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              <Pencil size={12} />
              Set it up
            </button>
            <button
              onClick={() => onDismissRoutine(topSuggestion.taskTitle)}
              className="flex items-center gap-1.5 bg-white text-gray-500 text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 active:scale-95 transition-transform"
            >
              <X size={12} />
              Not now
            </button>
          </div>
        </div>
      )}

      {/* Low Stock Banner */}
      {lowStockSuggestions.length > 0 && (
        <LowStockBanner
          suggestions={lowStockSuggestions}
          onAddToList={onAddGrocery}
        />
      )}

      {/* Prepare for Tomorrow (AI reminders) */}
      {(tomorrowRemindersLoading || tomorrowReminders.length > 0) && (
        <PrepareForTomorrowBanner
          reminders={tomorrowReminders}
          loading={tomorrowRemindersLoading}
          onDismiss={onDismissTomorrowReminder}
          onRefresh={onRefreshTomorrowReminders}
        />
      )}

      {/* Tomorrow Prep card */}
      <TomorrowPrepCard
        tomorrowEvents={tomorrowEvents}
        tomorrowMeals={tomorrowMeals}
      />

      {/* AI Morning Plan */}
      {showPlanCard && (
        <DailyPlanCard
          plan={dailyPlan}
          loading={dailyPlanLoading}
          generating={dailyPlanGenerating}
          onGenerate={onGeneratePlan}
          onToggleTask={onTogglePlanTask}
          onDismissAdaptation={onDismissPlanAdaptation}
        />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onTabChange('add')}
          className="flex flex-col items-center gap-2 bg-rose-50 rounded-2xl py-4 px-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Plus size={18} className="text-rose-400" />
          </div>
          <span className="text-xs font-medium text-rose-500 text-center leading-tight">Add Task</span>
        </button>
        <button
          onClick={() => onTabChange('planner')}
          className="flex flex-col items-center gap-2 bg-amber-50 rounded-2xl py-4 px-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Calendar size={18} className="text-amber-500" />
          </div>
          <span className="text-xs font-medium text-amber-600 text-center leading-tight">Planner</span>
        </button>
        <button
          onClick={() => onTabChange('grocery')}
          className="flex flex-col items-center gap-2 bg-emerald-50 rounded-2xl py-4 px-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ShoppingCart size={18} className="text-emerald-500" />
          </div>
          <span className="text-xs font-medium text-emerald-600 text-center leading-tight">Grocery List</span>
        </button>
      </div>

      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Today's Schedule
          </h2>
          <div className="space-y-2">
            {todayEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50"
              >
                <div className="text-xs font-semibold text-rose-400 w-12 shrink-0">
                  {event.event_time || '—'}
                </div>
                <div className="w-px h-6 bg-rose-100 shrink-0" />
                <span className="text-sm text-gray-700 font-medium">{event.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Today's Tasks */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">All Tasks</h2>
          <span className="text-xs text-gray-400">{tasks.filter((t) => !t.completed).length} remaining</span>
        </div>
        {todayTasks.length === 0 ? (
          <div className="bg-white rounded-2xl px-4 py-6 text-center shadow-sm border border-gray-50">
            <p className="text-sm text-gray-400">No tasks yet. Add something to get started!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onToggleTask(task.id, !task.completed)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50 active:scale-[0.99] transition-transform text-left"
              >
                {task.completed ? (
                  <CheckCircle2 size={20} className="text-rose-400 shrink-0" />
                ) : (
                  <Circle size={20} className="text-gray-300 shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    task.completed ? 'line-through text-gray-300' : 'text-gray-700'
                  }`}
                >
                  {task.title}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* LifeBestie Suggests */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">LifeBestie Suggests</h2>
        </div>
        <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-2xl px-4 py-4 border border-rose-100">
          <p className="text-sm text-gray-600 leading-relaxed">{suggestion}</p>

          {todayRoutines.length > 0 && (
            <div className="mt-3 pt-3 border-t border-rose-100">
              <p className="text-xs text-gray-400 font-medium mb-1.5">Your routines today:</p>
              <div className="space-y-1">
                {todayRoutines.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-10 text-rose-400 font-semibold shrink-0">{r.time}</span>
                    <span>{capitalize(r.name)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onTabChange('chat')}
            className="mt-3 text-xs font-semibold text-rose-400 underline underline-offset-2"
          >
            Ask me anything →
          </button>
        </div>
      </section>
    </div>
  );
}
