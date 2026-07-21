import { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTERS } from '../lib/supabase';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import BestieAvatar from './besties/BestieAvatar';
import type { TabName } from './BottomNav';

// Keep the floating avatar well above the nav + plus button (which extends ~20px above nav top)
const NAV_CLEARANCE = 90;
const EDGE_SPACING = 12;
const SLIDE_MS = 350;
const BUBBLE_MS = 2000;

const HIDDEN_ON: Set<TabName> = new Set(['bestie', 'settings', 'add', 'chat']);

interface FloatingBestieProps {
  characterId: CharacterId;
  expression?: AvatarExpression;
  activeTab: TabName;
}

export default function FloatingBestie({
  characterId,
  expression = 'happy',
  activeTab,
}: FloatingBestieProps) {
  const [side, setSide] = useState<'left' | 'right'>('right');
  const [bubble, setBubble] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const char = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0]!;

  useEffect(() => {
    setBubble(false);
  }, [activeTab]);

  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const handleScoot = useCallback(() => {
    setSide((s) => (s === 'right' ? 'left' : 'right'));
    setBubble(true);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(false), BUBBLE_MS);
  }, []);

  if (HIDDEN_ON.has(activeTab)) return null;

  const isLeft = side === 'left';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: `calc(${NAV_CLEARANCE}px + env(safe-area-inset-bottom, 0px))`,
        left: isLeft ? EDGE_SPACING : undefined,
        right: isLeft ? undefined : EDGE_SPACING,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        transition: `left ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), right ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        pointerEvents: 'none',
      }}
    >
      {/* Speech bubble */}
      {bubble && (
        <div
          style={{
            marginBottom: 8,
            marginLeft: isLeft ? 0 : 80,
            marginRight: isLeft ? 80 : 0,
            background: `${char.primaryColor}14`,
            border: `1px solid ${char.primaryColor}33`,
            borderRadius: isLeft ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
            padding: '8px 12px',
            maxWidth: 176,
            pointerEvents: 'none',
            animation: 'bestieBubbleIn 200ms ease-out',
          }}
        >
          <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.4, margin: 0 }}>
            Oops! Let me scoot over.
          </p>
        </div>
      )}

      {/* Character button */}
      <button
        aria-label="Move bestie to the other side"
        onClick={handleScoot}
        style={{
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
          WebkitTapHighlightColor: 'transparent',
          pointerEvents: 'auto',
        }}
      >
        <BestieAvatar
          characterId={characterId}
          expression={expression}
          size="lg"
          enable3D
        />
      </button>

      <style>{`
        @keyframes bestieBubbleIn {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
