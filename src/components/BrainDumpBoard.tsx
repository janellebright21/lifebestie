import { useState, useEffect } from 'react';

const LANES = ['On my mind', 'Do next', 'Not today', 'Just feelings'] as const;
const COLORS = { Lavender: '#ede9fe', Sage: '#dcfce7', Peach: '#ffedd5', Blue: '#dbeafe' };
type Note = { id: string; text: string; lane: typeof LANES[number]; color: keyof typeof COLORS; emoji: string };

function readNotes(key: string): Note[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter((n): n is Note => n && typeof n.id === 'string' && typeof n.text === 'string' && n.text.length <= 1000 && LANES.includes(n.lane) && Object.prototype.hasOwnProperty.call(COLORS, n.color) && typeof n.emoji === 'string').slice(0, 100) : [];
  } catch { return []; }
}

export default function BrainDumpBoard({ userId, onOrganize }: { userId: string; onOrganize: (text: string) => void }) {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const morning = hour < 12;
  const storageKey = `lifebestie_brain_board_v1:${userId}`;
  const [notes, setNotes] = useState<Note[]>(() => readNotes(storageKey));
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('Put it all here. We can make sense of it together.');
  const [saveError, setSaveError] = useState(false);
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<Note['color']>('Lavender');
  const [emoji, setEmoji] = useState('💭');
  const active = notes.find(n => n.id === selected);
  const commit = (next: Note[]) => {
    setNotes(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaveError(false); }
    catch { setSaveError(true); }
  };
  const move = (id: string, lane: Note['lane']) => {
    commit(notes.map(n => n.id === id ? { ...n, lane } : n));
    setSelected(id);
    setMessage(lane === 'Not today' ? "Parked. You don't have to carry everything today." : lane === 'Just feelings' ? "This can just be a feeling. We don't have to turn it into a chore." : 'There we go. One thought in its own little spot.');
  };
  return <div className="space-y-4">
    <div className="flex items-end gap-3 rounded-2xl bg-violet-50 p-3">
      <img src={`/characters/board/emma-seated-${morning ? 'morning' : 'afternoon'}.png`} alt={`Emma sitting cross-legged with a notepad, pencil, and ${morning ? 'coffee' : 'iced drink'}`} className="w-36 sm:w-48 shrink-0 h-auto object-contain" />
      <p className="text-sm text-gray-700" aria-live="polite">{message}</p>
    </div>
    <p className="text-xs text-gray-500">Your notes stay on this device for this account. Move them by dragging, or use each note's Move to menu.</p>
    {saveError && <p role="alert" className="text-sm text-rose-600">Your board couldn't be saved on this device. Keep this window open so you can copy your notes.</p>}
    <form onSubmit={e => { e.preventDefault(); if (!draft.trim() || notes.length >= 100) return; const note: Note = { id: crypto.randomUUID(), text: draft.trim(), color, emoji, lane: 'On my mind' }; commit([...notes, note]); setDraft(''); setSelected(note.id); setMessage("Okay, that's one less thing you have to keep in your head."); }} className="space-y-2">
      <label className="block text-sm font-semibold" htmlFor="board-thought">Add a thought</label>
      <textarea id="board-thought" value={draft} onChange={e => setDraft(e.target.value)} maxLength={1000} rows={2} placeholder="A worry, an idea, something to remember…" className="w-full rounded-xl border p-3 text-sm" />
      <div className="flex flex-wrap gap-2">
        <select aria-label="New note color" value={color} onChange={e => setColor(e.target.value as Note['color'])} className="rounded-xl border p-3 text-sm">{Object.keys(COLORS).map(c => <option key={c}>{c}</option>)}</select>
        <select aria-label="New note emoji" value={emoji} onChange={e => setEmoji(e.target.value)} className="rounded-xl border p-3">{['💭', '📌', '💜', '🌙', '🛒', '✨'].map(v => <option key={v}>{v}</option>)}</select>
        <button disabled={!draft.trim() || notes.length >= 100} className="rounded-xl bg-violet-600 px-4 py-3 text-sm text-white disabled:opacity-40">Add sticky note</button>
      </div>
      {notes.length >= 100 && <p className="text-sm">Your board has 100 notes. Remove a finished note to make room.</p>}
    </form>
    {active && <div className="rounded-xl border border-violet-200 p-3 space-y-2">
      <p className="text-sm">Emma is looking at: <strong>{active.text.slice(0, 80)}</strong></p>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl border px-3 py-3 text-sm" onClick={() => setMessage('Is this something to do, something to park for later, or a feeling you want to let out? You choose its spot below.')}>Help me untangle this</button>
        <button className="rounded-xl border px-3 py-3 text-sm" onClick={() => move(active.id, 'Not today')}>Park it for later</button>
        <button className="rounded-xl border px-3 py-3 text-sm" onClick={() => onOrganize(active.text)}>Make suggestions for this note</button>
      </div>
    </div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl p-3" style={{ background: '#f5f3ff', backgroundImage: 'radial-gradient(#ddd6fe 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
      {LANES.map(lane => <section key={lane} aria-label={lane} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (notes.some(n => n.id === id)) move(id, lane); }} className="min-h-36 rounded-xl bg-white/60 p-3">
        <h3 className="text-sm font-semibold mb-3">{lane} <span className="text-gray-400">({notes.filter(n => n.lane === lane).length})</span></h3>
        <div className="space-y-3">{notes.filter(n => n.lane === lane).map(n => <article key={n.id} draggable onDragStart={e => e.dataTransfer.setData('text/plain', n.id)} className={`rounded-sm p-3 shadow-md border-2 ${selected === n.id ? 'border-violet-500' : 'border-transparent'}`} style={{ backgroundColor: COLORS[n.color] }}>
          <button className="w-full text-left py-2 text-sm font-semibold" aria-label={`Discuss note: ${n.text.slice(0, 60)}`} onClick={() => { setSelected(n.id); setMessage(n.lane === 'Just feelings' ? "I'm here. This thought doesn't need to become a task." : 'Want to untangle this together, or give it a place for later?'); }}>{n.emoji} Talk with Emma</button>
          <textarea aria-label="Edit sticky note" value={n.text} maxLength={1000} rows={3} className="w-full bg-transparent text-sm resize-y" onFocus={() => setSelected(n.id)} onChange={e => commit(notes.map(item => item.id === n.id ? { ...item, text: e.target.value } : item))} />
          <label className="block text-xs">Move to <select value={n.lane} onChange={e => move(n.id, e.target.value as Note['lane'])} className="w-full rounded-lg bg-white/60 p-2 mt-1">{LANES.map(v => <option key={v}>{v}</option>)}</select></label>
          <button className="text-xs underline min-h-11" onClick={() => { commit(notes.filter(item => item.id !== n.id)); if (selected === n.id) setSelected(null); setMessage('A little more room to breathe.'); }}>Remove note</button>
        </article>)}</div>
      </section>)}
    </div>
    {!notes.length && <p className="text-center text-sm text-gray-500">Your board is ready. Start with one thought.</p>}
  </div>;
}
