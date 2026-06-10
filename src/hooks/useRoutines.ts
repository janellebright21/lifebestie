import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, RoutineTemplate, RoutineRun, RoutineStep } from '../lib/supabase';

function generateId(): string {
  return crypto.randomUUID();
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function useRoutines() {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [todayRuns, setTodayRuns] = useState<RoutineRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: tmpl }, { data: runs }] = await Promise.all([
      supabase
        .from('routine_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('routine_runs')
        .select('*')
        .eq('user_id', user.id)
        .eq('run_date', today()),
    ]);

    if (tmpl) setTemplates(tmpl as RoutineTemplate[]);
    if (runs) setTodayRuns(runs as RoutineRun[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Template CRUD ─────────────────────────────────────────────────────────

  async function createTemplate(name: string, stepTitles: string[]): Promise<RoutineTemplate | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const steps: RoutineStep[] = stepTitles
      .filter((t) => t.trim())
      .map((t) => ({ id: generateId(), title: t.trim() }));

    const { data, error } = await supabase
      .from('routine_templates')
      .insert({ user_id: user.id, name: name.trim(), steps })
      .select()
      .single();
    dbError('routine_templates (insert)', error);
    if (!data) return null;
    const template = data as RoutineTemplate;
    setTemplates((prev) => [...prev, template]);
    return template;
  }

  async function updateTemplate(
    id: string,
    name: string,
    stepTitles: string[]
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const steps: RoutineStep[] = stepTitles
      .filter((t) => t.trim())
      .map((t) => {
        // Preserve existing step IDs by matching on title so completed_step_ids stay valid
        const existing = templates.find((tmpl) => tmpl.id === id)
          ?.steps.find((s) => s.title === t.trim());
        return { id: existing?.id ?? generateId(), title: t.trim() };
      });

    const patch = { name: name.trim(), steps, updated_at: new Date().toISOString() };
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
    await supabase.from('routine_templates').update(patch).eq('id', id).eq('user_id', user.id);
  }

  async function deleteTemplate(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setTodayRuns((prev) => prev.filter((r) => r.template_id !== id));
    await supabase.from('routine_templates').delete().eq('id', id).eq('user_id', user.id);
  }

  // ── Running a routine ─────────────────────────────────────────────────────

  /** Start running a routine for today. If already started, returns the existing run. */
  async function startRun(templateId: string): Promise<RoutineRun | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const existing = todayRuns.find((r) => r.template_id === templateId);
    if (existing) return existing;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return null;

    const { data, error } = await supabase
      .from('routine_runs')
      .insert({
        user_id: user.id,
        template_id: templateId,
        run_date: today(),
        steps_snapshot: template.steps,
        completed_step_ids: [],
      })
      .select()
      .single();
    dbError('routine_runs (insert)', error);
    if (!data) return null;
    const run = data as RoutineRun;
    setTodayRuns((prev) => [...prev, run]);
    return run;
  }

  /** Toggle a step in a run. */
  async function toggleStep(runId: string, stepId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const run = todayRuns.find((r) => r.id === runId);
    if (!run) return;

    const isCompleted = run.completed_step_ids.includes(stepId);
    const nextIds = isCompleted
      ? run.completed_step_ids.filter((id) => id !== stepId)
      : [...run.completed_step_ids, stepId];

    setTodayRuns((prev) =>
      prev.map((r) => r.id === runId ? { ...r, completed_step_ids: nextIds } : r)
    );

    await supabase
      .from('routine_runs')
      .update({ completed_step_ids: nextIds, updated_at: new Date().toISOString() })
      .eq('id', runId)
      .eq('user_id', user.id);
  }

  // ── Derived helpers ───────────────────────────────────────────────────────

  function getRunForTemplate(templateId: string): RoutineRun | undefined {
    return todayRuns.find((r) => r.template_id === templateId);
  }

  /** Active runs that have at least one step checked but aren't fully done. */
  const activeRuns = todayRuns.filter(
    (r) => r.completed_step_ids.length > 0 &&
           r.completed_step_ids.length < r.steps_snapshot.length
  );

  /** Fully completed runs today. */
  const completedRuns = todayRuns.filter(
    (r) => r.steps_snapshot.length > 0 &&
           r.completed_step_ids.length >= r.steps_snapshot.length
  );

  return {
    templates,
    todayRuns,
    activeRuns,
    completedRuns,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    startRun,
    toggleStep,
    getRunForTemplate,
  };
}
