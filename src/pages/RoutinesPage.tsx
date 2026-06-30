import { useState } from 'react';
import {
  Plus, Pencil, Trash2, Play, CheckCircle2, Circle,
  X, ChevronDown, ChevronUp,
  ListChecks,
} from 'lucide-react';
import { RoutineTemplate, RoutineRun } from '../lib/supabase';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoutinesPageProps {
  templates: RoutineTemplate[];
  todayRuns: RoutineRun[];
  loading: boolean;
  onCreateTemplate: (name: string, steps: string[]) => Promise<RoutineTemplate | null>;
  onUpdateTemplate: (id: string, name: string, steps: string[]) => Promise<void>;
  onDeleteTemplate: (id: string) => Promise<void>;
  onStartRun: (templateId: string) => Promise<RoutineRun | null>;
  onToggleStep: (runId: string, stepId: string) => Promise<void>;
  getRunForTemplate: (templateId: string) => RoutineRun | undefined;
}

// ─── Routine form (create / edit) ─────────────────────────────────────────────

function RoutineForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string; steps: string[] };
  onSave: (name: string, steps: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [steps, setSteps] = useState<string[]>(
    initial?.steps?.length ? initial.steps : ['']
  );
  const [saving, setSaving] = useState(false);

  function addStep() { setSteps((s) => [...s, '']); }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)); }
  function updateStep(i: number, val: string) {
    setSteps((s) => s.map((v, idx) => idx === i ? val : v));
  }
  function moveStep(i: number, dir: -1 | 1) {
    const next = [...steps];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    setSteps(next);
  }

  async function handleSave() {
    if (!name.trim() || saving) return;
    const validSteps = steps.filter((s) => s.trim());
    if (validSteps.length === 0) return;
    setSaving(true);
    await onSave(name.trim(), validSteps);
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
            Routine name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Routine"
            className="w-full text-sm bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-200 text-gray-800 placeholder-gray-400"
          />
        </div>

        {/* Steps */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
            Steps
          </label>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    onClick={() => moveStep(i, 1)}
                    disabled={i === steps.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>
                <span className="text-xs text-gray-400 w-4 text-right shrink-0">{i + 1}.</span>
                <input
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  className="flex-1 text-sm bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-200 text-gray-800 placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addStep(); }
                  }}
                />
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(i)}
                    className="shrink-0 text-gray-300 hover:text-rose-400 transition-colors"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addStep}
            className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 font-semibold hover:text-rose-500 transition-colors"
          >
            <Plus size={13} /> Add step
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 active:scale-95 transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="flex-1 py-2.5 rounded-xl theme-bg-primary text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? 'Saving…' : 'Save Routine'}
        </button>
      </div>
    </div>
  );
}

// ─── Routine run card ─────────────────────────────────────────────────────────

