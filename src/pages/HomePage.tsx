import { CheckCircle2, Circle, Sparkles, Plus, Calendar, ShoppingCart, X, Pencil, Sunrise, UtensilsCrossed, Activity, Flame, Zap, Wind, Trophy, ListChecks, Leaf } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Task, Event, UserMemory, GroceryHabit, GroceryCategory, Goal, getLowStockSuggestions, Meal, RoutineTemplate, RoutineRun, ModuleId } from '../lib/supabase';
import { PatternCandidate } from '../hooks/useUserMemory';
import { DailyPlan } from '../hooks/useDailyPlanner';
import { TabName } from '../components/BottomNav';
import { useMovement, MOVEMENT_OPTIONS, EnergyLevel } from '../hooks/useMovement';
import LowStockBanner from '../components/LowStockBanner';
import DailyPlanCard from '../components/DailyPlanCard';
import PrepareForTomorrowBanner from '../components/PrepareForTomorrowBanner';
import BestieAvatar from '../components/besties/BestieAvatar';
import type { BestieMotionState } from '../components/besties/BestieAvatar';
import { getHomeExpression } from '../lib/bestieExpression';
import type { BestieNotes } from '../hooks/useBestiePersonalization';
import { useTomorrowPrepChecklist, DEFAULT_PREP_ITEMS } from '../hooks/useTomorrowPrepChecklist';

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
  generationError: string | null;
  tomorrowReminders: string[];
  tomorrowRemindersLoading: boolean;
  tomorrowRemindersError: boolean;
  onDismissTomorrowReminder: (reminder: string) => void;
  onRefreshTomorrowReminders: () => void;
  activeRoutineRuns: RoutineRun[];
  completedRoutineRuns: RoutineRun[];
  routineTemplates: RoutineTemplate[];
  enabledModules: Set<ModuleId>;
  preferredName?: string;
  userId?: string;
  avatarTheme?: import('../lib/supabase').AvatarThemeId;
  character?: import('../lib/supabase').CharacterId;
  bestieNotes?: BestieNotes;
  memoriesCount?: number;
}

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

function getGreeting() {
  const tod = getTimeOfDay();
  if (tod === 'morning')   return 'Good morning';
  if (tod === 'afternoon') return 'Good afternoon';
  return 'Good evening';
}

/** Extract a first name from a preferred-name string, capitalized naturally. */
function getFirstName(name: string | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  const firstToken = trimmed.split(/\s+/)[0] ?? '';
  return capitalize(firstToken);
}

const DAILY_SUBTITLES = [
  "Here's what's on your plate today.",
  "Let's make today feel a little easier.",
  "We'll take today one step at a time.",
  "Your plans are ready when you are.",
  "Small steps still count.",
  "You don't have to do everything at once.",
  "Let's build a day that works for you.",
];

