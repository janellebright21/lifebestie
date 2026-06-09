import { useState, useEffect, useCallback } from 'react';
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
import BottomNav, { TabName } from './components/BottomNav';
import RoutineConfirmSheet from './components/RoutineConfirmSheet';
import HomePage from './pages/HomePage';
import PlannerPage from './pages/PlannerPage';
import AddPage from './pages/AddPage';
import GroceryPage from './pages/GroceryPage';
import GoalsPage from './pages/GoalsPage';
import ChatPage from './pages/ChatPage';
import AuthPage from './pages/AuthPage';

const MEMORY_ID_KEY = 'lifebestie_memory_id';

export default function App() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);

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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setTasks([]);
        setEvents([]);
        setGroceryItems([]);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!session) return;

    const [
      { data: t },
      { data: e },
      { data: g }
    ] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),

      supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('event_date', { ascending: true }),

      supabase
        .from('grocery_items')
        .select('*')
        .eq('user_id', userId)
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

  // ── Guard: show auth page if not signed in (after all hooks) ──────────────
  if (!session) {
    return <AuthPage />;
  }

  const userId = session.user.id;

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
      if (completed) await userMemory.addHistoryAction(`Completed task: ${task.title}`);
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

  async function addEvent(title: string, date: string, time: string, category?: EventCategory, location?: string, notes?: string) {
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
    dbError('events (insert)', error);
    if (data) {
      setEvents((prev) => [...prev, data].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      await userMemory.addHistoryAction(`Added event: ${title} on ${date}`);
    }
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
    return await mealPlanner.addMealFull(opts);
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
  return (
    <div className="min-h-[100dvh] bg-gray-50 font-sans">
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
          onTabChange={setActiveTab}
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
          tomorrowReminders={prepareForTomorrow.reminders}
          tomorrowRemindersLoading={prepareForTomorrow.loading}
          onDismissTomorrowReminder={prepareForTomorrow.dismissReminder}
          onRefreshTomorrowReminders={prepareForTomorrow.refresh}
        />
      )}
      {activeTab === 'planner' && (
        <PlannerPage
          tasks={tasks}
          events={events}
          routines={userMemory.memory?.routines ?? []}
          goals={goalsHook.goals}
          meals={mealPlanner.meals}
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
          onDismissTomorrowReminder={prepareForTomorrow.dismissReminder}
          onRefreshTomorrowReminders={prepareForTomorrow.refresh}
        />
      )}
      {activeTab === 'add' && (
        <AddPage
          onAddTask={addTask}
          onAddEvent={addEvent}
          onAddGrocery={addGrocery}
          goals={goalsHook.goals}
        />
      )}
      {activeTab === 'grocery' && (
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
        />
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

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
