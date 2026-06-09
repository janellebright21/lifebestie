import { useState } from 'react';
import {
  Sparkles, RefreshCw, CheckCircle2, Circle, Target, Timer,
  ChevronDown, ChevronUp, Zap, Star, X, RotateCcw, TrendingDown, Clock,
} from 'lucide-react';
import { DailyPlan, PlanTask, AdaptationEvent, AdaptationType } from '../hooks/useDailyPlanner';

interface DailyPlanCardProps {
  plan: DailyPlan | null;
  loading: boolean;
  generating: boolean;
  generationError: boolean;
  onGenerate: () => void;
  onToggleTask: (taskId: string, completed: boolean) => void;
  onDismissAdaptation: (id: string) => void;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Adaptation nudge banner ──────────────────────────────────────────────────

const ADAPTATION_STYLES: Record<AdaptationType, { icon: React.ReactNode; bg: string; text: string; border: string }> = {
  reschedule:   { icon: <RotateCcw size={13} />,    bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-100'   },
  next_task:    { icon: <Zap size={13} />,           bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100' },
  load_reduced: { icon: <TrendingDown size={13} />,  bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-100'  },
  time_hint:    { icon: <Clock size={13} />,         bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-100'  },
};

function AdaptationBanner({ event, onDismiss }: { event: AdaptationEvent; onDismiss: () => void }) {
  const s = ADAPTATION_STYLES[event.type];
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 rounded-xl border ${s.bg} ${s.border}`}>
      <span className={`shrink-0 mt-0.5 ${s.text}`}>{s.icon}</span>
      <p className={`flex-1 text-xs leading-relaxed font-medium ${s.text}`}>{event.message}</p>
      <button
        onClick={onDismiss}
        className={`shrink-0 mt-0.5 ${s.text} opacity-50 hover:opacity-100 transition-opacity active:scale-95`}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  checkColor,
  onToggle,
}: {
  task: PlanTask;
  checkColor: string;
  onToggle: () => void;
}) {
  const [showReason, setShowReason] = useState(false);

  return (
    <div className={`transition-opacity ${task.completed ? 'opacity-45' : ''}`}>
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button onClick={onToggle} className="shrink-0 mt-0.5 active:scale-90 transition-transform">
          {task.completed
            ? <CheckCircle2 size={18} className={checkColor} />
            : <Circle size={18} className="text-gray-300 hover:text-gray-400 transition-colors" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-snug ${task.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.linked_goal_title && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Target size={9} />
                {task.linked_goal_title.length > 22 ? task.linked_goal_title.slice(0, 22) + '…' : task.linked_goal_title}
              </span>
            )}
            {task.duration != null && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Timer size={9} />
                {formatDuration(task.duration)}
              </span>
            )}
            {task.reason && (
              <button
                onClick={() => setShowReason((v) => !v)}
                className="flex items-center gap-0.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showReason ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                why?
              </button>
            )}
          </div>
          {showReason && task.reason && (
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed italic pl-0.5">{task.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function PlanSkeleton() {
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <span className="text-xs text-gray-400">Building your morning plan…</span>
      </div>
      {[72, 58, 88, 50, 68].map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-4 h-4 rounded-full bg-gray-100 animate-pulse shrink-0" />
          <div className="h-3.5 rounded-full bg-gray-100 animate-pulse" style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}

// ─── Load hint pill ───────────────────────────────────────────────────────────

function LoadPill({ hint }: { hint: 'light' | 'normal' | 'heavy' }) {
  if (hint === 'normal') return null;
  const styles = {
    light: 'bg-teal-50 text-teal-600 border-teal-100',
    heavy: 'bg-rose-50 text-rose-500 border-rose-100',
  };
  const labels = { light: 'Light day', heavy: 'Full day' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[hint]}`}>
      {labels[hint]}
    </span>
  );
}

// ─── Next-task suggestion (shown when ahead of schedule) ─────────────────────

function NextTaskSuggestion({ remaining, onSeeAll }: { remaining: number; onSeeAll: () => void }) {
  return (
    <div className="mx-3 mb-3 flex items-center justify-between gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-amber-500 shrink-0" />
        <p className="text-xs font-semibold text-amber-700">
          You're doing great — {remaining} task{remaining !== 1 ? 's' : ''} left!
        </p>
      </div>
      <button
        onClick={onSeeAll}
        className="shrink-0 text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors"
      >
        See all →
      </button>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function DailyPlanCard({
  plan,
  loading,
  generating,
  generationError,
  onGenerate,
  onToggleTask,
  onDismissAdaptation,
}: DailyPlanCardProps) {
  const [showNextHint, setShowNextHint] = useState(false);

  const allTasks = plan ? [...plan.high_impact, ...plan.small_wins] : [];
  const doneCount = allTasks.filter((t) => t.completed).length;
  const totalCount = allTasks.length;
  const remainingCount = totalCount - doneCount;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  // Active (undismissed) adaptations
  const activeAdaptations = plan?.adaptations.filter((a) => !a.dismissed) ?? [];

  // Show next-task nudge when user completes ≥ half but not all
  const showNudge = !allDone && doneCount > 0 && doneCount >= Math.ceil(totalCount / 2) && !showNextHint;

  // Empty / CTA state
  if (!loading && !generating && !plan) {
    return (
      <div className="bg-gradient-to-br from-amber-50 to-rose-50 rounded-2xl border border-amber-100 px-4 py-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Morning Plan</p>
            <p className="text-xs text-gray-400">AI-powered, adapts to your pace</p>
          </div>
        </div>
        {generationError ? (
          <p className="text-xs text-gray-400 leading-relaxed">
            AI help is not available right now, but you can still use the manual tools.
          </p>
        ) : (
          <p className="text-xs text-gray-500 leading-relaxed">
            Get a personalised plan built around your goals — 5–6 focused tasks, zero overwhelm. It learns from how you work.
          </p>
        )}
        <button
          onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-bold py-3 rounded-xl active:scale-[0.98] transition-all shadow-sm shadow-amber-200"
        >
          <Sparkles size={14} />
          {generationError ? 'Try Again' : 'Generate My Morning Plan'}
        </button>
      </div>
    );
  }

  if (loading || generating) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-50 px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Sparkles size={15} className="text-amber-400" />
          </div>
          <p className="text-sm font-bold text-gray-700">Morning Plan</p>
        </div>
        <PlanSkeleton />
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-50 overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              {allDone
                ? <CheckCircle2 size={15} className="text-emerald-400" />
                : <Sparkles size={15} className="text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800">
                  {allDone ? 'Day complete!' : 'Morning Plan'}
                </p>
                <LoadPill hint={plan.load_hint} />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {doneCount}/{totalCount} done
              </p>
            </div>
          </div>
          <button
            onClick={onGenerate}
            title="Regenerate plan"
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors active:scale-95"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              allDone
                ? 'bg-gradient-to-r from-emerald-300 to-teal-400'
                : 'bg-gradient-to-r from-amber-300 to-rose-300'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* AI message */}
        {plan.message && (
          <p className="text-xs text-gray-500 leading-relaxed italic">"{plan.message}"</p>
        )}
      </div>

      {/* ── Adaptation nudges ── */}
      {activeAdaptations.length > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {activeAdaptations.map((event) => (
            <AdaptationBanner
              key={event.id}
              event={event}
              onDismiss={() => onDismissAdaptation(event.id)}
            />
          ))}
        </div>
      )}

      {/* ── Tasks ── */}
      <div className="pb-3 space-y-1">
        {/* High Impact */}
        {plan.high_impact.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Zap size={11} className="text-rose-400" />
              <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">High Impact</span>
            </div>
            <div className="divide-y divide-gray-50">
              {plan.high_impact.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  checkColor="text-rose-400"
                  onToggle={() => onToggleTask(task.id, !task.completed)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Small Wins */}
        {plan.small_wins.length > 0 && (
          <div className="mt-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              <Star size={11} className="text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Small Wins</span>
            </div>
            <div className="divide-y divide-gray-50">
              {plan.small_wins.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  checkColor="text-emerald-400"
                  onToggle={() => onToggleTask(task.id, !task.completed)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Next-task nudge (completing ahead of schedule) ── */}
      {showNudge && (
        <NextTaskSuggestion
          remaining={remainingCount}
          onSeeAll={() => setShowNextHint(true)}
        />
      )}

      {/* ── All-done celebration ── */}
      {allDone && (
        <div className="mx-4 mb-4 flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 leading-relaxed">
            You crushed today's plan! Give yourself credit — every completed task adds up.
          </p>
        </div>
      )}
    </div>
  );
}
