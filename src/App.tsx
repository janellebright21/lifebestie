import { useState, useEffect, useCallback, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, dbError, Task, Event, GroceryItem, GroceryCategory, MealIngredient, TaskCategory, TaskPriority, EventCategory } from './lib/supabase';
import { useUserMemory } from './hooks/useUserMemory';
import { useWeeklyGroceryList } from './hooks/useWeeklyGroceryList';
import { useMealPlanner } from './hooks/useMealPlanner';
import { useGoals } from './hooks/useGoals';
import { useDailyPlanner } from './hooks/useDailyPlanner';
import { useGroceryBudget } from './hooks/useGroceryBudget';
import { useSpendingTrends } from './hooks/useSpendingTrends';
import { useReceipts } from './hooks/useReceipts';
import { usePrepareForTomorrow } from './hooks/usePrepareForTomorrow';
import { useRoutines } from './hooks/useRoutines';
import { useModuleSettings } from './hooks/useModuleSettings';
import { useUserProfile } from './hooks/useUserProfile';
import { usePersonalization } from './hooks/usePersonalization';
import { useLifeBestieMemory } from './hooks/useLifeBestieMemory';
import { useBestiePersonalization } from './hooks/useBestiePersonalization';
import { useBestieRelationship } from './hooks/useBestieRelationship';
import { getBestieExpression } from './lib/bestieExpression';
import type { BestieContext } from './lib/bestieExpression';
import BottomNav, { TabName } from './components/BottomNav';
import RoutineConfirmSheet from './components/RoutineConfirmSheet';
import QuickAddSheet from './components/QuickAddSheet';
import FloatingBestie from './components/FloatingBestie';
import HomePage from './pages/HomePage';
import PlannerPage from './pages/PlannerPage';
import GroceryPage from './pages/GroceryPage';
import GoalsPage from './pages/GoalsPage';
import ChatPage from './pages/ChatPage';
import MovementPage from './pages/MovementPage';
import RoutinesPage from './pages/RoutinesPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';
import AuthPage from './pages/AuthPage';
import MyBestiePage from './pages/MyBestiePage';

const MEMORY_ID_KEY = 'lifebestie_memory_id';

// Valid tabs that can be persisted and restored. We exclude 'add' since it opens
// a sheet rather than a page, and should never be the restored landing tab.
const VALID_PERSISTED_TABS: ReadonlySet<TabName> = new Set([
  'home', 'planner', 'grocery', 'movement', 'routines', 'goals', 'chat', 'bestie', 'settings',
]);
const ACTIVE_TAB_KEY = 'lifebestie_active_tab';

