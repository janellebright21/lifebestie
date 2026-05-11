import { useState } from 'react';
import { X, Clock, Calendar } from 'lucide-react';
import { PatternCandidate } from '../hooks/useUserMemory';
import { Routine } from '../lib/supabase';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT: Record<string, string> = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'T', Friday: 'F', Saturday: 'S', Sunday: 'S',
};

const TIME_PRESETS: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: '08:00',
  afternoon: '13:00',
  evening: '18:00',
};

interface Props {
  candidate: PatternCandidate;
  onConfirm: (routine: Routine) => Promise<void>;
  onDismiss: () => void;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function RoutineConfirmSheet({ candidate, onConfirm, onDismiss }: Props) {
  const [name, setName] = useState(capitalize(candidate.taskTitle));
  const [time, setTime] = useState(TIME_PRESETS[candidate.timeOfDay]);
  const [selectedDays, setSelectedDays] = useState<string[]>(candidate.days.slice(0, 5));
  const [saving, setSaving] = useState(false);

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleConfirm() {
    if (!name.trim() || selectedDays.length === 0) return;
    setSaving(true);
    await onConfirm({
      name: name.trim().toLowerCase(),
      time,
      days: selectedDays,
      tasks: [candidate.taskTitle],
    });
    setSaving(false);
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && onDismiss()}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onDismiss} />

      {/* Sheet */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-1">
              Pattern noticed 💛
            </p>
            <h2 className="text-base font-bold text-gray-800 leading-snug">
              It looks like you do this often.<br />Want to make it a routine?
            </h2>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 rounded-xl hover:bg-gray-100 active:scale-95 transition-all -mt-1 -mr-1"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Routine name */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 block">Routine name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 font-medium outline-none border border-transparent focus:border-amber-300 transition-colors"
            />
          </div>

          {/* Time picker */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Clock size={11} />
              Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-none border border-transparent focus:border-amber-300 transition-colors"
            />
          </div>

          {/* Day picker */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
              <Calendar size={11} />
              Repeat on
            </label>
            <div className="flex gap-2">
              {ALL_DAYS.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    title={day}
                    className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-400 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {DAY_SHORT[day]}
                  </button>
                );
              })}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-xs text-red-400 mt-1.5">Select at least one day</p>
            )}
          </div>

          {/* Stats hint */}
          <div className="bg-amber-50 rounded-xl px-3 py-2.5">
            <p className="text-xs text-amber-700">
              You've done this on{' '}
              <span className="font-semibold">{candidate.count} different days</span>
              {candidate.days.length > 0 && (
                <>, often on {candidate.days.slice(0, 3).join(', ')}</>
              )}
              .
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onDismiss}
            className="flex-1 py-3 rounded-2xl text-sm font-medium text-gray-500 bg-gray-100 active:scale-95 transition-transform"
          >
            Skip for now
          </button>
          <button
            onClick={handleConfirm}
            disabled={!name.trim() || selectedDays.length === 0 || saving}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-amber-400 disabled:opacity-50 active:scale-95 transition-transform shadow-sm"
          >
            {saving ? 'Saving…' : 'Save routine'}
          </button>
        </div>
      </div>
    </div>
  );
}
