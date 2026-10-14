import { useState, useRef } from 'react';
import { Activity, CheckCircle2, Circle, Flame, Zap, Wind, ChevronDown, ChevronUp, Plus, Clock, Trophy, Calendar } from 'lucide-react';
import { Event, EventCategory } from '../lib/supabase';
import {
  EnergyLevel,
  MovementActivity,
  MOVEMENT_OPTIONS,
  TodayMovement,
  TIME_RANGES,
  TimeRange,
  activitiesForTimeRange,
  encodeMovementNotes,
  getWeeklyMovements,
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

// ─── Workout pose thumbnail ──────────────────────────────────────────────────

const WORKOUT_DEMO_SHEET = '/assets/exec/exec-3ad98760-df7f-4d2d-aba6-3fcf43915e1d.png';
const SHEET_COLS = 3;
const SHEET_ROWS = 3;

const POSE_TILES: Record<string, { row: number; col: number; alt: string }> = {
  'low-walk':      { row: 0, col: 0, alt: 'Emma demonstrating a walk around the block' },
  'low-stretch':   { row: 0, col: 1, alt: 'Emma demonstrating a stretching routine' },
  'low-mobility':  { row: 0, col: 2, alt: 'Emma demonstrating a mobility routine' },
  'mod-bodyweight':{ row: 1, col: 0, alt: 'Emma demonstrating a bodyweight workout' },
  'mod-bands':     { row: 1, col: 1, alt: 'Emma demonstrating resistance band exercises' },
  'mod-fastwalk':  { row: 1, col: 2, alt: 'Emma demonstrating a fast walk' },
  'high-strength': { row: 2, col: 0, alt: 'Emma demonstrating a strength workout' },
  'high-cardio':   { row: 2, col: 1, alt: 'Emma demonstrating a cardio workout' },
  'high-full':     { row: 2, col: 2, alt: 'Emma demonstrating a full workout session' },
};

function WorkoutPoseThumb({ activityId, size = 40 }: { activityId: string; size?: number }) {
  const tile = POSE_TILES[activityId];
  if (!tile) return null;
  const bgX = (tile.col / (SHEET_COLS - 1)) * 100;
  const bgY = (tile.row / (SHEET_ROWS - 1)) * 100;
  return (
    <div
      role="img"
      aria-label={tile.alt}
      className="rounded-lg overflow-hidden shrink-0 border border-white/60"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${WORKOUT_DEMO_SHEET})`,
        backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
        backgroundPosition: `${bgX}% ${bgY}%`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
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
      <WorkoutPoseThumb activityId={activity.id} />
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

// ─── This week overview ───────────────────────────────────────────────────────

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function WeeklyOverview({
  events,
  today,
  onAddFirst,
}: {
  events: Event[];
  today: string;
  onAddFirst: () => void;
}) {
  const { count, next } = getWeeklyMovements(events, today);

  if (count === 0) {
    return (
      <div
        className="rounded-2xl border px-4 py-4 text-center"
        style={{ borderColor: 'var(--theme-primary-mid)', background: 'var(--theme-primary-light)' }}
      >
        <p className="text-sm font-semibold text-gray-700">No movement planned this week</p>
        <p className="text-xs text-gray-500 mt-1 mb-3">
          Even a short walk counts. Pick one to get started.
        </p>
        <button
          onClick={onAddFirst}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full text-white active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--theme-primary)', minHeight: 36 }}
        >
          <Plus size={13} />
          Add a workout
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 space-y-2.5">
      <div className="flex items-center gap-2">
        <Calendar size={14} style={{ color: 'var(--theme-primary)' }} />
        <p className="text-xs font-bold text-gray-600">This week</p>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--theme-primary-light)', color: 'var(--theme-primary)' }}
        >
          {count} {count === 1 ? 'session' : 'sessions'}
        </span>
      </div>
      {next ? (
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--theme-primary-light)' }}
          >
            <Clock size={14} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-700 truncate">{next.title}</p>
            <p className="text-xs text-gray-400">
              {formatDayLabel(next.date)}
              {next.time ? ` · ${next.time}` : ''}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">All sessions this week are past — nice work!</p>
      )}
    </div>
  );
}

// ─── Guided start ─────────────────────────────────────────────────────────────

function GuidedStart({
  selectedRange,
  onSelectRange,
  onAdd,
}: {
  selectedRange: TimeRange | null;
  onSelectRange: (range: TimeRange | null) => void;
  onAdd: (activity: MovementActivity) => void;
}) {
  const activities = selectedRange ? activitiesForTimeRange(selectedRange) : [];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={14} style={{ color: 'var(--theme-primary)' }} />
        <p className="text-xs font-bold text-gray-600">How much time do you have?</p>
        {selectedRange && (
          <button
            onClick={() => onSelectRange(null)}
            className="ml-auto text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition-colors"
            style={{ minHeight: 28, minWidth: 44 }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Time-range chips */}
      <div className="flex gap-2">
        {TIME_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRange(r.id)}
            className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border transition-all active:scale-95 ${
              selectedRange === r.id
                ? 'text-white'
                : 'bg-gray-50 border-gray-100 text-gray-500 hover:opacity-80'
            }`}
            style={
              selectedRange === r.id
                ? { backgroundColor: 'var(--theme-primary)', borderColor: 'var(--theme-primary)', minHeight: 36 }
                : { minHeight: 36 }
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filtered activities */}
      {selectedRange && (
        <div className="space-y-2 pt-1">
          {activities.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No activities in this range.</p>
          ) : (
            activities.map((activity) => {
              const color = MOVEMENT_OPTIONS[activity.energyLevel].color;
              return (
                <div
                  key={activity.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${color.bg} ${color.border}`}
                >
                  <WorkoutPoseThumb activityId={activity.id} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${color.text}`}>{activity.label}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={10} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{activity.duration}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onAdd(activity)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${color.bg} ${color.text} ${color.border} hover:opacity-80`}
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MovementPage({ events, onAddEvent, onUpdateEvent }: MovementPageProps) {
  const { todayMovements, streakResult } = useMovement(events);
  const [adding, setAdding] = useState<string | null>(null);
  const [guidedRange, setGuidedRange] = useState<TimeRange | null>(null);
  const activitiesRef = useRef<HTMLDivElement>(null);

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

        {/* This week overview */}
        <WeeklyOverview
          events={events}
          today={getToday()}
          onAddFirst={() => {
            activitiesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {/* Guided start */}
        <GuidedStart
          selectedRange={guidedRange}
          onSelectRange={setGuidedRange}
          onAdd={handleAdd}
        />

        {/* Energy level sections */}
        <div ref={activitiesRef} className="space-y-4">
        {levels.map((level) => (
          <EnergySection
            key={level}
            level={level}
            todayMovements={todayMovements}
            onAdd={handleAdd}
            onComplete={handleComplete}
          />
        ))}
        </div>

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
