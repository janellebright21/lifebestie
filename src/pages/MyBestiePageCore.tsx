import { Heart, CheckCircle2, Sparkles, Pencil, X, Star, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  THEMES, BG_SKINS, AVATAR_THEMES, CHARACTERS,
  MODULE_DEFS,
  ThemeId, BgSkinId, AvatarThemeId, CharacterId, ModuleId,
  LifeBestieMemory, MemoryCategory,
} from '../lib/supabase';
import BestieAvatar from '../components/besties/BestieAvatar';
import LayeredBestieAvatar from '../components/besties/LayeredBestieAvatar';
import MemorySection from '../components/MemorySection';
import type { BestieRelationshipData } from '../hooks/useBestieRelationship';
import type { BestieNotes } from '../hooks/useBestiePersonalization';

interface MyBestiePageProps {
  preferredName: string;
  currentTheme: ThemeId;
  currentBgSkin: BgSkinId;
  currentAvatarTheme: AvatarThemeId;
  character?: CharacterId;
  onSetCharacter?: (id: CharacterId) => void;
  isEnabled: (id: ModuleId) => boolean;
  memories: LifeBestieMemory[];
  memoriesLoading: boolean;
  onAddMemory: (category: MemoryCategory, title: string, value: string) => Promise<LifeBestieMemory | null>;
  onUpdateMemory: (id: string, patch: Partial<Pick<LifeBestieMemory, 'category' | 'title' | 'value'>>) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  bestieNotes: BestieNotes;
  onSaveNotes: (patch: Partial<BestieNotes>) => Promise<void>;
  relationship: BestieRelationshipData;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </h2>
  );
}

const LEVEL_ICONS = ['', '🌱', '💛', '⭐', '💜', '✨'];

interface RelationshipCardProps {
  charName:    string;
  charColor:   string;
  relationship: BestieRelationshipData;
}

