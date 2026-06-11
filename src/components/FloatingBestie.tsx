import { useEffect, useRef, useState } from 'react';
import { MessageCircle, CalendarDays, Plus, ShoppingCart } from 'lucide-react';
import { CHARACTERS } from '../lib/supabase';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import { resolveExpressionSrc } from '../lib/characterAssets';
import type { TabName } from './BottomNav';

// ─── layout constants ─────────────────────────────────────────────────────────

const CHAR_WIDTH  = 112;  // full character render width
const CHAR_HEIGHT = 148;  // full character render height
const PEEK_OFFSET = 40;   // px hidden off the right edge when idle
const NAV_HEIGHT  = 64;   // matches safe-bottom nav bar

// Pages with their own prominent Bestie UI — hide the companion there
const HIDDEN_ON: Set<TabName> = new Set(['bestie', 'settings', 'add']);

// ─── movement state ───────────────────────────────────────────────────────────

/**
 * Six named movement states.
 * Each maps to a .pb-state-* CSS class that drives independent animations
 * on .pb-body, .pb-head, .pb-shoulder, and .pb-blink children.
 */
type MovementState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'celebrating'
  | 'calm'
  | 'peeking'
  | 'rise'     // transient: tap open
  | 'rest'     // transient: tap close
  | 'enter';   // transient: tab switch

/** Map AvatarExpression → idle movement state */
const EXPRESSION_MOVEMENT: Record<AvatarExpression, MovementState> = {
  happy:       'idle',
  encouraging: 'listening',
  thinking:    'thinking',
  proud:       'celebrating',
  calm:        'calm',
  tired:       'calm',
};

/** Map TabName → default idle movement when no expression override applies */
const TAB_MOVEMENT: Partial<Record<TabName, MovementState>> = {
  home:      'idle',
  planner:   'listening',
  grocery:   'thinking',
  movement:  'calm',
  chat:      'listening',
  routines:  'idle',
  goals:     'idle',
};

const SPARKLE_OFFSETS = [
  { '--sx': '-18px', '--sy': '-22px', delay: '0ms'   },
  { '--sx':  '20px', '--sy': '-18px', delay: '60ms'  },
  { '--sx': '-8px',  '--sy': '-30px', delay: '120ms' },
  { '--sx':  '24px', '--sy': '-8px',  delay: '90ms'  },
];

