import { useState, useEffect, useCallback } from 'react';
import { supabase, Goal, GoalCategory, GoalPriority, Task } from '../lib/supabase';

const MEMORY_ID_KEY = 'lifebestie_memory_id';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const memoryId = localStorage.getItem(MEMORY_ID_KEY);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setGoals(data as Goal[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addGoal(fields: {
    title: string;
    category: GoalCategory;
    priority: GoalPriority;
    deadline?: string;
  }): Promise<Goal | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('goals')
      .insert({
        memory_id: memoryId,
        user_id: user.id,
        title: fields.title,
        category: fields.category,
        priority: fields.priority,
        deadline: fields.deadline ?? null,
        progress: 0,
        linked_tasks: [],
      })
      .select()
      .single();
    if (data) {
      setGoals((prev) => [data as Goal, ...prev]);
      return data as Goal;
    }
    return null;
  }

  async function updateGoal(id: string, patch: Partial<Pick<Goal, 'title' | 'category' | 'priority' | 'deadline' | 'progress' | 'linked_tasks'>>) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('goals').update(patch).eq('id', id).eq('user_id', user.id);
  }

  async function setProgress(id: string, progress: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(progress)));
    await updateGoal(id, { progress: clamped });
  }

  /**
   * Recalculates a goal's progress based on how many of its linked tasks are
   * completed. Progress = (completed / total) * 100, rounded to nearest int.
   * If there are no linked tasks, progress is left unchanged.
   */
  async function recalculateGoalProgress(goalId: string, allTasks: Task[]) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || goal.linked_tasks.length === 0) return;

    const linked = allTasks.filter((t) => t.linked_goal_id === goalId);
    if (linked.length === 0) return;

    const completedCount = linked.filter((t) => t.completed).length;
    const newProgress = Math.round((completedCount / linked.length) * 100);
    await updateGoal(goalId, { progress: newProgress });
  }

  async function deleteGoal(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('tasks').update({ linked_goal_id: null }).eq('linked_goal_id', id).eq('user_id', user.id);
    await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id);
  }

  /**
   * Links a task to a goal: sets task.linked_goal_id and appends the task id
   * to goal.linked_tasks. Idempotent.
   */
  async function linkTaskToGoal(taskId: string, goalId: string) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    if (goal.linked_tasks.includes(taskId)) return;

    const updatedLinked = [...goal.linked_tasks, taskId];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all([
      supabase.from('tasks').update({ linked_goal_id: goalId }).eq('id', taskId).eq('user_id', user.id),
      supabase.from('goals').update({ linked_tasks: updatedLinked }).eq('id', goalId).eq('user_id', user.id),
    ]);
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, linked_tasks: updatedLinked } : g));
  }

  /**
   * Unlinks a task from its goal: clears task.linked_goal_id and removes
   * the task id from goal.linked_tasks.
   */
  async function unlinkTaskFromGoal(taskId: string, goalId: string) {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const updatedLinked = goal.linked_tasks.filter((id) => id !== taskId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all([
      supabase.from('tasks').update({ linked_goal_id: null }).eq('id', taskId).eq('user_id', user.id),
      supabase.from('goals').update({ linked_tasks: updatedLinked }).eq('id', goalId).eq('user_id', user.id),
    ]);
    setGoals((prev) => prev.map((g) => g.id === goalId ? { ...g, linked_tasks: updatedLinked } : g));
  }

  return {
    goals,
    loading,
    addGoal,
    updateGoal,
    setProgress,
    recalculateGoalProgress,
    linkTaskToGoal,
    unlinkTaskFromGoal,
    deleteGoal,
  };
}
