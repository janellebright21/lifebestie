import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, LifeBestieMemory, MemoryCategory } from '../lib/supabase';

// Returns true if two strings are "close enough" to be considered duplicates.
// Uses a simple normalized-includes check: if either title contains the other
// (case/punctuation-insensitive), treat them as the same memory.
function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function useLifeBestieMemory() {
  const [memories, setMemories] = useState<LifeBestieMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    dbError('user_memories (select)', error);
    if (data) setMemories(data as LifeBestieMemory[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Add a new memory.
   *
   * Duplicate prevention rules:
   * - If a memory with the exact same category AND a similar title already exists,
   *   update it instead of creating a duplicate.
   * - "Similar" means one title contains the other (normalised, case-insensitive).
   *
   * This ensures corrections ("Prefers direct reminders" replacing
   * "Prefers gentle reminders") update in-place rather than creating conflicts.
   */
  async function addMemory(
    category: MemoryCategory,
    title: string,
    value: string,
    source = 'manual'
  ): Promise<LifeBestieMemory | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Check for an existing memory in the same category with a similar title.
    const existing = memories.find(
      (m) => m.category === category && isSimilarTitle(m.title, title)
    );

    if (existing) {
      // Update the existing memory so corrections don't create duplicates.
      await updateMemory(existing.id, { category, title, value });
      return memories.find((m) => m.id === existing.id) ?? null;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_memories')
      .insert({ user_id: user.id, category, title, value, source, created_at: now, updated_at: now })
      .select()
      .single();

    dbError('user_memories (insert)', error);
    if (data) {
      const row = data as LifeBestieMemory;
      setMemories((prev) => [row, ...prev]);
      return row;
    }
    return null;
  }

  async function updateMemory(
    id: string,
    patch: Partial<Pick<LifeBestieMemory, 'category' | 'title' | 'value'>>
  ): Promise<void> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_memories')
      .update({ ...patch, updated_at: now })
      .eq('id', id)
      .select()
      .single();

    dbError('user_memories (update)', error);
    if (data) {
      const updated = data as LifeBestieMemory;
      setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  }

  async function deleteMemory(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_memories')
      .delete()
      .eq('id', id);

    dbError('user_memories (delete)', error);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  function getByCategory(category: MemoryCategory): LifeBestieMemory[] {
    return memories.filter((m) => m.category === category);
  }

  /**
   * Returns the memories most relevant to the current conversation.
   * Scores each memory against a set of keywords and returns the top N.
   * Falls back to the most-recently-updated memories when no keyword matches.
   */
  function getRelevantMemories(conversationText: string, maxCount = 6): LifeBestieMemory[] {
    if (memories.length === 0) return [];

    const words = conversationText.toLowerCase().split(/\W+/).filter((w) => w.length > 3);

    const scored = memories.map((m) => {
      const haystack = `${m.category} ${m.title} ${m.value}`.toLowerCase();
      const hits = words.filter((w) => haystack.includes(w)).length;
      return { memory: m, score: hits };
    });

    // Sort by relevance score desc, then by updated_at desc for ties
    scored.sort((a, b) =>
      b.score - a.score ||
      new Date(b.memory.updated_at).getTime() - new Date(a.memory.updated_at).getTime()
    );

    return scored.slice(0, maxCount).map((s) => s.memory);
  }

  return {
    memories,
    loading,
    addMemory,
    updateMemory,
    deleteMemory,
    getByCategory,
    getRelevantMemories,
    reload: load,
  };
}
