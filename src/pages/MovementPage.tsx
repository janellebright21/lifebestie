import { useState } from 'react';
import { Activity, CheckCircle2, Circle, Flame, Zap, Wind, ChevronDown, ChevronUp, Plus, Clock, Trophy } from 'lucide-react';
import { Event, EventCategory } from '../lib/supabase';
import {
  EnergyLevel,
  MovementActivity,
  MOVEMENT_OPTIONS,
  TodayMovement,
  encodeMovementNotes,
  useMovement,
} from '../hooks/useMovement';


interface MovementPageProps {
  events: Event[];
  onAddEvent: (
    title: string,
    date: string,
    time: string,
    category?: EventCategory,
    location?: string,
    notes?: string
  ) => Promise<Event>;
  onUpdateEvent: (
    id: string,
    patch: Partial<Pick<Event, 'title' | 'event_date' | 'event_time' | 'category' | 'location' | 'notes'>>
  ) => Promise<void>;
}

const LEVEL_ICONS: Record<EnergyLevel, React.ReactNode> = {
  low:      <Wind size={16} />,
  moderate: <Zap size={16} />,
  high:     <Flame size={16} />,
};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({
  activity,
  level,
  isAdded,
  isCompleted,
  onAdd,
  onComplete,
}: {
  activity: MovementActivity;
  level: EnergyLevel;
  isAdded: boolean;
  isCompleted: boolean;
  onAdd: () => void;
  onComplete: () => void;
}) {
  const { color } = MOVEMENT_OPTIONS[level];

  return (
    <div className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${color.bg} ${color.border}`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${color.text}`}>{activity.label}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Clock size={10} className="text-gray-400" />
          <span className="text-xs text-gray-400">{activity.duration}</span>
        </div>
      </div>

      {isAdded ? (
        <button
          onClick={onComplete}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-600 border border-emerald-200'
              : `${color.bg} ${color.text} border ${color.border} hover:opacity-80`
          }`}
        >
          {isCompleted
            ? <><CheckCircle2 size={13} /> Done</>
            : <><Circle size={13} /> Mark done</>
          }
        </button>
      ) : (
        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${color.bg} ${color.text} ${color.border} hover:opacity-80`}
        >
          <Plus size={13} />
          Add
        </button>
      )}
    </div>
  );
}

// ─── Energy level section ─────────────────────────────────────────────────────

function EnergySection({
  level,
  todayMovements,
  onAdd,
  onComplete,
}: {
  level: EnergyLevel;
  todayMovements: TodayMovement[];
  onAdd: (activity: MovementActivity) => void;
  onComplete: (movement: TodayMovement) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const opts = MOVEMENT_OPTIONS[level];
  const { color } = opts;

  const addedForLevel = todayMovements.filter((m) => m.level === level);

  return (
    <div className={`rounded-2xl border ${color.bg} ${color.border} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color.badge}`}>
            <span className={color.icon}>{LEVEL_ICONS[level]}</span>
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${color.text}`}>{opts.label}</p>
            <p className="text-xs text-gray-400">{opts.duration} · {opts.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {addedForLevel.length > 0 && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color.badge}`}>
              {addedForLevel.filter((m) => m.done).length}/{addedForLevel.length} done
            </span>
          )}
          <span className={color.icon}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </button>

      {/* Activities */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {opts.activities.map((activity) => {
            const addedMovement = addedForLevel.find((m) => m.activityLabel === activity.label);
            return (
              <ActivityCard
                key={activity.id}
                activity={activity}
                level={level}
                isAdded={!!addedMovement}
                isCompleted={addedMovement?.done ?? false}
                onAdd={() => onAdd(activity)}
                onComplete={() => addedMovement && onComplete(addedMovement)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Today's movement summary ─────────────────────────────────────────────────

function TodaySummary({ todayMovements }: { todayMovements: TodayMovement[] }) {
  if (todayMovements.length === 0) return null;

  const done = todayMovements.filter((m) => m.done).length;
  const total = todayMovements.length;
  const allDone = done === total;

  return (
    <div className={`rounded-2xl border px-4 py-3.5 space-y-2 ${
      allDone ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center gap-2">
        <Activity size={14} className={allDone ? 'text-emerald-500' : 'text-gray-400'} />
        <p className={`text-xs font-bold ${allDone ? 'text-emerald-700' : 'text-gray-600'}`}>
          {allDone ? "Great work! All movements done today." : `Today's movement — ${done}/${total} complete`}
        </p>
      </div>
      <div className="space-y-1.5">
        {todayMovements.map((m) => {
          const levelColor = MOVEMENT_OPTIONS[m.level].color;
          return (
            <div key={m.event.id} className="flex items-center gap-2">
              {m.done
                ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                : <Circle size={13} className="text-gray-300 shrink-0" />
              }
              <span className={`text-xs ${m.done ? 'text-gray-500' : 'text-gray-700'} ${m.done ? 'line-through' : ''}`}>
                {m.activityLabel}
              </span>
              <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${levelColor.badge}`}>
                {MOVEMENT_OPTIONS[m.level].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MovementPage({ events, onAddEvent, onUpdateEvent }: MovementPageProps) {
  const { todayMovements, streakResult } = useMovement(events);
  const [adding, setAdding] = useState<string | null>(null);

  async function handleAdd(activity: MovementActivity) {
    if (adding === activity.id) return;
    setAdding(activity.id);
    try {
      await onAddEvent(
        activity.label,
        getToday(),
        getNow(),
        'Movement',
        undefined,
        encodeMovementNotes(activity.label, activity.energyLevel, false)
      );
    } finally {
      setAdding(null);
    }
  }

  async function handleComplete(movement: TodayMovement) {
    const updatedNotes = encodeMovementNotes(movement.activityLabel, movement.level, !movement.done);
    await onUpdateEvent(movement.event.id, { notes: updatedNotes });
  }

  const levels: EnergyLevel[] = ['low', 'moderate', 'high'];

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-32">
      {/* Header */}
      <div className="border-b px-4 pt-12 pb-4 sticky top-0 z-10" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'rgba(0,0,0,0.06)' }}>
        <div className="max-w-2xl mx-auto flex items-center">
          <div className="flex-1 min-w-0">
            <h1 className="bl-page-title leading-none">Movement</h1>
            <p className="text-xs text-gray-400 mt-0.5">Pick what fits your energy today</p>
          </div>
          {streakResult.streak > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-2.5 py-1.5 shrink-0">
              <Trophy size={12} className="text-amber-500" />
              <span className="text-xs font-bold text-amber-600">{streakResult.streak}d</span>
            </div>
          )}
        </div>
        {streakResult.streak > 0 && (
          <div className="max-w-2xl mx-auto mt-2 px-0.5">
            <p className="text-xs text-amber-600 font-medium">{streakResult.message}</p>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Today summary */}
        <TodaySummary todayMovements={todayMovements} />

        {/* Energy level sections */}
        {levels.map((level) => (
          <EnergySection
            key={level}
            level={level}
            todayMovements={todayMovements}
            onAdd={handleAdd}
            onComplete={handleComplete}
          />
        ))}

        {/* Tip */}
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5">
          <Flame size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Any movement counts. Even 5 minutes of stretching is better than none — consistency beats intensity every time.
          </p>
        </div>
      </div>
    </div>
  );
}
