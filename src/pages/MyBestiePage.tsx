import { Heart, CheckCircle2, Sparkles } from 'lucide-react';
import {
  THEMES, BG_SKINS, AVATAR_THEMES,
  MODULE_DEFS,
  ThemeId, BgSkinId, AvatarThemeId, ModuleId,
  LifeBestieMemory, MemoryCategory,
} from '../lib/supabase';
import LifeBestieAvatar from '../components/LifeBestieAvatar';
import MemorySection from '../components/MemorySection';

interface MyBestiePageProps {
  preferredName: string;
  currentTheme: ThemeId;
  currentBgSkin: BgSkinId;
  currentAvatarTheme: AvatarThemeId;
  isEnabled: (id: ModuleId) => boolean;
  memories: LifeBestieMemory[];
  memoriesLoading: boolean;
  onAddMemory: (category: MemoryCategory, title: string, value: string) => Promise<LifeBestieMemory | null>;
  onUpdateMemory: (id: string, patch: Partial<Pick<LifeBestieMemory, 'category' | 'title' | 'value'>>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

export default function MyBestiePage({
  preferredName,
  currentTheme,
  currentBgSkin,
  currentAvatarTheme,
  isEnabled,
  memories,
  memoriesLoading,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
}: MyBestiePageProps) {
  const theme  = THEMES.find((t) => t.id === currentTheme) ?? THEMES[0]!;
  const skin   = BG_SKINS.find((s) => s.id === currentBgSkin) ?? BG_SKINS[0]!;
  const avatar = AVATAR_THEMES.find((a) => a.id === currentAvatarTheme) ?? AVATAR_THEMES[0]!;

  const enabledMods = MODULE_DEFS.filter((m) => m.available && isEnabled(m.id));

  // Group memories by category for the summary strip
  const memoryCounts = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--theme-primary-light)' }}
          >
            <Heart size={18} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-none">My Bestie</h1>
            <p className="text-xs text-gray-400 mt-0.5">Your LifeBestie profile</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-8">

        {/* ─── Greeting bubble ────────────────────────────────────────────── */}
        <LifeBestieAvatar
          size="sm"
          avatarTheme={currentAvatarTheme}
          expression="encouraging"
          bubble={
            preferredName
              ? `Hey ${preferredName}! Here's everything I know about you 💛`
              : "Here's your LifeBestie profile 💛"
          }
        />

        {/* ─── Hero card ──────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl px-5 py-6 flex items-center gap-5"
          style={{
            background: `linear-gradient(135deg, var(--theme-primary-light) 0%, var(--theme-bg-color, #f9fafb) 100%)`,
            border: '1px solid var(--theme-primary-mid)',
          }}
        >
          <LifeBestieAvatar size="lg" avatarTheme={currentAvatarTheme} expression="proud" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--theme-primary)' }}>
              LifeBestie
            </p>
            <h2 className="text-xl font-bold text-gray-800 leading-tight">
              {preferredName ? `Hey, ${preferredName}!` : 'Your Bestie'}
            </h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {memories.length > 0
                ? `I know ${memories.length} thing${memories.length === 1 ? '' : 's'} about you.`
                : "I'm still getting to know you. Add some memories!"}
            </p>
          </div>
        </div>

        {/* ─── Style snapshot ─────────────────────────────────────────────── */}
        <div>
          <SectionHeading>Your Style</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            {/* Theme */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Theme</p>
              <div className="flex gap-1">
                <div className="flex-1 h-5 rounded-lg" style={{ backgroundColor: theme.swatch[0] }} />
                <div className="flex-1 h-5 rounded-lg" style={{ backgroundColor: theme.swatch[1] }} />
              </div>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{theme.label}</p>
            </div>

            {/* Background */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Background</p>
              <div className="text-xl leading-none">{skin.emoji}</div>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{skin.label}</p>
            </div>

            {/* Avatar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avatar</p>
              <LifeBestieAvatar size="sm" avatarTheme={currentAvatarTheme} expression="happy" />
              <p className="text-xs font-semibold text-gray-700 leading-tight">{avatar.label}</p>
            </div>
          </div>
        </div>

        {/* ─── Enabled modules ────────────────────────────────────────────── */}
        <div>
          <SectionHeading>Active Modules</SectionHeading>
          {enabledMods.length === 0 ? (
            <p className="text-xs text-gray-400">No modules enabled.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledMods.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--theme-primary-light)', color: 'var(--theme-primary)', border: '1px solid var(--theme-primary-mid)' }}
                >
                  <CheckCircle2 size={11} />
                  {mod.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Memory summary strip ───────────────────────────────────────── */}
        {memories.length > 0 && (
          <div>
            <SectionHeading>Memory Snapshot</SectionHeading>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} style={{ color: 'var(--theme-primary)' }} />
                <p className="text-xs font-semibold text-gray-600">
                  {memories.length} {memories.length === 1 ? 'memory' : 'memories'} across {Object.keys(memoryCounts).length} {Object.keys(memoryCounts).length === 1 ? 'category' : 'categories'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(memoryCounts).map(([cat, count]) => (
                  <span
                    key={cat}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-100"
                  >
                    {cat} · {count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Memory section (full add/edit/delete) ──────────────────────── */}
        <MemorySection
          memories={memories}
          loading={memoriesLoading}
          onAdd={onAddMemory}
          onUpdate={onUpdateMemory}
          onDelete={onDeleteMemory}
        />
      </div>
    </div>
  );
}
