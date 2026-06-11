import { useEffect, useRef, useState } from 'react';
import { MessageCircle, CalendarDays, Plus, ShoppingCart, X } from 'lucide-react';
import { CHARACTERS } from '../lib/supabase';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import { resolveExpressionSrc } from '../lib/characterAssets';
import type { TabName } from './BottomNav';

interface FloatingBestieProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  tab: TabName;
  color: string;
}

// Tabs where the floating button hides (those pages already have a prominent bestie header)
const HIDDEN_ON: Set<TabName> = new Set(['bestie', 'settings', 'add']);

export default function FloatingBestie({
  characterId,
  expression = 'happy',
  activeTab,
  onTabChange,
}: FloatingBestieProps) {
  const [open, setOpen] = useState(false);
  const [waving, setWaving] = useState(false);
  const prevTab = useRef<TabName>(activeTab);
  const panelRef = useRef<HTMLDivElement>(null);
  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const src = resolveExpressionSrc(characterId, expression);

  // Trigger wave animation on tab switch
  useEffect(() => {
    if (prevTab.current !== activeTab) {
      prevTab.current = activeTab;
      setOpen(false);
      setWaving(true);
    }
  }, [activeTab]);

  function handleWaveEnd() {
    setWaving(false);
  }

  // Close panel when tapping outside
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [open]);

  if (HIDDEN_ON.has(activeTab)) return null;

  const actions: QuickAction[] = [
    {
      icon: <MessageCircle size={16} />,
      label: 'Chat with Bestie',
      tab: 'chat',
      color: 'bg-violet-50 text-violet-600 border-violet-100',
    },
    {
      icon: <CalendarDays size={16} />,
      label: 'Plan my day',
      tab: 'planner',
      color: 'bg-sky-50 text-sky-600 border-sky-100',
    },
    {
      icon: <Plus size={16} />,
      label: 'Add a task',
      tab: 'add',
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    {
      icon: <ShoppingCart size={16} />,
      label: 'Grocery help',
      tab: 'grocery',
      color: 'bg-amber-50 text-amber-600 border-amber-100',
    },
  ];

  const motionClass = waving ? 'floating-bestie-wave' : 'floating-bestie-idle';

  return (
    // Anchor: fixed, above bottom nav (nav ~56px + safe area), right gutter
    <div
      ref={panelRef}
      className="fixed z-40 flex flex-col items-end gap-2"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', right: '16px' }}
    >
      {/* Quick-action panel */}
      {open && (
        <div className="floating-panel-enter flex flex-col gap-2 items-end">
          {/* Speech bubble greeting */}
          <div
            className="rounded-2xl rounded-br-sm px-3 py-2 shadow-md max-w-[180px] text-right mb-1"
            style={{
              backgroundColor: `${char.primaryColor}14`,
              border: `1px solid ${char.primaryColor}33`,
            }}
          >
            <p className="text-xs font-medium text-gray-700 leading-snug">
              Hey! What do you need?
            </p>
          </div>

          {/* Action buttons */}
          {actions.map((action) => (
            <button
              key={action.tab}
              onClick={() => { onTabChange(action.tab); setOpen(false); }}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-sm font-semibold shadow-sm active:scale-95 transition-transform whitespace-nowrap ${action.color}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        className="relative active:scale-95 transition-transform focus:outline-none"
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {/* Close icon overlay */}
        {open && (
          <div
            className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
            style={{ backgroundColor: char.primaryColor }}
          >
            <X size={10} className="text-white" strokeWidth={3} />
          </div>
        )}

        {/* Avatar */}
        <div
          className={motionClass}
          onAnimationEnd={waving ? handleWaveEnd : undefined}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: open
              ? `0 0 0 3px ${char.primaryColor}, 0 8px 24px ${char.primaryColor}44`
              : `0 0 0 2.5px ${char.primaryColor}88, 0 6px 18px ${char.primaryColor}33`,
            transition: 'box-shadow 0.2s ease',
          }}
        >
          <img
            src={src}
            alt={char.name}
            draggable={false}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 30%',
              display: 'block',
            }}
          />
        </div>
      </button>
    </div>
  );
}
