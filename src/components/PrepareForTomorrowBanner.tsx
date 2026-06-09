import { useState } from 'react';
import { X, RefreshCw, Moon, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  reminders: string[];
  loading: boolean;
  error?: boolean;
  onDismiss: (reminder: string) => void;
  onRefresh: () => void;
  /** If true, show a more compact single-line preview (for Planner) */
  compact?: boolean;
}

export default function PrepareForTomorrowBanner({
  reminders,
  loading,
  error = false,
  onDismiss,
  onRefresh,
  compact = false,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  if (!loading && !error && reminders.length === 0) return null;

  if (compact) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Moon size={13} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Prepare for Tomorrow</span>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-amber-300 hover:text-amber-500 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-amber-400">Checking tomorrow…</span>
          </div>
        )}

        {!loading && expanded && error && reminders.length === 0 && (
          <p className="text-xs text-amber-500">
            AI help is not available right now, but you can still use the manual tools.
          </p>
        )}

        {!loading && expanded && (
          <ul className="space-y-1.5 mt-0.5">
            {reminders.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span className="text-xs text-amber-700 leading-relaxed flex-1">{r}</span>
                <button
                  onClick={() => onDismiss(r)}
                  className="shrink-0 text-amber-300 hover:text-amber-500 transition-colors mt-0.5"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Full banner for Home page
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl px-4 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
            <Moon size={13} className="text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wide leading-none">
              Prepare for Tomorrow
            </p>
            <p className="text-xs text-amber-400 mt-0.5">LifeBestie checked your schedule</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-40"
          title="Refresh reminders"
        >
          <RefreshCw size={13} className={`text-amber-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 px-1">
          <div className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-amber-400">Checking your tomorrow schedule…</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && reminders.length === 0 && (
        <p className="text-xs text-amber-500 px-1">
          AI help is not available right now, but you can still use the manual tools.
        </p>
      )}

      {/* Reminder cards */}
      {!loading && reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div
              key={reminder}
              className="flex items-start gap-3 bg-white/70 rounded-xl px-3 py-2.5 border border-amber-100/60"
            >
              <p className="text-sm text-gray-700 leading-relaxed flex-1">{reminder}</p>
              <button
                onClick={() => onDismiss(reminder)}
                className="shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 transition-colors active:scale-95"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
