import { useState, useEffect, useRef } from 'react';
import { MessageCircle, CalendarDays, Plus, ShoppingCart } from 'lucide-react';
import { CHARACTERS } from '../lib/supabase';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import BestieAvatar from './besties/BestieAvatar';
import type { TabName } from './BottomNav';

// Keep the floating avatar well above the nav + plus button (which extends ~20px above nav top)
const NAV_CLEARANCE = 88;

const HIDDEN_ON: Set<TabName> = new Set(['bestie', 'settings', 'add', 'chat']);

const QUICK_ACTIONS = [
  { icon: <MessageCircle size={15} />, label: 'Chat with Bestie', tab: 'chat'    as TabName, accent: '#f3f0ff', color: '#7c3aed' },
  { icon: <CalendarDays  size={15} />, label: 'Plan my day',       tab: 'planner' as TabName, accent: '#eff6ff', color: '#2563eb' },
  { icon: <Plus          size={15} />, label: 'Add a task',        tab: 'add'     as TabName, accent: '#f0fdf4', color: '#16a34a' },
  { icon: <ShoppingCart  size={15} />, label: 'Grocery help',      tab: 'grocery' as TabName, accent: '#fffbeb', color: '#d97706' },
] as const;

interface FloatingBestieProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export default function FloatingBestie({
  characterId,
  expression = 'happy',
  activeTab,
  onTabChange,
}: FloatingBestieProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef      = useRef<HTMLDivElement>(null);

  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;

  useEffect(() => {
    setOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [open]);

  if (HIDDEN_ON.has(activeTab)) return null;

  return (
    <div
      ref={wrapperRef}
      style={{
        position:      'fixed',
        bottom:        `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom, 0px))`,
        right:         12,
        zIndex:        40,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-end',
      }}
    >
      {/* Quick-action panel */}
      {open && (
        <div
          style={{
            marginBottom: 8,
            marginRight:  80,
            display:      'flex',
            flexDirection:'column',
            gap:          6,
            alignItems:   'flex-end',
          }}
        >
          <div
            style={{
              background:   `${char.primaryColor}14`,
              border:       `1px solid ${char.primaryColor}33`,
              borderRadius: '14px 14px 4px 14px',
              padding:      '8px 12px',
              maxWidth:     176,
              marginBottom: 4,
            }}
          >
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, margin: 0 }}>
              Hey! What do you need?
            </p>
          </div>

          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.tab}
              onClick={() => { onTabChange(a.tab); setOpen(false); }}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:          8,
                padding:     '9px 14px',
                borderRadius: 14,
                background:   a.accent,
                color:        a.color,
                border:      `1px solid ${a.color}22`,
                fontSize:     13,
                fontWeight:   600,
                whiteSpace:  'nowrap',
                cursor:      'pointer',
                boxShadow:   '0 2px 8px rgba(0,0,0,0.07)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Character button */}
      <button
        aria-label={open ? 'Close bestie menu' : 'Open bestie menu'}
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor:      'pointer',
          background:  'none',
          border:      'none',
          padding:      0,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <BestieAvatar
          characterId={characterId}
          expression={expression}
          size="lg"
          enable3D
        />
      </button>
    </div>
  );
}