// ─── quick actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <MessageCircle size={15} />, label: 'Chat with Bestie', tab: 'chat'    as TabName, accent: '#f3f0ff', color: '#7c3aed' },
  { icon: <CalendarDays  size={15} />, label: 'Plan my day',       tab: 'planner' as TabName, accent: '#eff6ff', color: '#2563eb' },
  { icon: <Plus          size={15} />, label: 'Add a task',        tab: 'add'     as TabName, accent: '#f0fdf4', color: '#16a34a' },
  { icon: <ShoppingCart  size={15} />, label: 'Grocery help',      tab: 'grocery' as TabName, accent: '#fffbeb', color: '#d97706' },
] as const;

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
  const [open, setOpen]         = useState(false);
  const [motion, setMotion]     = useState<MovementState>('idle');
  const [showSparkles, setShowSparkles] = useState(false);
  const prevTabRef              = useRef<TabName>(activeTab);
  const wrapperRef              = useRef<HTMLDivElement>(null);

  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;
  const src  = resolveExpressionSrc(characterId, expression);

  // ── Derive the resting movement state from expression + tab ─────────────────
  function restingState(): MovementState {
    const fromExpr = EXPRESSION_MOVEMENT[expression];
    if (fromExpr && fromExpr !== 'idle') return fromExpr;
    return TAB_MOVEMENT[activeTab] ?? 'idle';
  }

  // ── Tab-switch: play enter animation, then settle ───────────────────────────
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    setOpen(false);
    setMotion('enter');
  }, [activeTab]);

  // ── Expression change: if celebrating, show sparkles ────────────────────────
  useEffect(() => {
    if (expression === 'proud') {
      setMotion('celebrating');
      setShowSparkles(true);
      const t = setTimeout(() => {
        setShowSparkles(false);
        setMotion(restingState());
      }, 1200);
      return () => clearTimeout(t);
    }
    if (motion !== 'enter' && motion !== 'rise' && motion !== 'rest') {
      setMotion(restingState());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, activeTab]);

  // ── After transient animation ends, settle to resting state ─────────────────
  function handleBodyAnimEnd() {
    if (motion === 'enter' || motion === 'rest') {
      setMotion(restingState());
    }
  }

  // ── Tap ──────────────────────────────────────────────────────────────────────
  function handleTap() {
    if (!open) {
      setOpen(true);
      setMotion('rise');
    } else {
      setOpen(false);
      setMotion('rest');
    }
  }

  // ── Close panel on outside tap ───────────────────────────────────────────────
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

  // ─── render ──────────────────────────────────────────────────────────────────

  // Head layer: same image but taller clip from top (top 55% of portrait)
  // showing just head + neck + hint of shoulders, free to bob independently
  const headClipHeight = Math.round(CHAR_HEIGHT * 0.54);

  return (
    <div
      ref={wrapperRef}
      style={{
        position:      'fixed',
        bottom:        `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
        right:         0,
        zIndex:        40,
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-end',
      }}
    >
      {/* ── Quick-action card ─────────────────────────────────────────────── */}
      {open && (
        <div
          className="floating-panel-enter"
          style={{
            marginBottom: 8,
            marginRight:  PEEK_OFFSET + 8,
            display:      'flex',
            flexDirection:'column',
            gap:          6,
            alignItems:   'flex-end',
          }}
        >
          {/* Speech bubble */}
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

          {/* Actions */}
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.tab}
              onClick={() => { onTabChange(a.tab); setOpen(false); setMotion('rest'); }}
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

      {/* ── Character ─────────────────────────────────────────────────────── */}
      <button
        aria-label={open ? 'Close bestie menu' : 'Open bestie menu'}
        onClick={handleTap}
        style={{
          position:  'relative',
          width:      CHAR_WIDTH,
          height:     CHAR_HEIGHT,
          // Slide right so only (CHAR_WIDTH - PEEK_OFFSET) is visible
          transform: `translateX(${PEEK_OFFSET}px)`,
          cursor:    'pointer',
          background:'none',
          border:    'none',
          padding:    0,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Root state class drives all descendant animations */}
        <div
          className={`pb-state-${motion}`}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        >
          {/* ── Body layer (full portrait) ───────────────────────────────── */}
          <div
            className="pb-body"
            style={{
              position:      'absolute',
              inset:          0,
              transformOrigin:'bottom center',
            }}
          >
            {/* Soft glow */}
            <div
              style={{
                position:   'absolute',
                inset:       0,
                background: `radial-gradient(ellipse at 45% 85%, ${char.primaryColor}1e 0%, transparent 68%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Shoulder strip — subtle independent shrug at bottom 30% */}
            <div
              className="pb-shoulder"
              style={{
                position:        'absolute',
                bottom:           0,
                left:             0,
                right:            0,
                height:          '35%',
                overflow:        'hidden',
                transformOrigin: 'bottom center',
              }}
            >
              <img
                src={src}
                alt=""
                aria-hidden
                draggable={false}
                style={{
                  width:          CHAR_WIDTH,
                  height:         CHAR_HEIGHT,
                  objectFit:      'cover',
                  objectPosition: 'center 15%',
                  marginTop:     `-${CHAR_HEIGHT * 0.65}px`,
                  display:       'block',
                  userSelect:    'none',
                }}
              />
            </div>

            {/* Full-body image */}
            <img
              src={src}
              alt={char.name}
              draggable={false}
              style={{
                position:       'absolute',
                inset:           0,
                width:          '100%',
                height:         '100%',
                objectFit:      'cover',
                objectPosition: 'center 15%',
                display:        'block',
                filter:         'drop-shadow(0 4px 14px rgba(0,0,0,0.18))',
                userSelect:     'none',
              }}
            />
          </div>

          {/* ── Head layer (top 54% of portrait, bobs independently) ────── */}
          <div
            className="pb-head"
            style={{
              position:        'absolute',
              top:              0,
              left:             0,
              right:            0,
              height:           headClipHeight,
              overflow:        'hidden',
              transformOrigin: 'bottom center',
              pointerEvents:   'none',
            }}
          >
            <img
              src={src}
              alt=""
              aria-hidden
              draggable={false}
              style={{
                width:          CHAR_WIDTH,
                height:         CHAR_HEIGHT,
                objectFit:      'cover',
                objectPosition: 'center 15%',
                display:        'block',
                userSelect:     'none',
              }}
            />

            {/* Blink overlay — sits at ~22% from top of head-clip region */}
            <div
              className="pb-blink"
              style={{
                position:       'absolute',
                top:            '22%',
                left:           '18%',
                right:          '18%',
                height:         '9%',
                background:     char.primaryColor,
                borderRadius:    3,
                transformOrigin:'center',
                mixBlendMode:   'multiply',
                pointerEvents:  'none',
              }}
            />
          </div>

          {/* ── Sparkles on celebrating ──────────────────────────────────── */}
          {showSparkles && SPARKLE_OFFSETS.map((s, i) => (
            <span
              key={i}
              className="pb-sparkle-dot"
              style={{
                top:             '20%',
                left:            '40%',
                '--sx':           s['--sx'],
                '--sy':           s['--sy'],
                animationDelay:   s.delay,
              } as React.CSSProperties}
            />
          ))}

          {/* Open indicator ring */}
          {open && (
            <div
              style={{
                position:      'absolute',
                top:            2,
                left:           4,
                right:          4,
                bottom:         0,
                borderRadius:  '50% 50% 0 0',
                border:        `2px solid ${char.primaryColor}44`,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </button>
    </div>
  );
}
