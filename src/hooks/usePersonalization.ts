import { useState, useEffect, useCallback } from 'react';
import {
  supabase, dbError,
  ThemeId, BgSkinId, AvatarThemeId,
  THEMES, BG_SKINS,
  DEFAULT_PERSONALIZATION,
} from '../lib/supabase';
export interface PersonalizationState {
  theme: ThemeId;
  bgSkin: BgSkinId;
  avatarTheme: AvatarThemeId;
  memoryEnabled: boolean;
}

// CSS custom properties on :root — picked up by any component using var(--theme-*)
// This is the ONLY DOM mutation; we no longer touch body classes.
function setCSSVars(theme: ReturnType<typeof THEMES.find>, skin: ReturnType<typeof BG_SKINS.find>) {
  if (!theme || !skin) return;
  const root = document.documentElement;
  root.style.setProperty('--theme-primary',       theme.primary);
  root.style.setProperty('--theme-primary-light',  theme.primaryLight);
  root.style.setProperty('--theme-primary-mid',    theme.primaryMid);
  root.style.setProperty('--theme-bg-color',       skin.solidColor);
  root.style.setProperty('--theme-bg-image',       skin.patternStyle || 'none');
}

function applyToDOM(state: PersonalizationState) {
  const theme = THEMES.find((t) => t.id === state.theme) ?? THEMES[0]!;
  const skin  = BG_SKINS.find((s) => s.id === state.bgSkin) ?? BG_SKINS[0]!;
  setCSSVars(theme, skin);
}

export function usePersonalization() {
  const [state, setState] = useState<PersonalizationState>(DEFAULT_PERSONALIZATION);
  const [loaded, setLoaded] = useState(false);

  // Apply defaults immediately on first render (before DB load) so there's no flash
  useEffect(() => { applyToDOM(DEFAULT_PERSONALIZATION); }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoaded(true); return; }

    const { data } = await supabase
      .from('user_settings')
      .select('theme, bg_skin, avatar_theme, memory_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const next: PersonalizationState = {
        theme:         (data.theme        as ThemeId)       ?? DEFAULT_PERSONALIZATION.theme,
        bgSkin:        (data.bg_skin      as BgSkinId)      ?? DEFAULT_PERSONALIZATION.bgSkin,
        avatarTheme:   (data.avatar_theme as AvatarThemeId) ?? DEFAULT_PERSONALIZATION.avatarTheme,
        memoryEnabled: data.memory_enabled ?? DEFAULT_PERSONALIZATION.memoryEnabled,
      };
      setState(next);
      applyToDOM(next);
    }
    setLoaded(true);
  }, []);

  // Load on mount and re-load whenever auth state changes (sign-in after page load)
  useEffect(() => {
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') load();
      if (event === 'SIGNED_OUT') {
        setState(DEFAULT_PERSONALIZATION);
        applyToDOM(DEFAULT_PERSONALIZATION);
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [load]);

  async function setTheme(theme: ThemeId): Promise<void> {
    const next = { ...state, theme };
    setState(next);
    applyToDOM(next);
    await persist({ theme });
  }

  async function setBgSkin(bgSkin: BgSkinId): Promise<void> {
    const next = { ...state, bgSkin };
    setState(next);
    applyToDOM(next);
    await persist({ bg_skin: bgSkin });
  }

  async function setAvatarTheme(avatarTheme: AvatarThemeId): Promise<void> {
    const next = { ...state, avatarTheme };
    setState(next);
    await persist({ avatar_theme: avatarTheme });
  }

  async function setMemoryEnabled(enabled: boolean): Promise<void> {
    const next = { ...state, memoryEnabled: enabled };
    setState(next);
    await persist({ memory_enabled: String(enabled) });
  }

  async function persist(patch: Record<string, string | boolean>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: user.id, ...patch, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    dbError('user_settings (personalization upsert)', error);
  }

  return { ...state, loaded, setTheme, setBgSkin, setAvatarTheme, setMemoryEnabled };
}
