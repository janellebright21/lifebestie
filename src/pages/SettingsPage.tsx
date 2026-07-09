import { Settings, CheckCircle2, Circle, Lock, LogOut, Palette, Brain } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  MODULE_DEFS, ModuleId,
  THEMES, BG_SKINS, AVATAR_THEMES,
  ThemeId, BgSkinId, AvatarThemeId,
} from '../lib/supabase';
import LifeBestieAvatar from '../components/LifeBestieAvatar';

interface SettingsPageProps {
  isEnabled: (id: ModuleId) => boolean;
  onSetEnabled: (id: ModuleId, enabled: boolean) => Promise<void>;
  currentTheme: ThemeId;
  currentBgSkin: BgSkinId;
  currentAvatarTheme: AvatarThemeId;
  onSetTheme: (id: ThemeId) => Promise<void>;
  onSetBgSkin: (id: BgSkinId) => Promise<void>;
  onSetAvatarTheme: (id: AvatarThemeId) => Promise<void>;
  memoryEnabled: boolean;
  onSetMemoryEnabled: (enabled: boolean) => Promise<void>;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

// ─── Personalization section ──────────────────────────────────────────────────

function PersonalizationSection({
  currentTheme, currentBgSkin, currentAvatarTheme,
  onSetTheme, onSetBgSkin, onSetAvatarTheme,
}: {
  currentTheme: ThemeId;
  currentBgSkin: BgSkinId;
  currentAvatarTheme: AvatarThemeId;
  onSetTheme: (id: ThemeId) => Promise<void>;
  onSetBgSkin: (id: BgSkinId) => Promise<void>;
  onSetAvatarTheme: (id: AvatarThemeId) => Promise<void>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Palette size={14} className="text-gray-400" />
        <SectionHeading>Personalization</SectionHeading>
      </div>

      {/* Theme */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-2">Color Theme</p>
        <div className="grid grid-cols-1 gap-2">
          {THEMES.map((t) => {
            const active = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSetTheme(t.id)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left active:scale-[0.98] transition-all ${
                  active
                    ? 'border-2 bg-white shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
                style={active ? { borderColor: t.primary } : {}}
              >
                <div className="w-8 h-8 rounded-xl shrink-0 overflow-hidden flex">
                  <div className="flex-1" style={{ backgroundColor: t.swatch[0] }} />
                  <div className="flex-1" style={{ backgroundColor: t.swatch[1] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${active ? 'text-gray-800' : 'text-gray-600'}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-gray-400 leading-snug">{t.description}</p>
                </div>
                {active && (
                  <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: t.primary }}>
                    <CheckCircle2 size={14} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Background skin */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-2">Background Style</p>
        <div className="grid grid-cols-2 gap-2">
          {BG_SKINS.map((skin) => {
            const active = currentBgSkin === skin.id;
            return (
              <button
                key={skin.id}
                onClick={() => onSetBgSkin(skin.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 active:scale-[0.98] transition-all ${
                  active
                    ? 'border-2 bg-white shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
                style={active ? { borderColor: 'var(--theme-primary)' } : {}}
              >
                <span className="text-xl leading-none">{skin.emoji}</span>
                <p className={`text-xs font-semibold leading-none ${active ? 'text-gray-800' : 'text-gray-500'}`}>
                  {skin.label}
                </p>
                <p className="text-[10px] text-gray-400 text-center leading-tight">{skin.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Avatar theme */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2">LifeBestie Avatar</p>
        <div className="grid grid-cols-2 gap-2">
          {AVATAR_THEMES.map((av) => {
            const active = currentAvatarTheme === av.id;
            return (
              <button
                key={av.id}
                onClick={() => onSetAvatarTheme(av.id)}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-3 active:scale-[0.98] transition-all ${
                  active
                    ? 'border-2 bg-white shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
                style={active ? { borderColor: 'var(--theme-primary)' } : {}}
              >
                <LifeBestieAvatar size="sm" avatarTheme={av.id} />
                <p className={`text-xs font-semibold ${active ? 'text-gray-800' : 'text-gray-500'}`}>
                  {av.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Memory section ───────────────────────────────────────────────────────────

function MemoryPrivacySection({
  memoryEnabled,
  onSetMemoryEnabled,
}: {
  memoryEnabled: boolean;
  onSetMemoryEnabled: (enabled: boolean) => Promise<void>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Brain size={14} className="text-gray-400" />
        <SectionHeading>Emma's Memory</SectionHeading>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          When memory is on, Emma can remember things you share and use them to personalise her responses.
          You stay in control — she only saves what you explicitly confirm.
        </p>
        <button
          onClick={() => onSetMemoryEnabled(!memoryEnabled)}
          className="w-full flex items-center gap-3 py-3 rounded-2xl border px-4 text-left active:scale-[0.98] transition-all"
          style={memoryEnabled
            ? { borderColor: 'var(--theme-primary)', backgroundColor: 'var(--theme-primary-light)' }
            : { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }
          }
        >
          <div className={`shrink-0 transition-colors ${memoryEnabled ? 'theme-text-primary' : 'text-gray-300'}`}>
            {memoryEnabled ? <CheckCircle2 size={20} /> : <Circle size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${memoryEnabled ? 'text-gray-800' : 'text-gray-400'}`}>
              Emma's memory is {memoryEnabled ? 'on' : 'off'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              {memoryEnabled
                ? 'Emma will suggest remembering personal info from chat.'
                : 'Emma will not suggest or save new memories. Existing memories are kept.'}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            memoryEnabled ? 'theme-bg-light theme-text-primary' : 'bg-gray-100 text-gray-400'
          }`}>
            {memoryEnabled ? 'ON' : 'OFF'}
          </span>
        </button>
        {!memoryEnabled && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Your existing memories are safe. Turn memory back on to allow new ones.
            To view, edit or delete your memories, visit the My Bestie page.
          </p>
        )}
        {memoryEnabled && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            To view, edit or delete your memories, visit the My Bestie page.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage({
  isEnabled, onSetEnabled,
  currentTheme, currentBgSkin, currentAvatarTheme,
  onSetTheme, onSetBgSkin, onSetAvatarTheme,
  memoryEnabled, onSetMemoryEnabled,
}: SettingsPageProps) {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const available  = MODULE_DEFS.filter((m) => m.available);
  const comingSoon = MODULE_DEFS.filter((m) => !m.available);

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-gray-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-none">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Customize your experience</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-8">

        {/* Personalization */}
        <PersonalizationSection
          currentTheme={currentTheme}
          currentBgSkin={currentBgSkin}
          currentAvatarTheme={currentAvatarTheme}
          onSetTheme={onSetTheme}
          onSetBgSkin={onSetBgSkin}
          onSetAvatarTheme={onSetAvatarTheme}
        />

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Memory privacy toggle */}
        <MemoryPrivacySection
          memoryEnabled={memoryEnabled}
          onSetMemoryEnabled={onSetMemoryEnabled}
        />

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Modules section */}
        <div>
          <SectionHeading>Modules</SectionHeading>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Only enabled modules appear in navigation and dashboards.
          </p>
          <div className="space-y-2">
            {available.map((mod) => {
              const enabled = isEnabled(mod.id);
              return (
                <button
                  key={mod.id}
                  onClick={() => onSetEnabled(mod.id, !enabled)}
                  className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform shadow-sm"
                >
                  <div className={`shrink-0 transition-colors ${enabled ? 'theme-text-primary' : 'text-gray-300'}`}>
                    {enabled ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {mod.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    enabled ? 'theme-bg-light theme-text-primary' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming soon */}
        <div>
          <SectionHeading>Coming Soon</SectionHeading>
          <div className="space-y-2">
            {comingSoon.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 opacity-60"
              >
                <Lock size={18} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500">{mod.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 active:scale-[0.98] transition-transform shadow-sm"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