function RunCard({
  template,
  run,
  onToggle,
}: {
  template: RoutineTemplate;
  run: RoutineRun;
  onToggle: (stepId: string) => void;
}) {
  const done = run.completed_step_ids.length;
  const total = run.steps_snapshot.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done >= total;

  return (
    <div className={`rounded-2xl border overflow-hidden ${allDone ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListChecks size={14} className={allDone ? 'text-emerald-500' : 'text-rose-400'} />
            <span className={`text-sm font-bold ${allDone ? 'text-emerald-700' : 'text-gray-800'}`}>
              {template.name}
            </span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${allDone ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
            {done}/{total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${allDone ? 'bg-emerald-400' : ''}`}
            style={{ width: `${pct}%`, backgroundColor: allDone ? undefined : 'var(--theme-primary)' }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-1.5">
          {run.steps_snapshot.map((step) => {
            const isDone = run.completed_step_ids.includes(step.id);
            return (
              <button
                key={step.id}
                onClick={() => onToggle(step.id)}
                className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
              >
                {isDone
                  ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  : <Circle size={18} className="text-gray-300 shrink-0" />
                }
                <span className={`text-sm flex-1 ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>

        {allDone && (
          <p className="mt-3 text-xs font-semibold text-emerald-600 text-center">
            Routine complete!
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  run,
  onRun,
  onEdit,
  onDelete,
  onToggleStep,
}: {
  template: RoutineTemplate;
  run?: RoutineRun;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStep: (stepId: string) => void;
}) {
  const [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleRun() {
    if (starting) return;
    setStarting(true);
    await onRun();
    setStarting(false);
  }

  if (run) {
    return <RunCard template={template} run={run} onToggle={onToggleStep} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-primary-light)' }}>
            <ListChecks size={15} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{template.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{template.steps.length} steps</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-sky-500 transition-colors"
              aria-label="Edit"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-rose-400 transition-colors"
              aria-label="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Step preview */}
        {expanded && template.steps.length > 0 && (
          <div className="mt-3 space-y-1.5 pl-11">
            {template.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 w-4 text-right shrink-0">{i + 1}.</span>
                <span className="text-xs text-gray-600">{step.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-50 px-4 py-3">
        <button
          onClick={handleRun}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl theme-bg-primary text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform shadow-sm"
        >
          <Play size={14} />
          {starting ? 'Starting…' : 'Run Routine'}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoutinesPage({
  templates,
  todayRuns: _todayRuns,
  loading,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onStartRun,
  onToggleStep,
  getRunForTemplate,
}: RoutinesPageProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingTemplate = templates.find((t) => t.id === editingId);

  async function handleCreate(name: string, steps: string[]) {
    await onCreateTemplate(name, steps);
    setMode('list');
  }

  async function handleUpdate(name: string, steps: string[]) {
    if (!editingId) return;
    await onUpdateTemplate(editingId, name, steps);
    setMode('list');
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await onDeleteTemplate(id);
    setConfirmDeleteId(null);
  }

  function startEdit(id: string) {
    setEditingId(id);
    setMode('edit');
  }

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--theme-primary-light)' }}>
              <ListChecks size={18} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-none">Routines</h1>
              <p className="text-xs text-gray-400 mt-0.5">Build and run your daily routines</p>
            </div>
          </div>
          {mode === 'list' && (
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-1.5 theme-bg-primary text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              <Plus size={13} /> New
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Create form */}
        {mode === 'create' && (
          <RoutineForm
            onSave={handleCreate}
            onCancel={() => setMode('list')}
          />
        )}

        {/* Edit form */}
        {mode === 'edit' && editingTemplate && (
          <RoutineForm
            initial={{
              name: editingTemplate.name,
              steps: editingTemplate.steps.map((s) => s.title),
            }}
            onSave={handleUpdate}
            onCancel={() => { setMode('list'); setEditingId(null); }}
          />
        )}

        {/* Loading */}
        {loading && mode === 'list' && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-rose-200 border-t-rose-400 animate-spin" />
            <span className="text-sm text-gray-400">Loading routines…</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && mode === 'list' && templates.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
              <ListChecks size={26} className="text-rose-300" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-700">No routines yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">
                Create a routine to group your daily steps and run them with one tap.
              </p>
            </div>
            <button
              onClick={() => setMode('create')}
              className="flex items-center gap-2 theme-bg-primary text-white text-sm font-bold px-4 py-2.5 rounded-xl active:scale-95 transition-transform"
            >
              <Plus size={14} /> Create your first routine
            </button>
          </div>
        )}

        {/* Template list */}
        {mode === 'list' && templates.map((template) => {
          const run = getRunForTemplate(template.id);
          return (
            <div key={template.id}>
              {/* Delete confirm */}
              {confirmDeleteId === template.id ? (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl px-4 py-4 space-y-3">
                  <p className="text-sm font-semibold text-rose-700">
                    Delete "{template.name}"?
                  </p>
                  <p className="text-xs text-rose-500">This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-2 rounded-xl border border-rose-200 text-sm font-semibold text-rose-500 active:scale-95 transition-transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="flex-1 py-2 rounded-xl theme-bg-primary text-white text-sm font-bold active:scale-95 transition-transform"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <TemplateCard
                  template={template}
                  run={run}
                  onRun={() => onStartRun(template.id)}
                  onEdit={() => startEdit(template.id)}
                  onDelete={() => setConfirmDeleteId(template.id)}
                  onToggleStep={(stepId) => run && onToggleStep(run.id, stepId)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
