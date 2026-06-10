import { useState } from 'react';
import { Brain, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  MEMORY_CATEGORIES,
  MEMORY_CATEGORY_META,
  MemoryCategory,
  LifeBestieMemory,
} from '../lib/supabase';

interface MemorySectionProps {
  memories: LifeBestieMemory[];
  loading: boolean;
  onAdd: (category: MemoryCategory, title: string, value: string) => Promise<LifeBestieMemory | null>;
  onUpdate: (id: string, patch: Partial<Pick<LifeBestieMemory, 'category' | 'title' | 'value'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────

interface MemoryFormProps {
  initial?: LifeBestieMemory;
  onSave: (category: MemoryCategory, title: string, value: string) => Promise<void>;
  onCancel: () => void;
}

function MemoryForm({ initial, onSave, onCancel }: MemoryFormProps) {
  const [category, setCategory] = useState<MemoryCategory>(initial?.category ?? 'Preference');
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [value, setValue]       = useState(initial?.value ?? '');
  const [saving, setSaving]     = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(category, title.trim(), value.trim());
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Category picker */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {MEMORY_CATEGORIES.map((cat) => {
            const meta = MEMORY_CATEGORY_META[cat];
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all active:scale-95"
                style={active
                  ? { backgroundColor: meta.bg, color: meta.color, borderColor: meta.color }
                  : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                <span>{meta.emoji}</span>
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">What LifeBestie should know</p>
        <input
          type="text"
          placeholder="e.g. Prefers morning workouts"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel(); }}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-gray-200 transition-colors placeholder-gray-400"
          autoFocus
          maxLength={120}
        />
      </div>

      {/* Value (optional detail) */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Detail <span className="font-normal normal-case">(optional)</span></p>
        <textarea
          placeholder="Any extra context…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          className="w-full text-sm bg-gray-50 rounded-xl px-3 py-2.5 outline-none border border-transparent focus:border-gray-200 transition-colors placeholder-gray-400 resize-none"
          maxLength={300}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 active:scale-95 transition-transform"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all theme-bg-primary"
        >
          {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Memory')}
        </button>
      </div>
    </div>
  );
}

// ─── Single memory card ───────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onEdit,
  onDelete,
}: {
  memory: LifeBestieMemory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = MEMORY_CATEGORY_META[memory.category];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Category badge */}
        <div
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-base mt-0.5"
          style={{ backgroundColor: meta.bg }}
        >
          {meta.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: meta.color }}
            >
              {memory.category}
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-800 leading-snug">{memory.title}</p>
          {memory.value && (
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{memory.value}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 bg-gray-50"
                aria-label="Cancel delete"
              >
                <X size={13} />
              </button>
              <button
                onClick={onDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white bg-red-400"
                aria-label="Confirm delete"
              >
                <Check size={13} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-50 active:scale-90 transition-transform"
                aria-label="Edit memory"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 bg-gray-50 active:scale-90 transition-transform"
                aria-label="Delete memory"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export default function MemorySection({
  memories, loading, onAdd, onUpdate, onDelete,
}: MemorySectionProps) {
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [expanded, setExpanded]       = useState(true);
  const [activeFilter, setActiveFilter] = useState<MemoryCategory | 'All'>('All');

  const filtered = activeFilter === 'All'
    ? memories
    : memories.filter((m) => m.category === activeFilter);

  const categoriesPresent = [...new Set(memories.map((m) => m.category))];

  async function handleAdd(category: MemoryCategory, title: string, value: string) {
    await onAdd(category, title, value);
    setShowForm(false);
  }

  async function handleUpdate(id: string, category: MemoryCategory, title: string, value: string) {
    await onUpdate(id, { category, title, value });
    setEditingId(null);
  }

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-3"
      >
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-gray-400" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            What LifeBestie Knows About Me
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {memories.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {memories.length}
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-3">
          {/* Add button */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-400 active:scale-[0.98] transition-all hover:border-gray-300"
            >
              <Plus size={15} />
              Add a memory
            </button>
          )}

          {/* Add form */}
          {showForm && (
            <MemoryForm
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Category filter pills */}
          {memories.length > 0 && !showForm && (
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setActiveFilter('All')}
                className="shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full border transition-all"
                style={activeFilter === 'All'
                  ? { backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)', borderColor: 'var(--theme-primary-mid)' }
                  : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                All ({memories.length})
              </button>
              {categoriesPresent.map((cat) => {
                const meta = MEMORY_CATEGORY_META[cat];
                const count = memories.filter((m) => m.category === cat).length;
                const active = activeFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveFilter(cat)}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all"
                    style={active
                      ? { backgroundColor: meta.bg, color: meta.color, borderColor: meta.color }
                      : { backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                    }
                  >
                    {meta.emoji} {cat} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Memory list */}
          {loading && memories.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Loading memories…</p>
          )}

          {!loading && memories.length === 0 && !showForm && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-6 text-center">
              <p className="text-2xl mb-2">🧠</p>
              <p className="text-sm font-semibold text-gray-600 mb-1">No memories yet</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Add things LifeBestie should know about you — your routines, preferences, goals, and more.
              </p>
            </div>
          )}

          {filtered.map((memory) =>
            editingId === memory.id ? (
              <MemoryForm
                key={memory.id}
                initial={memory}
                onSave={(cat, title, val) => handleUpdate(memory.id, cat, title, val)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={() => { setEditingId(memory.id); setShowForm(false); }}
                onDelete={() => onDelete(memory.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
