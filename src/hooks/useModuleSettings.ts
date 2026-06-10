import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError, ModuleId, DEFAULT_ENABLED_MODULES } from '../lib/supabase';

interface UserSettingsRow {
  user_id: string;
  disabled_modules: ModuleId[];
}

export function useModuleSettings() {
  const [disabledModules, setDisabledModules] = useState<Set<ModuleId>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoaded(true); return; }

    const { data } = await supabase
      .from('user_settings')
      .select('disabled_modules')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setDisabledModules(new Set((data as UserSettingsRow).disabled_modules ?? []));
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  function isEnabled(moduleId: ModuleId): boolean {
    if (!loaded) return DEFAULT_ENABLED_MODULES.has(moduleId);
    return !disabledModules.has(moduleId);
  }

  async function setEnabled(moduleId: ModuleId, enabled: boolean): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const next = new Set(disabledModules);
    if (enabled) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    setDisabledModules(next);

    const disabledArray = Array.from(next);

    // Upsert — create the row on first save
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, disabled_modules: disabledArray, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    dbError('user_settings (upsert)', error);
  }

  return { isEnabled, setEnabled, loaded };
}
