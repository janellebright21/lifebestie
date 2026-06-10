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
}

function applyToDOM(state: PersonalizationState) {
  const theme = THEMES.find((t) => t.id === state.theme) ?? THEMES[0]!;
  const skin  = BG_SKINS.find((s) => s.id === state.bgSkin) ?? BG_SKINS[0]!;

  const root = document.documentElement;
  root.style.setProperty('--theme-primary',       theme.primary);
  root.style.setProperty('--theme-primary-light',  theme.primaryLight);
  root.style.setProperty('--theme-primary-mid',    theme.primaryMid);

  // Apply background skin to body
  const body = document.body;

  // Remove all previous skin bg classes
  body.classList.remove(
    'bg-gray-50', 'bg-[#fdf6f0]', 'bg-[#fafafa]', 'bg-white'
  );
  // Add current skin bg class (handles Tailwind arbitrary-value class names safely)
  if (skin.bgClass) {
    skin.bgClass.split(' ').forEach((cls) => body.classList.add(cls));
  }

  body.style.backgroundImage  = skin.patternStyle || '';
  body.style.backgroundRepeat = skin.patternStyle ? 'repeat' : '';
  body.style.backgroundSize   = skin.patternStyle ? 'auto' : '';
}

export function usePersonalization() {
  const [state, setState] = useState<PersonalizationState>(DEFAULT_PERSONALIZATION);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoaded(true); return; }

    const { data } = await supabase
      .from('user_settings')
      .select('theme, bg_skin, avatar_theme')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const next: PersonalizationState = {
        theme:       (data.theme       as ThemeId)      ?? DEFAULT_PERSONALIZATION.theme,
        bgSkin:      (data.bg_skin     as BgSkinId)     ?? DEFAULT_PERSONALIZATION.bgSkin,
        avatarTheme: (data.avatar_theme as AvatarThemeId) ?? DEFAULT_PERSONALIZATION.avatarTheme,
      };
      setState(next);
      applyToDOM(next);
    } else {
      applyToDOM(DEFAULT_PERSONALIZATION);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  async function persist(patch: Record<string, string>): Promise<void> {
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

  return { ...state, loaded, setTheme, setBgSkin, setAvatarTheme };
}
