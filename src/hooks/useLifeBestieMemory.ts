import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, LifeBestieMemory, MemoryCategory } from '../lib/supabase';

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

  async function addMemory(
    category: MemoryCategory,
    title: string,
    value: string,
    source = 'manual'
  ): Promise<LifeBestieMemory | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

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

  return { memories, loading, addMemory, updateMemory, deleteMemory, getByCategory, reload: load };
}