function RelationshipCard({ charName, charColor, relationship }: RelationshipCardProps) {
  const {
    score, level, levelLabel, levelMessage,
    progressToNext, pointsToNext, nextLevelLabel, loading,
  } = relationship;

  if (loading) return null;

  const barBg = `${charColor}22`;
  const barFill = charColor;

  return (
    <div
      className="rounded-3xl px-5 py-5 space-y-4"
      style={{
        background: `linear-gradient(135deg, ${charColor}12 0%, ${charColor}06 100%)`,
        border: `1px solid ${charColor}33`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{LEVEL_ICONS[level]}</span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: charColor }}>
              Relationship Level {level}
            </p>
            <p className="text-sm font-bold text-gray-800 leading-tight">{levelLabel}</p>
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: `${charColor}22`, color: charColor }}
        >
          <Star size={11} fill={charColor} />
          {score} pts
        </div>
      </div>

      <div className="space-y-1.5">
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 8, backgroundColor: barBg }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressToNext}%`, backgroundColor: barFill }}
          />
        </div>
        {nextLevelLabel ? (
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-400">{levelLabel}</p>
            <p className="text-[10px] font-semibold" style={{ color: charColor }}>
              <TrendingUp size={9} className="inline mr-0.5 -mt-px" />
              {pointsToNext} pts to {nextLevelLabel}
            </p>
          </div>
        ) : (
          <p className="text-[10px] font-bold text-center" style={{ color: charColor }}>
            Max level reached!
          </p>
        )}
      </div>

      <p className="text-xs leading-relaxed italic text-gray-600">
        "{charName} says: {levelMessage}"
      </p>
    </div>
  );
}

interface NoteFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onSave: (val: string) => void;
}

function NoteField({ label, placeholder, value, onSave }: NoteFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function handleOpen() { setDraft(value); setEditing(true); }
  function handleCancel() { setEditing(false); }
  function handleSave() { onSave(draft.trim()); setEditing(false); }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        {!editing && (
          <button
            onClick={handleOpen}
            className="flex items-center gap-1 text-[10px] font-semibold active:scale-95 transition-transform"
            style={{ color: 'var(--theme-primary)' }}
          >
            <Pencil size={9} />
            {value ? 'Edit' : 'Add'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            placeholder={placeholder}
            className="flex-1 text-xs px-3 py-2 rounded-xl border focus:outline-none"
            style={{ borderColor: 'var(--theme-primary-mid)' }}
          />
          <button
            onClick={handleSave}
            className="px-3 py-2 rounded-xl text-white text-xs font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--theme-primary)' }}
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="p-2 rounded-xl bg-gray-100 active:scale-95 transition-transform"
          >
            <X size={12} className="text-gray-500" />
          </button>
        </div>
      ) : (
        <p className={`text-xs leading-relaxed ${value ? 'text-gray-700' : 'text-gray-300 italic'}`}>
          {value || placeholder}
        </p>
      )}
    </div>
  );
}

export default function MyBestiePage({
  preferredName,
  currentTheme,
  currentBgSkin,
  currentAvatarTheme,
  character = 'emma',
  isEnabled,
  memories,
  memoriesLoading,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  bestieNotes,
  onSaveNotes,
  relationship,
}: MyBestiePageProps) {
  const theme   = THEMES.find((t) => t.id === currentTheme) ?? THEMES[0]!;
  const skin    = BG_SKINS.find((s) => s.id === currentBgSkin) ?? BG_SKINS[0]!;
  const avatar  = AVATAR_THEMES.find((a) => a.id === currentAvatarTheme) ?? AVATAR_THEMES[0]!;
  const charDef = CHARACTERS.find((c) => c.id === character) ?? CHARACTERS[0]!;

  const enabledMods = MODULE_DEFS.filter((m) => m.available && isEnabled(m.id));

  const memoryCounts = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.category] = (acc[m.category] ?? 0) + 1;
    return acc;
  }, {});

  const greetingMessage = preferredName
    ? `Hey ${preferredName}! Here's everything I know about you.`
    : "Here's your LifeBestie profile.";

  return (
    <div className="min-h-[100dvh] theme-app-bg pb-24">
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
            <p className="text-xs mt-0.5 font-medium" style={{ color: 'var(--theme-primary)' }}>
              {relationship.levelLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-8">
        <BestieAvatar
          characterId={character}
          expression="encouraging"
          size="md"
        />

        <RelationshipCard
          charName={charDef.name}
          charColor={charDef.primaryColor}
          relationship={relationship}
        />

        <div
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: `linear-gradient(135deg, var(--theme-primary-light) 0%, var(--theme-bg-color, #f9fafb) 100%)`,
            border: '1px solid var(--theme-primary-mid)',
            minHeight: '180px',
          }}
        >
          <div className="px-5 pt-6 pb-6 pr-40">
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--theme-primary)' }}>
              {charDef.role}
            </p>
            <h2 className="text-xl font-bold text-gray-800 leading-tight">
              {preferredName ? `Hey, ${preferredName}!` : charDef.name}
            </h2>
            <p className="text-xs italic mt-1 leading-relaxed" style={{ color: 'var(--theme-primary)' }}>
              "{charDef.catchphrase}"
            </p>
            <div
              className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: 'var(--theme-primary-mid)', color: 'var(--theme-primary)' }}
            >
              <Sparkles size={9} />
              {relationship.levelLabel}
            </div>
          </div>
          <div className="absolute bottom-0 right-4 pb-4">
            {character === 'emma' ? (
              <LayeredBestieAvatar
                characterId="emma"
                size={135}
                motion="idle"
                fallback={<BestieAvatar characterId={character} expression="proud" size="full" />}
              />
            ) : (
              <BestieAvatar characterId={character} expression="proud" size="full" />
            )}
          </div>
        </div>

        <div>
          <SectionHeading>Expressions</SectionHeading>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
            <p className="text-xs text-gray-400 mb-3">How your Bestie looks in different moments</p>
            <div className="grid grid-cols-5 gap-2">
              {(['happy', 'thinking', 'encouraging', 'proud', 'calm'] as const).map((expr) => (
                <div key={expr} className="flex flex-col items-center gap-1.5">
                  <BestieAvatar characterId={character} expression={expr} size="sm" />
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide text-center leading-tight">
                    {expr}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <SectionHeading>What your Bestie knows</SectionHeading>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-5">
            <p className="text-xs text-gray-400 leading-relaxed">
              These notes help your Bestie personalise greetings and suggestions. They stay private and only you can see them.
            </p>
            <NoteField
              label="Common planning struggle"
              placeholder="e.g. I forget to schedule breaks"
              value={bestieNotes.planning_struggle}
              onSave={(v) => onSaveNotes({ planning_struggle: v })}
            />
            <NoteField
              label="Meal planning preference"
              placeholder="e.g. Quick weeknight dinners, batch cooking on Sundays"
              value={bestieNotes.meal_preference}
              onSave={(v) => onSaveNotes({ meal_preference: v })}
            />
            <NoteField
              label="Wellness preference"
              placeholder="e.g. Morning walks, yoga, reading before bed"
              value={bestieNotes.wellness_preference}
              onSave={(v) => onSaveNotes({ wellness_preference: v })}
            />
            <NoteField
              label="How I like encouragement"
              placeholder="e.g. Gentle reminders, motivational pushes"
              value={bestieNotes.encouragement_style}
              onSave={(v) => onSaveNotes({ encouragement_style: v })}
            />
          </div>
        </div>

        <div>
          <SectionHeading>Your Style</SectionHeading>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Theme</p>
              <div className="flex gap-1">
                <div className="flex-1 h-5 rounded-lg" style={{ backgroundColor: theme.swatch[0] }} />
                <div className="flex-1 h-5 rounded-lg" style={{ backgroundColor: theme.swatch[1] }} />
              </div>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{theme.label}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Background</p>
              <div className="text-xl leading-none">{skin.emoji}</div>
              <p className="text-xs font-semibold text-gray-700 leading-tight">{skin.label}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-3 py-3 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avatar</p>
              <BestieAvatar characterId={character} expression="happy" size="sm" />
              <p className="text-xs font-semibold text-gray-700 leading-tight">{avatar.label}</p>
            </div>
          </div>
        </div>

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