/** Deterministic subtitle pick — stable for a given user + calendar day. */
function getDailySubtitle(userId?: string): string {
  const today = new Date().toISOString().split('T')[0];
  const seed = `${today}:${userId ?? 'anon'}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % DAILY_SUBTITLES.length;
  return DAILY_SUBTITLES[idx]!;
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

// Rule-based smart prep suggestions derived from tomorrow's events and meals.
// Returns deduplicated suggestion strings; callers should further deduplicate
// against default and custom items.
function getSmartSuggestions(events: Event[], meals: Meal[]): string[] {
  const suggestions: string[] = [];

  if (events.length > 0) {
    // Check for early events (before 9 am)
    const hasEarlyEvent = events.some((e) => {
      if (!e.event_time) return false;
      const [h] = e.event_time.split(':').map(Number);
      return h < 9;
    });
    if (hasEarlyEvent) suggestions.push('Set out clothes tonight');

    if (events.length >= 2) suggestions.push("Review tomorrow's schedule");
  }

  if (meals.length > 0) {
    suggestions.push('Check what needs to thaw or prep');
  }

  // Deduplicate within the suggestions list itself
  return [...new Set(suggestions)];
}

const PREP_PRAISE_MESSAGES = [
  "That's one less thing for morning you.",
  "Tiny task, big relief.",
  "Look at you getting ahead.",
  "Tomorrow you is going to be thankful.",
  "You're making tomorrow softer.",
  "One little thing done. That counts.",
];

let praiseIndex = 0;
function nextPraiseMessage(): string {
  const msg = PREP_PRAISE_MESSAGES[praiseIndex % PREP_PRAISE_MESSAGES.length];
  praiseIndex++;
  return msg;
}

function getLowEnergyItems(events: Event[], meals: Meal[]): string[] {
  const items: string[] = [];
  const hasEarlyEvent = events.some((e) => {
    if (!e.event_time) return false;
    const [h] = e.event_time.split(':').map(Number);
    return h < 9;
  });
  if (hasEarlyEvent) {
    items.push('Set out clothes or bag');
  } else if (events.length > 0) {
    items.push("Review tomorrow's first event");
  } else {
    items.push('Pick one thing to make morning easier');
  }
  if (meals.length > 0) items.push('Check dinner plan');
  return items.slice(0, 2);
}

function TomorrowPrepCard({
  tomorrowEvents,
  tomorrowMeals,
  smartSuggestions,
}: {
  tomorrowEvents: Event[];
  tomorrowMeals: Meal[];
  smartSuggestions: string[];
}) {
  const hasContent = tomorrowEvents.length > 0 || tomorrowMeals.length > 0;
  const {
    checked, toggle, loading,
    streak, allDone, justCompleted,
    customItems, addCustomItem, deleteCustomItem,
  } = useTomorrowPrepChecklist();

  const [addingItem, setAddingItem] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [saving, setSaving] = useState(false);
  const [praiseMsg, setPraiseMsg] = useState('');
  const [praiseVisible, setPraiseVisible] = useState(false);
  const [lowEnergyMode, setLowEnergyMode] = useState(false);
  const praiseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lowEnergyItems = getLowEnergyItems(tomorrowEvents, tomorrowMeals);

  // Filter out smart suggestions that duplicate a saved custom item
  const filteredSuggestions = smartSuggestions.filter(
    (s) => !customItems.some((c) => c.title.toLowerCase() === s.toLowerCase()),
  );
  const totalCount = DEFAULT_PREP_ITEMS.length + customItems.length + filteredSuggestions.length;
  const doneCount = checked.size;

  function handleToggle(item: string) {
    const wasChecked = checked.has(item);
    toggle(item);
    if (!wasChecked) {
      if (praiseTimer.current) clearTimeout(praiseTimer.current);
      setPraiseMsg(nextPraiseMessage());
      setPraiseVisible(true);
      praiseTimer.current = setTimeout(() => setPraiseVisible(false), 4000);
    }
  }

  function handleLowEnergyMode() {
    setLowEnergyMode(true);
    if (praiseTimer.current) clearTimeout(praiseTimer.current);
    setPraiseMsg("Low energy still counts. Let's just do the tiny version.");
    setPraiseVisible(true);
  }

  // When all done, override praise with the stronger message
  useEffect(() => {
    if (allDone && doneCount > 0) {
      if (praiseTimer.current) clearTimeout(praiseTimer.current);
      setPraiseMsg("You're all set for tomorrow. Proud of you.");
      setPraiseVisible(true);
    }
  }, [allDone, doneCount]);

  function handleAddClick() {
    setAddingItem(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function handleSave() {
    const trimmed = newItemText.trim();
    if (!trimmed) { setAddingItem(false); return; }
    const alreadyExists = [
      ...DEFAULT_PREP_ITEMS,
      ...customItems.map((c) => c.title),
    ].some((t) => t.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) { setNewItemText(''); setAddingItem(false); return; }
    setSaving(true);
    await addCustomItem(trimmed);
    setNewItemText('');
    setAddingItem(false);
    setSaving(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setAddingItem(false); setNewItemText(''); }
  }

  return (
    <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-50">
        <div className="w-7 h-7 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
          <Sunrise size={14} className="text-sky-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Tomorrow Prep</p>
          <p className="text-xs text-gray-400">Get ahead for tomorrow</p>
        </div>
        {streak > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-500 shrink-0">
            🔥 {streak}
          </span>
        )}
        {!streak && doneCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-500 shrink-0">
            {doneCount}/{totalCount}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Low energy mode banner */}
        {lowEnergyMode && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-indigo-400">Tiny prep mode</p>
              <button
                onClick={() => setLowEnergyMode(false)}
                className="text-[10px] text-indigo-300 hover:text-indigo-500 transition-colors shrink-0"
              >
                Show full prep list
              </button>
            </div>
            <p className="text-xs text-indigo-300 mt-0.5">Just the essentials. That's enough.</p>
          </div>
        )}

        {/* Full view: calendar & meals context */}
        {!lowEnergyMode && tomorrowEvents.length > 0 && (
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

        {!lowEnergyMode && tomorrowMeals.length > 0 && (
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

        {/* Checklist section */}
        <div>
          {!lowEnergyMode && hasContent && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Prep checklist
            </p>
          )}

          {lowEnergyMode ? (
            /* Low energy: show only 1-2 focused tasks */
            <div className={`space-y-0.5 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {lowEnergyItems.map((item) => {
                const done = checked.has(item);
                return (
                  <button
                    key={item}
                    onClick={() => handleToggle(item)}
                    className="w-full flex items-center gap-2.5 py-2 text-left active:scale-[0.98] transition-transform"
                  >
                    {done ? (
                      <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />
                    ) : (
                      <div className="w-4.5 h-4.5 rounded-full border-2 border-indigo-200 shrink-0" style={{ width: 18, height: 18 }} />
                    )}
                    <span className={`text-sm flex-1 ${done ? 'line-through text-gray-300' : 'text-gray-700 font-medium'}`}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Full checklist */
            <>
              <div className={`space-y-0.5 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {DEFAULT_PREP_ITEMS.map((item) => {
                  const done = checked.has(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleToggle(item)}
                      className="w-full flex items-center gap-2.5 py-1.5 text-left active:scale-[0.98] transition-transform"
                    >
                      {done ? (
                        <CheckCircle2 size={16} className="text-sky-400 shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                      )}
                      <span className={`text-xs flex-1 ${done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                        {item}
                      </span>
                    </button>
                  );
                })}
                {customItems.map((ci) => {
                  const done = checked.has(ci.title);
                  return (
                    <div key={ci.id} className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(ci.title)}
                        className="flex-1 flex items-center gap-2.5 py-1.5 text-left active:scale-[0.98] transition-transform"
                      >
                        {done ? (
                          <CheckCircle2 size={16} className="text-sky-400 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                        )}
                        <span className={`text-xs flex-1 ${done ? 'line-through text-gray-300' : 'text-gray-600'}`}>
                          {ci.title}
                        </span>
                      </button>
                      <button
                        onClick={() => deleteCustomItem(ci.id, ci.title)}
                        className="shrink-0 p-1 text-gray-200 hover:text-gray-400 active:scale-95 transition-all"
                        aria-label="Remove item"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {filteredSuggestions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wide mb-1">
                    Suggested for tomorrow
                  </p>
                  {filteredSuggestions.map((suggestion) => {
                    const done = checked.has(suggestion);
                    return (
                      <button
                        key={suggestion}
                        onClick={() => handleToggle(suggestion)}
                        className="w-full flex items-center gap-2.5 py-1.5 text-left active:scale-[0.98] transition-transform"
                      >
                        {done ? (
                          <CheckCircle2 size={16} className="text-violet-300 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-violet-100 shrink-0" />
                        )}
                        <span className={`text-xs flex-1 ${done ? 'line-through text-gray-300' : 'text-gray-500'}`}>
                          {suggestion}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {addingItem ? (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-4 h-4 rounded-full border-2 border-sky-200 shrink-0" />
                  <input
                    ref={inputRef}
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a prep item…"
                    maxLength={80}
                    disabled={saving}
                    className="flex-1 text-xs text-gray-700 bg-transparent border-b border-sky-200 focus:border-sky-400 outline-none py-1 placeholder-gray-300 transition-colors"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !newItemText.trim()}
                    className="shrink-0 text-[10px] font-semibold text-sky-500 disabled:text-gray-300 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAddingItem(false); setNewItemText(''); }}
                    className="shrink-0 text-gray-300 hover:text-gray-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={handleAddClick}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-sky-400 active:scale-95 transition-all"
                  >
                    <Plus size={12} />
                    <span>Add prep item</span>
                  </button>
                  <button
                    onClick={handleLowEnergyMode}
                    className="text-[10px] text-gray-300 hover:text-indigo-400 transition-colors active:scale-95"
                  >
                    I only have 5 minutes
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Emma praise message */}
        <div
          className="overflow-hidden transition-all duration-500 ease-in-out"
          style={{ maxHeight: praiseVisible ? '40px' : '0', opacity: praiseVisible ? 1 : 0 }}
        >
          <p className="text-xs text-sky-400 italic pt-0.5 pb-1">{praiseMsg}</p>
        </div>

        {/* Streak footer */}
        {justCompleted ? (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 flex items-start gap-2">
            <span className="text-base leading-none shrink-0">🔥</span>
            <div>
              <p className="text-xs font-bold text-amber-600">
                {streak > 1 ? `${streak} nights prepared in a row!` : 'Prep complete!'}
              </p>
              <p className="text-xs text-amber-500 mt-0.5">
                Look at you taking care of tomorrow you.
              </p>
            </div>
          </div>
        ) : allDone && streak > 1 ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 flex items-center gap-2">
            <span className="text-sm leading-none shrink-0">🔥</span>
            <p className="text-xs text-emerald-600 font-medium">
              {`${streak} nights prepared in a row — you're on a roll!`}
            </p>
          </div>
        ) : streak > 0 && !allDone ? (
          <p className="text-xs text-gray-400">
            Finish your prep list to keep your {streak}-night streak going.
          </p>
        ) : null}
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
  generationError,
  tomorrowReminders,
  tomorrowRemindersLoading,
  tomorrowRemindersError,
  onDismissTomorrowReminder,
  onRefreshTomorrowReminders,
  activeRoutineRuns,
  completedRoutineRuns,
  routineTemplates,
  enabledModules,
  preferredName,
  userId,
  character,
  bestieNotes,
  memoriesCount = 0,
}: HomePageProps) {
  const [proudFlash, setProudFlash] = useState(false);
  const proudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire a wave on first mount (home screen entrance)
  const [motionOverride, setMotionOverride] = useState<BestieMotionState | undefined>('wave');
  useEffect(() => { setMotionOverride('wave'); }, []);

  const handleToggleTask = useCallback((id: string, completed: boolean) => {
    if (completed) {
      setProudFlash(true);
      setMotionOverride('celebrating');
      if (proudTimer.current) clearTimeout(proudTimer.current);
      proudTimer.current = setTimeout(() => {
        setProudFlash(false);
        setMotionOverride(undefined);
      }, 2000);
    }
    onToggleTask(id, completed);
  }, [onToggleTask]);

  const today = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter((t) => !t.completed);
  const hasOverdueTasks = pendingTasks.some((t) => t.due_date && t.due_date < today);
  const homeExpression = getHomeExpression(pendingTasks.length, hasOverdueTasks, proudFlash);

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

  // Build a personalised subtitle based on bestie notes when available
  const tod = getTimeOfDay();
  let homeSubtitle: string;
  if (bestieNotes && memoriesCount >= 4 && bestieNotes.planning_struggle) {
    homeSubtitle = `Remember: ${bestieNotes.planning_struggle.toLowerCase()} — I've got you.`;
  } else if (bestieNotes && memoriesCount >= 4 && bestieNotes.wellness_preference) {
    const wellness = bestieNotes.wellness_preference.toLowerCase();
    homeSubtitle = tod === 'evening'
      ? `Don't forget your ${wellness} before bed.`
      : `Have you done your ${wellness} today?`;
  } else if (todayEvents.length > 0) {
    homeSubtitle = `You've got ${todayEvents.length} thing${todayEvents.length > 1 ? 's' : ''} on today.`;
  } else {
    homeSubtitle = getDailySubtitle(userId);
  }

  const tomorrowEvents = events
    .filter((e) => e.event_date === tomorrowDate)
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));
  const tomorrowMeals = meals.filter((m) => m.meal_date === tomorrowDate);

  const rawSuggestions = getSmartSuggestions(tomorrowEvents, tomorrowMeals);
  // Deduplicate against default items (custom items deduplication happens inside the card)
  const smartSuggestions = rawSuggestions.filter(
    (s) => !DEFAULT_PREP_ITEMS.some((d) => d.toLowerCase() === s.toLowerCase()),
  );

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

  const { todayMovements, hasMoved, hasCompleted, streakResult } = useMovement(events);

  const LEVEL_ICONS_HOME: Record<EnergyLevel, React.ReactNode> = {
    low:      <Wind size={12} />,
    moderate: <Zap size={12} />,
    high:     <Flame size={12} />,
  };

  return (
    <div className="px-4 sm:px-6 pt-6 pb-32 space-y-6 w-full max-w-2xl mx-auto">
      {/* Header — illustrated welcome area */}
      <div className="flex items-center gap-4 sm:gap-7">
        {/* Emma portrait over organic lavender shape */}
        <div
          className="relative shrink-0"
          style={{ width: 'clamp(88px, 22vw, 180px)', height: 'clamp(96px, 24vw, 200px)' }}
        >
          {/* Soft outer glow halo */}
          <div
            className="absolute"
            style={{
              inset: '-8%',
              borderRadius: '46% 54% 50% 50% / 54% 46% 56% 44%',
              background: 'radial-gradient(circle at 50% 42%, rgba(167,136,250,0.22) 0%, rgba(221,214,254,0.10) 55%, transparent 72%)',
              filter: 'blur(10px)',
            }}
          />
          {/* Organic lavender background shape — larger than Emma */}
          <div
            className="absolute"
            style={{
              inset: '0',
              borderRadius: '44% 56% 48% 52% / 52% 48% 56% 44%',
              background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #e9d5ff 100%)',
              boxShadow: '0 10px 28px -12px rgba(167,136,250,0.40), inset 0 1px 3px rgba(255,255,255,0.65)',
            }}
          />
          {/* Translucent layer upper-left */}
          <div
            className="absolute"
            style={{
              top: '6%', left: '8%', width: '52%', height: '52%',
              borderRadius: '54% 46% 60% 40% / 48% 54% 46% 52%',
              background: 'rgba(196,181,253,0.20)',
            }}
          />
          {/* Translucent layer lower-right */}
          <div
            className="absolute"
            style={{
              bottom: '8%', right: '6%', width: '42%', height: '42%',
              borderRadius: '46% 54% 42% 58% / 56% 44% 56% 44%',
              background: 'rgba(221,214,254,0.28)',
            }}
          />
          {/* Thin lavender ring */}
          <div
            className="absolute"
            style={{
              inset: '0',
              borderRadius: '44% 56% 48% 52% / 52% 48% 56% 44%',
              border: '1.5px solid rgba(167,136,250,0.28)',
            }}
          />
          {/* Decorative sparkle top-right */}
          <Sparkles
            size={16}
            style={{
              position: 'absolute',
              top: '-2%', right: '-4%',
              color: 'rgba(167,136,250,0.55)',
              filter: 'drop-shadow(0 0 3px rgba(221,214,254,0.7))',
              zIndex: 2,
            }}
          />
          {/* Decorative leaf bottom-left */}
          <Leaf
            size={18}
            style={{
              position: 'absolute',
              bottom: '-2%', left: '-3%',
              color: 'rgba(196,181,253,0.42)',
              transform: 'rotate(-22deg)',
              zIndex: 2,
            }}
          />
          {/* Emma portrait — overflows the shape naturally */}
          <BestieAvatar
            characterId={character ?? 'emma'}
            expression={homeExpression}
            size="portrait"
            motionOverride={motionOverride}
            onMotionEnd={() => setMotionOverride(undefined)}
            className="absolute inset-0"
          />
        </div>
        {/* Greeting block */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest mb-0.5" style={{ color: 'var(--theme-primary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl font-bold text-gray-800 leading-tight">
            {getGreeting()}{(() => {
              const fn = getFirstName(preferredName);
              return fn ? `, ${fn}` : '';
            })()}.
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {homeSubtitle}
          </p>
        </div>
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
      {(tomorrowRemindersLoading || tomorrowReminders.length > 0 || tomorrowRemindersError) && (
        <PrepareForTomorrowBanner
          reminders={tomorrowReminders}
          loading={tomorrowRemindersLoading}
          error={tomorrowRemindersError}
          onDismiss={onDismissTomorrowReminder}
          onRefresh={onRefreshTomorrowReminders}
        />
      )}

      {/* Tomorrow Prep card */}
      <TomorrowPrepCard
        tomorrowEvents={tomorrowEvents}
        tomorrowMeals={tomorrowMeals}
        smartSuggestions={smartSuggestions}
      />

      {/* Movement status card */}
      {enabledModules.has('movement') && (
      <button
        onClick={() => onTabChange('movement')}
        className="w-full text-left active:scale-[0.98] transition-transform"
      >
        {hasMoved ? (
          <div className={`rounded-2xl border px-4 py-3.5 space-y-2.5 ${hasCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-sky-50 border-sky-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={14} className={hasCompleted ? 'text-emerald-500' : 'text-sky-500'} />
                <span className={`text-xs font-bold uppercase tracking-wide ${hasCompleted ? 'text-emerald-700' : 'text-sky-700'}`}>
                  Movement Today
                </span>
              </div>
              <div className="flex items-center gap-2">
                {streakResult.streak > 0 && (
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                    <Trophy size={9} className="text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600">{streakResult.streak}d</span>
                  </div>
                )}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hasCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-sky-100 text-sky-600'}`}>
                  {todayMovements.filter((m) => m.done).length}/{todayMovements.length} done
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              {todayMovements.map((m) => {
                const lc = MOVEMENT_OPTIONS[m.level].color;
                return (
                  <div key={m.event.id} className="flex items-center gap-2">
                    {m.done
                      ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      : <Circle size={13} className="text-gray-300 shrink-0" />
                    }
                    <span className={`text-xs flex-1 ${m.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {m.activityLabel}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${lc.badge}`}>
                      <span className={lc.icon}>{LEVEL_ICONS_HOME[m.level]}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            {streakResult.streak > 0 && (
              <p className="text-xs text-amber-600 font-medium">{streakResult.message}</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Activity size={16} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-700">No movement yet today</p>
              {streakResult.streak > 0 ? (
                <p className="text-xs text-amber-500 mt-0.5">
                  <Trophy size={9} className="inline mr-0.5" />{streakResult.streak}-day streak — keep it going!
                </p>
              ) : (
                <p className="text-xs text-emerald-500 mt-0.5">Tap to pick something that fits your energy</p>
              )}
            </div>
            <Plus size={16} className="text-emerald-400 shrink-0" />
          </div>
        )}
      </button>
      )}

      {/* Active routine progress */}
      {enabledModules.has('routines') && (activeRoutineRuns.length > 0 || completedRoutineRuns.length > 0) && (
        <button
          onClick={() => onTabChange('routines')}
          className="w-full text-left active:scale-[0.98] transition-transform"
        >
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm px-4 py-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={14} style={{ color: 'var(--theme-primary)' }} />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Routines Today</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}>
                {completedRoutineRuns.length + activeRoutineRuns.length} active
              </span>
            </div>
            <div className="space-y-2">
              {[...activeRoutineRuns, ...completedRoutineRuns].map((run) => {
                const tmpl = routineTemplates.find((t) => t.id === run.template_id);
                if (!tmpl) return null;
                const done = run.completed_step_ids.length;
                const total = run.steps_snapshot.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                const allDone = done >= total;
                return (
                  <div key={run.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${allDone ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {tmpl.name}
                      </span>
                      <span className={`text-[10px] font-bold ${allDone ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {done}/{total}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300`}
                        style={{ width: `${pct}%`, backgroundColor: allDone ? '#34d399' : 'var(--theme-primary)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </button>
      )}

      {/* AI Morning Plan */}
      {showPlanCard && (
        <DailyPlanCard
          plan={dailyPlan}
          loading={dailyPlanLoading}
          generating={dailyPlanGenerating}
          generationError={generationError}
          onGenerate={onGeneratePlan}
          onToggleTask={onTogglePlanTask}
          onDismissAdaptation={onDismissPlanAdaptation}
        />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onTabChange('add')}
          className="flex flex-col items-center gap-2 rounded-2xl py-4 px-2 active:scale-95 transition-transform"
          style={{ backgroundColor: 'var(--theme-primary-light)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--theme-primary-mid)' }}>
            <Plus size={18} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <span className="text-xs font-medium text-center leading-tight" style={{ color: 'var(--theme-primary)' }}>Add Task</span>
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
                <div className="text-xs font-semibold w-12 shrink-0" style={{ color: 'var(--theme-primary)' }}>
                  {event.event_time || '—'}
                </div>
                <div className="w-px h-6 shrink-0" style={{ backgroundColor: 'var(--theme-primary-mid)' }} />
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
                onClick={() => handleToggleTask(task.id, !task.completed)}
                className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50 active:scale-[0.99] transition-transform text-left"
              >
                {task.completed ? (
                  <CheckCircle2 size={20} style={{ color: 'var(--theme-primary)' }} className="shrink-0" />
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
        <div className="rounded-2xl px-4 py-4" style={{ background: 'linear-gradient(135deg, var(--theme-primary-light), var(--theme-bg-color, #fdf6e3))', border: '1px solid var(--theme-primary-mid)' }}>
          <p className="text-sm text-gray-600 leading-relaxed">{suggestion}</p>

          {todayRoutines.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--theme-primary-mid)' }}>
              <p className="text-xs text-gray-400 font-medium mb-1.5">Your routines today:</p>
              <div className="space-y-1">
                {todayRoutines.map((r) => (
                  <div key={r.name} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-10 font-semibold shrink-0" style={{ color: 'var(--theme-primary)' }}>{r.time}</span>
                    <span>{capitalize(r.name)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => onTabChange('chat')}
            className="mt-3 text-xs font-semibold underline underline-offset-2"
            style={{ color: 'var(--theme-primary)' }}
          >
            Ask me anything →
          </button>
        </div>
      </section>
    </div>
  );
}
