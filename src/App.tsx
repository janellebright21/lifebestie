import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, Task, Event, GroceryItem, GroceryCategory, MealIngredient, TaskCategory, TaskPriority, EventCategory } from './lib/supabase';
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
  const memoryId = userMemory.memory?.id ?? null;

  const showAuthDebug = new URLSearchParams(window.location.search).get('debugAuth') === '1';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('events')
      .select('*')
      .eq('user_id', session.user.id)
      .order('event_date', { ascending: true }),

    supabase
      .from('grocery_items')
      .select('*')
      .eq('user_id', session.user.id)
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
@@ -288,50 +300,58 @@ const fetchAll = useCallback(async () => {

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
      {showAuthDebug && session && (
        <div className="fixed top-2 right-2 z-50 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-[11px] text-gray-700 shadow-sm">
          <div><span className="font-semibold">User:</span> {session.user.email ?? session.user.id}</div>
          <div><span className="font-semibold">User ID:</span> {session.user.id}</div>
          <div><span className="font-semibold">Memory ID:</span> {memoryId ?? 'none'}</div>
          <div><span className="font-semibold">Counts:</span> T {tasks.length} · E {events.length} · G {groceryItems.length}</div>
        </div>
      )}
      {activeTab === 'home' && (
        <HomePage
          tasks={tasks}
          events={events}
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