import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveExpressionSrc, getDefaultSrc } from '../lib/characterAssets';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TabName } from './BottomNav';
import { NAV_HEIGHT } from './BottomNav';

const EDGE_SPACING = 12;
const AVATAR_SIZE = 64;
const BUBBLE_MS = 2000;

// Tabs where the floating Emma should NOT appear:
// - home/bestie/settings: duplicates the main character on those pages
// - chat: duplicates the chat character
// - add: it's a sheet, not a page
// - planner: user previously requested removal
const HIDDEN_ON: Set<TabName> = new Set(['home', 'bestie', 'settings', 'chat', 'add', 'planner']);

const SIDE_KEY = 'lifebestie_floating_side';
const VISIBLE_KEY = 'lifebestie_floating_visible';

function loadSide(): 'left' | 'right' {
  try {
    const s = localStorage.getItem(SIDE_KEY);
    if (s === 'left' || s === 'right') return s;
  } catch { /* ignore */ }
  return 'right';
}

function loadVisible(): boolean {
  try {
    return localStorage.getItem(VISIBLE_KEY) !== 'false';
  } catch { /* ignore */ }
  return true;
}

interface FloatingBestieProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  activeTab: TabName;
  /** Hide when any dialog/sheet/quick-add is open */
  dialogOpen?: boolean;
}

export default function FloatingBestie({
  characterId,
  expression = 'happy',
  activeTab,
  dialogOpen = false,
}: FloatingBestieProps) {
  const [side, setSide] = useState<'left' | 'right'>(loadSide);
  const [visible, setVisible] = useState<boolean>(loadVisible);
  const [bubble, setBubble] = useState(false);
  const [imgSrc, setImgSrc] = useState(() => resolveExpressionSrc(characterId, expression));
  const [imgError, setImgError] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);

  // Sync expression image when expression/character changes
  useEffect(() => {
    setImgSrc(resolveExpressionSrc(characterId, expression));
    setImgError(false);
  }, [characterId, expression]);

  // Detect reduced-motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    function update() { reducedMotionRef.current = mq.matches; }
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Persist side/visibility
  useEffect(() => {
    try { localStorage.setItem(SIDE_KEY, side); } catch { /* ignore */ }
  }, [side]);

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_KEY, String(visible)); } catch { /* ignore */ }
  }, [visible]);

  // Clear bubble on tab change
  useEffect(() => {
    setBubble(false);
  }, [activeTab]);

  // Clear timers on unmount
  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const handleMove = useCallback(() => {
    if (reducedMotionRef.current) {
      setSide((s) => (s === 'right' ? 'left' : 'right'));
      return;
    }
    setSide((s) => (s === 'right' ? 'left' : 'right'));
    setBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(false), BUBBLE_MS);
  }, []);

  const handleHide = useCallback(() => {
    setVisible(false);
    setBubble(false);
  }, []);

  const handleShow = useCallback(() => {
    setVisible(true);
  }, []);

  // Hide on certain tabs, when a dialog is open, or when explicitly hidden
  const tabHidden = HIDDEN_ON.has(activeTab);
  if (tabHidden || dialogOpen) return null;

  const isLeft = side === 'left';

  // Show a compact "Show Emma" pill when hidden
  if (!visible) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: `calc(${NAV_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`,
          left: isLeft ? EDGE_SPACING : undefined,
          right: isLeft ? undefined : EDGE_SPACING,
          zIndex: 40,
        }}
      >
        <button
          onClick={handleShow}
          aria-label="Show Emma"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white shadow-md border border-violet-100 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2"
          style={{ minHeight: 40 }}
        >
          <span
            className="w-6 h-6 rounded-full overflow-hidden shrink-0"
            style={{ border: '2px solid var(--theme-primary-mid)' }}
          >
            <img
              src={imgError ? getDefaultSrc(characterId) : imgSrc}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
              onError={() => setImgError(true)}
            />
          </span>
          <span className="text-[11px] font-semibold text-violet-500">Show Emma</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: `calc(${NAV_HEIGHT + 12}px + env(safe-area-inset-bottom, 0px))`,
        left: isLeft ? EDGE_SPACING : undefined,
        right: isLeft ? undefined : EDGE_SPACING,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      {/* Speech bubble (gentle, non-essential) */}
      {bubble && !reducedMotionRef.current && (
        <div
          style={{
            marginBottom: 2,
            marginLeft: isLeft ? 0 : 72,
            marginRight: isLeft ? 72 : 0,
            background: 'var(--theme-primary-light)',
            border: '1px solid var(--theme-primary-mid)',
            borderRadius: isLeft ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
            padding: '6px 10px',
            maxWidth: 160,
            pointerEvents: 'none',
            animation: 'bestieBubbleIn 200ms ease-out',
          }}
        >
          <p style={{ fontSize: 11, color: '#374151', lineHeight: 1.3, margin: 0 }}>
            Oops! Let me scoot over.
          </p>
        </div>
      )}

      {/* Portrait frame + controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isLeft ? 'flex-start' : 'flex-end',
          gap: 4,
          pointerEvents: 'none',
        }}
      >
        {/* Compact rounded portrait frame */}
        <div
          style={{
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: 18,
            overflow: 'hidden',
            border: '2px solid var(--theme-primary-mid)',
            boxShadow: '0 2px 12px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(255,255,255,0.6) inset',
            background: 'var(--theme-primary-light)',
            pointerEvents: 'none',
            position: 'relative',
          }}
        >
          <img
            src={imgError ? getDefaultSrc(characterId) : imgSrc}
            alt="Emma floating companion"
            draggable={false}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              display: 'block',
              userSelect: 'none',
              animation: reducedMotionRef.current ? undefined : 'bestie-float-gentle 5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Controls row — pointer events only here */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            pointerEvents: 'auto',
            flexDirection: 'row',
            justifyContent: isLeft ? 'flex-start' : 'flex-end',
          }}
        >
          <button
            onClick={handleMove}
            aria-label={`Move Emma to the ${isLeft ? 'right' : 'left'} side`}
            className="flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2"
            style={{ width: 32, height: 32, minHeight: 32 }}
          >
            {isLeft ? <ChevronRight size={16} className="text-violet-400" /> : <ChevronLeft size={16} className="text-violet-400" />}
          </button>
          <button
            onClick={handleHide}
            aria-label="Hide Emma for now"
            className="flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2"
            style={{ width: 32, height: 32, minHeight: 32 }}
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bestieBubbleIn {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bestie-float-gentle {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes bestie-float-gentle {
            0%, 100% { transform: none; }
          }
        }
      `}</style>
    </div>
  );
}
