import { useEffect, useRef, useState } from 'react';
import { MessageCircle, CalendarDays, Plus, ShoppingCart } from 'lucide-react';
import { CHARACTERS } from '../lib/supabase';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import { resolveExpressionSrc } from '../lib/characterAssets';
import type { TabName } from './BottomNav';

// ─── constants ────────────────────────────────────────────────────────────────

// How many px of the character show from the right edge when idle
const PEEK_WIDTH  = 72;
// Full character image width (before clipping)
const CHAR_WIDTH  = 110;
// Character image height — shows head → upper torso
const CHAR_HEIGHT = 140;
// How far the nav bar is from the bottom
const NAV_HEIGHT  = 64; // px — matches safe-bottom nav

// Pages where the companion hides (has its own prominent bestie UI already)
const HIDDEN_ON: Set<TabName> = new Set(['bestie', 'settings', 'add']);

// ─── types ────────────────────────────────────────────────────────────────────

type MotionState = 'idle' | 'wave' | 'rise' | 'rest';

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  tab: TabName;
  accent: string;    // bg color
  textColor: string; // text + icon color
}

// ─── component ────────────────────────────────────────────────────────────────

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
  const [open, setOpen]           = useState(false);
  const [motion, setMotion]       = useState<MotionState>('idle');
  const prevTabRef                = useRef<TabName>(activeTab);
  const wrapperRef                = useRef<HTMLDivElement>(null);
  const char                      = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const src                       = resolveExpressionSrc(characterId, expression);

  // ── Tab-switch wave ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    setOpen(false);
    setMotion('wave');
  }, [activeTab]);

  // After wave finishes, return to idle
  function handleAnimEnd() {
    if (motion === 'wave') setMotion('idle');
    if (motion === 'rest') setMotion('idle');
  }

  // ── Tap ─────────────────────────────────────────────────────────────────────
  function handleTap() {
    if (!open) {
      setOpen(true);
      setMotion('rise');
    } else {
      setOpen(false);
      setMotion('rest');
    }
  }

  // Close panel when tapping outside
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMotion('rest');
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

  // ── Animation class ──────────────────────────────────────────────────────────
  const motionClass: string = {
    idle:  'floating-bestie-idle',
    wave:  'floating-bestie-wave',
    rise:  'floating-bestie-rise',
    rest:  'floating-bestie-rest',
  }[motion];

  // ── Quick actions ────────────────────────────────────────────────────────────
  const actions: QuickAction[] = [
    {
      icon:      <MessageCircle size={15} />,
      label:     'Chat with Bestie',
      tab:       'chat',
      accent:    '#f3f0ff',
      textColor: '#7c3aed',
    },
    {
      icon:      <CalendarDays size={15} />,
      label:     'Plan my day',
      tab:       'planner',
      accent:    '#eff6ff',
      textColor: '#2563eb',
    },
    {
      icon:      <Plus size={15} />,
      label:     'Add a task',
      tab:       'add',
      accent:    '#f0fdf4',
      textColor: '#16a34a',
    },
    {
      icon:      <ShoppingCart size={15} />,
      label:     'Grocery help',
      tab:       'grocery',
      accent:    '#fffbeb',
      textColor: '#d97706',
    },
  ];

  // ── Peek offset: character right edge is flush with screen right edge ─────────
  // translate-x makes her slide out so only PEEK_WIDTH px are visible
  const peekOffset = CHAR_WIDTH - PEEK_WIDTH; // how much to slide off-right

  return (
    <div
      ref={wrapperRef}
      style={{
        position:   'fixed',
        bottom:     `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        right:      0,
        zIndex:     40,
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        // Clip overflow so the character edge bleeds off-screen cleanly
        overflow:   'visible',
      }}
    >

      {/* ── Quick-action card ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="floating-panel-enter"
          style={{
            marginBottom:    8,
            marginRight:     PEEK_WIDTH - 4,
            display:         'flex',
            flexDirection:   'column',
            gap:             6,
            alignItems:      'flex-end',
          }}
        >
          {/* Speech bubble */}
          <div
            style={{
              background:   `${char.primaryColor}14`,
              border:       `1px solid ${char.primaryColor}33`,
              borderRadius:  '16px 16px 4px 16px',
              padding:       '8px 12px',
              maxWidth:      180,
              marginBottom:  4,
            }}
          >
            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.45, margin: 0 }}>
              Hey! What do you need?
            </p>
          </div>

          {/* Action buttons */}
          {actions.map((a) => (
            <button
              key={a.tab}
              onClick={() => { onTabChange(a.tab); setOpen(false); setMotion('rest'); }}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           8,
                padding:       '9px 14px',
                borderRadius:  14,
                background:    a.accent,
                color:         a.textColor,
                border:        `1px solid ${a.textColor}22`,
                fontSize:      13,
                fontWeight:    600,
                whiteSpace:    'nowrap',
                cursor:        'pointer',
                boxShadow:     '0 2px 8px rgba(0,0,0,0.07)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Character peek ─────────────────────────────────────────────────── */}
      <button
        aria-label={open ? 'Close bestie menu' : 'Open bestie menu'}
        onClick={handleTap}
        style={{
          position:   'relative',
          width:      CHAR_WIDTH,
          height:     CHAR_HEIGHT,
          // Slide the character so only PEEK_WIDTH shows from the right edge
          transform:  `translateX(${peekOffset}px)`,
          cursor:     'pointer',
          background: 'none',
          border:     'none',
          padding:    0,
          WebkitTapHighlightColor: 'transparent',
          // Clip right edge flush — characters bleed off the screen, not off a box
          clipPath: `inset(0 0 0 0)`,
        }}
      >
        {/* Animated image wrapper */}
        <div
          className={motionClass}
          onAnimationEnd={handleAnimEnd}
          style={{
            width:  '100%',
            height: '100%',
            transformOrigin: 'bottom center',
          }}
        >
          {/* Soft glow behind character so she pops off the page */}
          <div
            style={{
              position:     'absolute',
              inset:        0,
              borderRadius: '50% 50% 0 0',
              background:   `radial-gradient(ellipse at 40% 80%, ${char.primaryColor}22 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Character image — portrait crop showing head/shoulders/torso */}
          <img
            src={src}
            alt={char.name}
            draggable={false}
            style={{
              width:          '100%',
              height:         '100%',
              objectFit:      'cover',
              objectPosition: 'center 15%',
              display:        'block',
              // Subtle drop shadow so character reads against any background
              filter:         'drop-shadow(0 4px 12px rgba(0,0,0,0.18))',
              userSelect:     'none',
            }}
          />

          {/* Blink overlay — thin bar that briefly darkens the eye zone */}
          <div
            className="floating-bestie-blink"
            style={{
              position:       'absolute',
              top:            '18%',
              left:           '15%',
              right:          '15%',
              height:         '8%',
              background:     char.primaryColor,
              opacity:        0,
              borderRadius:   4,
              pointerEvents:  'none',
              mixBlendMode:   'multiply',
            }}
          />

          {/* Tap indicator ring — only shown when open */}
          {open && (
            <div
              style={{
                position:     'absolute',
                top:          4,
                left:         8,
                right:        8,
                bottom:       0,
                borderRadius: '50% 50% 0 0',
                border:       `2px solid ${char.primaryColor}55`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </button>
    </div>
  );
}