function getInitialTab(): TabName {
  try {
    const saved = sessionStorage.getItem(ACTIVE_TAB_KEY) as TabName | null;
    if (saved && VALID_PERSISTED_TABS.has(saved)) return saved;
  } catch {
    // sessionStorage unavailable (private browsing quirks) — fall through
  }
  return 'home';
}

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTabState] = useState<TabName>(getInitialTab);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  // True once the initial getSession() call resolves — prevents a flash of
  // the wrong screen while we confirm whether the user is signed in.
  const [sessionChecked, setSessionChecked] = useState(false);
  // Tracks whether the app has fully loaded at least once. Prevents a
  // background profile refresh from triggering the full-screen loading guard.
  const hasLoadedRef = useRef(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [appProudFlash, setAppProudFlash] = useState(false);
  const appProudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persists the tab to sessionStorage and updates state.
  function setActiveTab(tab: TabName) {
    setActiveTabState(tab);
    try {
      if (VALID_PERSISTED_TABS.has(tab)) {
        sessionStorage.setItem(ACTIVE_TAB_KEY, tab);
      }
    } catch {
      // sessionStorage write failed — state still updates, just won't survive remount
    }
  }

  const memoryId = localStorage.getItem(MEMORY_ID_KEY);

  // ── Custom hooks (all called unconditionally) ──────────────────────────────
  const userMemory = useUserMemory();
  const goalsHook = useGoals();
  const dailyPlanner = useDailyPlanner();
  const spendingTrends = useSpendingTrends();
  const { saveSnapshot } = spendingTrends;
  const receipts = useReceipts();
  const mealPlanner = useMealPlanner();
  const groceryBudget = useGroceryBudget();
  const routinesHook = useRoutines();
  const moduleSettings = useModuleSettings();
  const userProfile = useUserProfile();
  const personalization = usePersonalization();
  const lifeBestieMemory = useLifeBestieMemory();
  const bestiePersonalization = useBestiePersonalization();
  const bestieRelationship = useBestieRelationship();

  const routines = userMemory.memory?.routines ?? [];

  const weeklyGrocery = useWeeklyGroceryList(
    userMemory.memory?.common_groceries ?? [],
    routines,
    userMemory.getRecentHistory(14),
    events,
    mealPlanner.meals,
    tasks
  );

  const prepareForTomorrow = usePrepareForTomorrow(
    events,
    tasks,
    groceryItems,
    weeklyGrocery.weeklyList?.items ?? []
  );

  // ── Auth effect ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // TOKEN_REFRESHED, INITIAL_SESSION, and USER_UPDATED are not sign-outs.
      // Only clear user data on an explicit SIGNED_OUT event to avoid wiping state
      // during background token refresh, which would navigate back to Home.
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setTasks([]);
        setEvents([]);
        setGroceryItems([]);
        // Reset tab on real sign-out so next user starts at Home
        setActiveTabState('home');
        try { sessionStorage.removeItem(ACTIVE_TAB_KEY); } catch { /* ignore */ }
      } else if (nextSession) {
        // Update session for sign-in and token refresh — never null the session
        setSession(nextSession);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    const [
      { data: t },
      { data: e },
      { data: g }
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false }),

      supabase
        .from('events')
        .select('*')
        .eq('user_id', uid)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true }),

      supabase
        .from('grocery_items')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),
    ]);

    if (t) setTasks(t);
    if (e) setEvents(e);
    if (g) setGroceryItems(g);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchAll();
  }, [session, fetchAll]);

  // ── Budget sync effect ─────────────────────────────────────────────────────
  const setEstimatedTotal = groceryBudget.setEstimatedTotal;
  const budgetTotal = groceryBudget.budget?.current_estimated_total;
  useEffect(() => {
    const weekItems = weeklyGrocery.weeklyList?.items ?? [];
    const total = Math.round(
      weekItems.filter((i) => !i.skipped).reduce((sum, i) => sum + (i.price ?? 0), 0) * 100
    ) / 100;
    if (total !== budgetTotal) setEstimatedTotal(total);
  }, [weeklyGrocery.weeklyList?.items, budgetTotal, setEstimatedTotal]);

  // ── Spending snapshot effect ───────────────────────────────────────────────
  const weeklyBudgetValue = groceryBudget.budget?.weekly_budget ?? 100;
  useEffect(() => {
    if (activeTab !== 'grocery') return;
    const items = weeklyGrocery.weeklyList?.items;
    const weekStart = weeklyGrocery.weeklyList?.week_start_date;
    if (!items || !weekStart) return;
    saveSnapshot(weekStart, items, weeklyBudgetValue);
  }, [activeTab, weeklyGrocery.weeklyList, weeklyBudgetValue, saveSnapshot]);

  // ── Guard: loading screen while we confirm auth + profile status ───────────
  // Only show the full-screen loading guard on the INITIAL app load.
  // - sessionChecked must be true (getSession() has resolved)
  // - userProfile.loading must be false (profile fetched at least once)
  //
  // After hasLoadedRef is set, we never return this guard again — a background
  // profile refresh (e.g. triggered by a TOKEN_REFRESHED event re-firing SIGNED_IN
  // in useUserProfile) must not unmount the running app or navigate away from Chat.
  const isInitialLoad = !hasLoadedRef.current;
  if (isInitialLoad && (!sessionChecked || (session !== null && userProfile.loading))) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center theme-app-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-[3px] border-gray-200 border-t-rose-400 animate-spin" />
          <p className="text-sm text-gray-400">Getting everything ready…</p>
        </div>
      </div>
    );
  }

  // ── Guard: show auth page if not signed in ─────────────────────────────────
  if (!session) {
    return <AuthPage />;
  }

  // ── Guard: show onboarding only when profile is confirmed incomplete ────────
  if (userProfile.needsOnboarding) {
    return <OnboardingPage onComplete={userProfile.completeOnboarding} />;
  }

  // Mark initial load complete. From here on, background refreshes will not
  // re-trigger the loading guard.
  hasLoadedRef.current = true;

  const userId = session.user.id;
  const preferredName = userProfile.profile?.preferred_name || undefined;
  const selectedCharacter = (userProfile.profile?.character_id ?? 'emma') as import('./lib/supabase').CharacterId;

  // Derive a context-aware expression for the floating Bestie
  const TAB_CONTEXT: Partial<Record<TabName, BestieContext>> = {
    home:      'home',
    planner:   'home',
    grocery:   'grocery-loading',
    movement:  'movement',
    chat:      'chat-idle',
    routines:  'home',
    goals:     'home',
  };
  const floatingExpression = appProudFlash
    ? 'proud' as const
    : getBestieExpression(TAB_CONTEXT[activeTab] ?? 'default');

  // ── Action handlers ────────────────────────────────────────────────────────
  async function addTask(title: string, dueDate?: string, linkedGoalId?: string, duration?: number, category?: TaskCategory, priority?: TaskPriority) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        due_date: dueDate || null,
        linked_goal_id: linkedGoalId || null,
        duration: duration ?? null,
        memory_id: memoryId,
        user_id: userId,
        category: category ?? 'Other',
        priority: priority ?? 'medium',
      })
      .select()
      .single();
    dbError('tasks (insert)', error);
    if (data) {
      const task = data as Task;
      setTasks((prev) => [task, ...prev]);
      await userMemory.addHistoryAction(`Added task: ${title}`);
      await bestieRelationship.awardPoints('add_task', task.id, 5, 'Added a task');
      if (linkedGoalId) {
        await goalsHook.linkTaskToGoal(task.id, linkedGoalId);
      }
    }
  }

  async function toggleTask(id: string, completed: boolean) {
    const updatedTasks = tasks.map((t) => (t.id === id ? { ...t, completed } : t));
    setTasks(updatedTasks);
    await supabase.from('tasks').update({ completed }).eq('id', id).eq('user_id', userId);

    const task = tasks.find((t) => t.id === id);
    if (task) {
      if (completed) {
        await userMemory.addHistoryAction(`Completed task: ${task.title}`);
        // Award points once per task — DB unique constraint prevents duplicates
        await bestieRelationship.awardTaskCompletion(id);
        // Signal the floating bestie to celebrate
        setAppProudFlash(true);
        if (appProudTimer.current) clearTimeout(appProudTimer.current);
        appProudTimer.current = setTimeout(() => setAppProudFlash(false), 2200);
      }
      if (task.linked_goal_id) {
        await goalsHook.recalculateGoalProgress(task.linked_goal_id, updatedTasks);
      }
    }
  }

  async function deleteTask(id: string) {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
    if (task?.linked_goal_id) {
      await goalsHook.unlinkTaskFromGoal(id, task.linked_goal_id);
    }
  }

  async function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'due_date' | 'duration' | 'linked_goal_id' | 'category' | 'priority'>>) {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', userId);

    const oldGoalId = task?.linked_goal_id ?? null;
    const newGoalId = patch.linked_goal_id !== undefined ? patch.linked_goal_id : oldGoalId;

    if (oldGoalId && oldGoalId !== newGoalId) {
      await goalsHook.unlinkTaskFromGoal(id, oldGoalId);
    }
    if (newGoalId && newGoalId !== oldGoalId) {
      await goalsHook.linkTaskToGoal(id, newGoalId);
    }
  }

  async function addEvent(title: string, date: string, time: string, category?: EventCategory, location?: string, notes?: string): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .insert({
        title,
        event_date: date,
        event_time: time,
        memory_id: memoryId,
        user_id: userId,
        category: category ?? 'Other',
        location: location ?? null,
        notes: notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const event = data as Event;

    // Update events state immediately so the UI reflects the new event.
    setEvents((prev) =>
      [...prev, event].sort((a, b) => {
        const dc = a.event_date.localeCompare(b.event_date);
        return dc !== 0 ? dc : (a.event_time || '').localeCompare(b.event_time || '');
      }),
    );

    // Bestie points and memory history are non-critical side-effects — run them
    // in the background so the event save resolves immediately after the insert.
    Promise.allSettled([
      userMemory.addHistoryAction(`Added event: ${title} on ${date}`),
      bestieRelationship.awardPoints(
        'add_event',
        event.id,
        category === 'Movement' ? 10 : 5,
        `Added event: ${title}`,
      ),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') {
          console.warn('[addEvent] background side-effect failed:', r.reason);
        }
      }
    });

    return event;
  }

  async function deleteEvent(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('events').delete().eq('id', id).eq('user_id', userId);
  }

  async function updateEvent(id: string, patch: Partial<Pick<Event, 'title' | 'event_date' | 'event_time' | 'category' | 'location' | 'notes'>>) {
    setEvents((prev) => prev.map((e) => e.id === id ? { ...e, ...patch } : e));
    await supabase.from('events').update(patch).eq('id', id).eq('user_id', userId);
  }

  async function addGrocery(name: string, category: GroceryCategory) {
    const { data, error } = await supabase
      .from('grocery_items')
      .insert({ name, category, memory_id: memoryId, user_id: userId })
      .select()
      .single();
    dbError('grocery_items (insert)', error);
    if (data) {
      setGroceryItems((prev) => [...prev, data]);
      await userMemory.addHistoryAction(`Added grocery: ${name}`);
      await userMemory.upsertGroceryHabit(name, category);
      await bestieRelationship.awardPoints('add_grocery', data.id, 5, `Added grocery: ${name}`);
    }
  }

  async function toggleGrocery(id: string, checked: boolean) {
    setGroceryItems((prev) => prev.map((g) => (g.id === id ? { ...g, checked } : g)));
    await supabase.from('grocery_items').update({ checked }).eq('id', id).eq('user_id', userId);
  }

  async function deleteGrocery(id: string) {
    setGroceryItems((prev) => prev.filter((g) => g.id !== id));
    await supabase.from('grocery_items').delete().eq('id', id).eq('user_id', userId);
  }

  async function addWeeklyItem(name: string, category: GroceryCategory, source: import('./lib/supabase').WeeklyGrocerySource) {
    await weeklyGrocery.addWeeklyItem(name, category, source);
    await userMemory.upsertGroceryHabit(name, category);
    // Use name + current week start as the unique source so same item in same week
    // cannot earn duplicate points across retries or multiple tabs.
    const weekStart = weeklyGrocery.weeklyList?.week_start_date ?? new Date().toISOString().split('T')[0];
    await bestieRelationship.awardPoints(
      'add_weekly_item',
      `${name.toLowerCase()}:${weekStart}`,
      5,
      `Added weekly grocery: ${name}`,
    );
  }

  async function skipWeeklyItem(name: string) {
    const item = weeklyGrocery.weeklyList?.items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase()
    );
    await weeklyGrocery.skipWeeklyItem(name);
    if (!item?.skipped) {
      await userMemory.decreaseGroceryHabit(name);
    }
  }

  async function removeWeeklyItem(name: string) {
    await weeklyGrocery.removeWeeklyItem(name);
    await userMemory.decreaseGroceryHabit(name);
  }

  async function planMeals(_mealIds: string[], ingredients: MealIngredient[]) {
    for (const ing of ingredients) {
      await weeklyGrocery.addWeeklyItem(
        ing.name,
        ing.category,
        'meal',
        ing.quantity,
        ing.unit,
        ing.mealSources
      );
    }
  }

  async function addMealFull(opts: { name: string; meal_type: import('./lib/supabase').MealType; meal_date: string; ingredients: MealIngredient[] }) {
    const result = await mealPlanner.addMealFull(opts);
    // Bestie points are a non-critical side-effect — run in the background.
    if (result?.id) {
      bestieRelationship.awardPoints('add_meal', result.id, 8, `Added meal: ${opts.name}`)
        .catch((e) => console.warn('[addMealFull] awardPoints failed:', e));
    }
    return result;
  }

  async function linkMealToEvent(eventId: string, meal: import('./lib/supabase').Meal) {
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, meal_id: meal.id } : e));
    await supabase.from('events').update({ meal_id: meal.id }).eq('id', eventId).eq('user_id', userId);
    for (const ing of meal.ingredients) {
      await weeklyGrocery.addWeeklyItem(ing.name, ing.category, 'meal');
    }
  }

  async function updateWeeklyItemPrice(name: string, price: number) {
    await weeklyGrocery.updateWeeklyItemPrice(name, price);
  }

  async function handleReceiptSave(
    result: import('./hooks/useReceipts').ScanResult,
    items: import('./lib/supabase').ReceiptItem[]
  ) {
    await receipts.saveReceipt(result, items);

    const weekItems = weeklyGrocery.weeklyList?.items ?? [];
    for (const receiptItem of items) {
      const match = weekItems.find(
        (w) => w.name.toLowerCase() === receiptItem.name.toLowerCase()
      );
      if (match) {
        await weeklyGrocery.updateWeeklyItemPrice(receiptItem.name, receiptItem.price);
      }
    }

    for (const receiptItem of items) {
      await userMemory.upsertGroceryHabit(receiptItem.name, receiptItem.category);
    }

    const weekStart = weeklyGrocery.weeklyList?.week_start_date;
    if (weekStart) {
      const updatedItems = weeklyGrocery.weeklyList?.items ?? [];
      saveSnapshot(weekStart, updatedItems, groceryBudget.budget?.weekly_budget ?? 100);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const enabledModules = new Set(
    (['grocery', 'meals', 'budget', 'movement', 'routines', 'ai-assistant',
      'family-hub', 'chore-tracking', 'school-tracker'] as const)
      .filter((id) => moduleSettings.isEnabled(id))
  );

  // After modules have loaded, if the restored tab belongs to a now-disabled module,
  // quietly reset to Home. Only do this once modules are confirmed loaded.
  const TAB_MODULE_GATE: Partial<Record<TabName, import('./lib/supabase').ModuleId>> = {
    grocery:  'grocery',
    movement: 'movement',
    routines: 'routines',
    chat:     'ai-assistant',
  };
  if (moduleSettings.loaded) {
    const gateModule = TAB_MODULE_GATE[activeTab];
    if (gateModule && !enabledModules.has(gateModule)) {
      setActiveTab('home');
    }
  }

  return (
    <div className="min-h-[100dvh] theme-app-bg font-sans">
      {activeTab === 'home' && (
        <HomePage
          tasks={tasks}
          events={events}
          meals={mealPlanner.meals}
          memory={userMemory.memory}
          habits={userMemory.memory?.common_groceries ?? []}
          pendingRoutineSuggestions={userMemory.pendingRoutineSuggestions}
          goals={goalsHook.goals}
          dailyPlan={dailyPlanner.plan}
          dailyPlanLoading={dailyPlanner.loading}
          dailyPlanGenerating={dailyPlanner.generating}
          onToggleTask={toggleTask}
          onAddGrocery={addGrocery}
          onTabChange={(tab) => {
            if (tab === 'add') { setQuickAddOpen(true); return; }
            setActiveTab(tab);
          }}
          onOpenRoutineSheet={userMemory.openRoutineSheet}
          onDismissRoutine={userMemory.dismissRoutineSuggestion}
          getProactiveSuggestions={userMemory.getProactiveSuggestions}
          onGeneratePlan={() =>
            dailyPlanner.generate(
              {
                goals: goalsHook.goals,
                tasks,
                events,
                routines: userMemory.memory?.routines ?? [],
                memory: userMemory.memory,
                recentHistory: userMemory.getRecentHistory(7).flatMap((h) => h.actions),
              }
            )
          }
          onTogglePlanTask={dailyPlanner.togglePlanTask}
          onDismissPlanAdaptation={dailyPlanner.dismissAdaptation}
          generationError={dailyPlanner.generationError}
          tomorrowReminders={prepareForTomorrow.reminders}
          tomorrowRemindersLoading={prepareForTomorrow.loading}
          tomorrowRemindersError={prepareForTomorrow.fetchError}
          onDismissTomorrowReminder={prepareForTomorrow.dismissReminder}
          onRefreshTomorrowReminders={prepareForTomorrow.refresh}
          activeRoutineRuns={routinesHook.activeRuns}
          completedRoutineRuns={routinesHook.completedRuns}
          routineTemplates={routinesHook.templates}
          enabledModules={enabledModules}
          preferredName={preferredName}
          userId={userId}
          avatarTheme={personalization.avatarTheme}
          character={selectedCharacter}
          bestieNotes={bestiePersonalization.notes}
          memoriesCount={lifeBestieMemory.memories.length}
        />
      )}
      {activeTab === 'planner' && (
        <PlannerPage
          tasks={tasks}
          events={events}
          routines={userMemory.memory?.routines ?? []}
          goals={goalsHook.goals}
          meals={mealPlanner.meals}
          character={selectedCharacter}
          onAddEvent={addEvent}
          onAddTask={addTask}
          onToggleTask={toggleTask}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onDeleteEvent={deleteEvent}
          onUpdateEvent={updateEvent}
          onDeleteRoutine={userMemory.removeRoutine}
          onAddMeal={mealPlanner.addMeal}
          onDeleteMeal={mealPlanner.deleteMeal}
          onUpdateMeal={mealPlanner.updateMeal}
          onDuplicateMeal={mealPlanner.duplicateMeal}
          onLinkMealToEvent={linkMealToEvent}
          tomorrowReminders={prepareForTomorrow.reminders}
          tomorrowRemindersLoading={prepareForTomorrow.loading}
          tomorrowRemindersError={prepareForTomorrow.fetchError}
          onDismissTomorrowReminder={prepareForTomorrow.dismissReminder}
          onRefreshTomorrowReminders={prepareForTomorrow.refresh}
        />
      )}

      {activeTab === 'grocery' && enabledModules.has('grocery') && (
        <GroceryPage
          items={groceryItems}
          weeklyList={weeklyGrocery.weeklyList}
          weeklyLoading={weeklyGrocery.loading}
          habits={userMemory.memory?.common_groceries ?? []}
          routines={userMemory.memory?.routines ?? []}
          recentHistory={userMemory.getRecentHistory(14)}
          weeklyBudget={groceryBudget.budget?.weekly_budget ?? 100}
          estimatedTotal={groceryBudget.budget?.current_estimated_total ?? 0}
          spendingSnapshots={spendingTrends.snapshots}
          spendingInsights={spendingTrends.getInsights()}
          meals={mealPlanner.meals}
          mealsLoading={mealPlanner.loading}
          receiptScanning={receipts.scanning}
          receiptScanError={receipts.scanError}
          character={selectedCharacter}
          onAdd={addGrocery}
          onToggle={toggleGrocery}
          onDelete={deleteGrocery}
          onToggleWeekly={weeklyGrocery.toggleWeeklyItem}
          onAddWeekly={addWeeklyItem}
          onSkipWeekly={skipWeeklyItem}
          onTogglePantryItem={weeklyGrocery.togglePantryItem}
          onRemoveWeekly={removeWeeklyItem}
          onUpdateWeeklyItemPrice={updateWeeklyItemPrice}
          onRegenerateWeekly={weeklyGrocery.regenerate}
          onSetWeeklyBudget={groceryBudget.setWeeklyBudget}
          onPlanMeals={planMeals}
          onAddMeal={mealPlanner.addMeal}
          onAddMealFull={addMealFull}
          onDeleteMeal={mealPlanner.deleteMeal}
          onUpdateMeal={mealPlanner.updateMeal}
          onScanReceipt={receipts.scanImage}
          onSaveReceipt={handleReceiptSave}
        />
      )}
      {activeTab === 'goals' && (
        <GoalsPage
          goals={goalsHook.goals}
          tasks={tasks}
          onAddGoal={goalsHook.addGoal}
          onUpdateGoal={goalsHook.updateGoal}
          onDeleteGoal={goalsHook.deleteGoal}
          onSetProgress={goalsHook.setProgress}
        />
      )}
      {/* Chat is rendered whenever the tab is active, regardless of the transient
          module-settings loading state. enabledModules may briefly report ai-assistant
          as disabled during module settings load; guarding on it would unmount Chat
          mid-conversation. The BottomNav already hides the tab when the module is
          genuinely disabled, so reaching this tab implicitly means it was enabled. */}
      {activeTab === 'chat' && (
        <ChatPage
          memory={userMemory.memory}
          tasks={tasks}
          events={events}
          goals={goalsHook.goals}
          groceryItems={groceryItems}
          weeklyList={weeklyGrocery.weeklyList}
          onAddTask={addTask}
          onAddEvent={addEvent}
          onAddGrocery={addGrocery}
          onAddWeeklyItem={addWeeklyItem}
          onUpdateMemory={userMemory.updatePreferences}
          preferredName={preferredName}
          avatarTheme={personalization.avatarTheme}
          character={selectedCharacter}
          savedMemories={lifeBestieMemory.memories}
          onSaveMemory={personalization.memoryEnabled ? lifeBestieMemory.addMemory : undefined}
          memoryEnabled={personalization.memoryEnabled}
          getRelevantMemories={lifeBestieMemory.getRelevantMemories}
        />
      )}
      {activeTab === 'movement' && enabledModules.has('movement') && (
        <MovementPage
          events={events}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
        />
      )}
      {activeTab === 'routines' && enabledModules.has('routines') && (
        <RoutinesPage
          templates={routinesHook.templates}
          todayRuns={routinesHook.todayRuns}
          loading={routinesHook.loading}
          onCreateTemplate={routinesHook.createTemplate}
          onUpdateTemplate={routinesHook.updateTemplate}
          onDeleteTemplate={routinesHook.deleteTemplate}
          onStartRun={routinesHook.startRun}
          onToggleStep={routinesHook.toggleStep}
          getRunForTemplate={routinesHook.getRunForTemplate}
        />
      )}
      {activeTab === 'bestie' && (
        <MyBestiePage
          preferredName={userProfile.profile?.preferred_name ?? ''}
          currentTheme={personalization.theme}
          currentBgSkin={personalization.bgSkin}
          currentAvatarTheme={personalization.avatarTheme}
          character={selectedCharacter}
          onSetCharacter={(id) => userProfile.saveProfile({ character_id: id })}
          isEnabled={moduleSettings.isEnabled}
          memories={lifeBestieMemory.memories}
          memoriesLoading={lifeBestieMemory.loading}
          onAddMemory={lifeBestieMemory.addMemory}
          onUpdateMemory={lifeBestieMemory.updateMemory}
          onDeleteMemory={lifeBestieMemory.deleteMemory}
          bestieNotes={bestiePersonalization.notes}
          onSaveNotes={bestiePersonalization.saveNotes}
          relationship={bestieRelationship}
        />
      )}
      {activeTab === 'settings' && (
        <SettingsPage
          isEnabled={moduleSettings.isEnabled}
          onSetEnabled={moduleSettings.setEnabled}
          currentTheme={personalization.theme}
          currentBgSkin={personalization.bgSkin}
          currentAvatarTheme={personalization.avatarTheme}
          onSetTheme={personalization.setTheme}
          onSetBgSkin={personalization.setBgSkin}
          onSetAvatarTheme={personalization.setAvatarTheme}
          memoryEnabled={personalization.memoryEnabled}
          onSetMemoryEnabled={personalization.setMemoryEnabled}
        />
      )}

      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'add') { setQuickAddOpen(true); return; }
          setActiveTab(tab);
        }}
        enabledModules={enabledModules}
      />

      <FloatingBestie
        characterId={selectedCharacter}
        expression={floatingExpression}
        activeTab={activeTab}
      />

      <QuickAddSheet
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onAddTask={addTask}
        onAddEvent={addEvent}
        onAddGrocery={addGrocery}
      />

      {userMemory.confirmingCandidate && (
        <RoutineConfirmSheet
          candidate={userMemory.confirmingCandidate}
          onAccept={userMemory.acceptRoutineSuggestion}
          onDismiss={() => userMemory.dismissRoutineSuggestion(userMemory.confirmingCandidate!.taskTitle)}
          onClose={userMemory.closeRoutineSheet}
        />
      )}
    </div>
  );
}
