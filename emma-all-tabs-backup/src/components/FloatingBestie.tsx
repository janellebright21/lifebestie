import { useState, useEffect, useRef, useCallback } from 'react';
import { resolveExpressionSrc, getDefaultSrc } from '../lib/characterAssets';
import type { CharacterId, AvatarExpression } from '../lib/supabase';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TabName } from './BottomNav';
import { NAV_HEIGHT } from './BottomNav';

const EDGE_SPACING = 12;
const AVATAR_SIZE = 64;
const BUBBLE_MS = 2000;
const CONTROL_SIZE = 44;

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

/**
 * Check whether a single element is actually rendered and visible.
 * Uses getClientRects() (works for fixed-position elements where offsetParent is null)
 * plus computed display/visibility checks. Respects hidden attribute, aria-hidden,
 * and the 'hidden' Tailwind class.
 */
function isElementVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  // Fast exits for explicit hidden states
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.classList.contains('hidden')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  // getClientRects works for fixed elements (offsetParent is null for fixed)
  const rects = el.getClientRects();
  if (rects.length === 0) return false;
  const r = rects[0]!;
  // Must have nonzero area
  if (r.width === 0 && r.height === 0) return false;
  return true;
}

/**
 * Check whether any modal dialog or sheet is currently visible in the DOM.
 * Detects native <dialog> elements that are open, plus elements with
 * role="dialog" or aria-modal="true" that are actually rendered.
 */
function isAnyDialogOpen(): boolean {
  const nativeDialogs = document.querySelectorAll('dialog');
  for (const d of nativeDialogs) {
    if (d.open) return true;
  }
  // Broader selector: role=dialog OR aria-modal=true (not requiring both)
  const ariaDialogs = document.querySelectorAll('[role="dialog"], [aria-modal="true"]');
  for (const d of ariaDialogs) {
    if (isElementVisible(d)) return true;
  }
  return false;
}

/**
 * Check whether focus is currently inside an editable element.
 */
function isFocusInEditable(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

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
  const [side, setSide] = useState<'left' | 'right'>(loadSide);
  const [visible, setVisible] = useState<boolean>(loadVisible);
  const [bubble, setBubble] = useState(false);
  const [imgSrc, setImgSrc] = useState(() => resolveExpressionSrc(characterId, expression));
  const [imgError, setImgError] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    setImgSrc(resolveExpressionSrc(characterId, expression));
    setImgError(false);
  }, [characterId, expression]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    function update() { reducedMotionRef.current = mq.matches; }
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SIDE_KEY, side); } catch { /* ignore */ }
  }, [side]);

  useEffect(() => {
    try { localStorage.setItem(VISIBLE_KEY, String(visible)); } catch { /* ignore */ }
  }, [visible]);

  useEffect(() => { setBubble(false); }, [activeTab]);

  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  // ── Dialog/editable suppression ────────────────────────────────────────────
  // Recompute overlay state when:
  //  - activeTab changes (handled by re-render)
  //  - focus changes (focusin immediate, focusout after microtask so focus settles)
  //  - DOM mutations add/remove/toggle dialogs (MutationObserver, scoped to body)
  //
  // Observer callbacks are coalesced via a scheduled flag so burst mutations
  // produce a single check. React state updates only when the boolean changes.
  const overlayRef = useRef(false);
  const scheduledRef = useRef(false);

  const recomputeOverlay = useCallback(() => {
    const next = isAnyDialogOpen() || isFocusInEditable();
    if (next !== overlayRef.current) {
      overlayRef.current = next;
      setOverlayActive(next);
    }
  }, []);

  const scheduleCheck = useCallback(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    queueMicrotask(() => {
      scheduledRef.current = false;
      recomputeOverlay();
    });
  }, [recomputeOverlay]);

  useEffect(() => {
    // Initial computation
    overlayRef.current = isAnyDialogOpen() || isFocusInEditable();
    setOverlayActive(overlayRef.current);

    function onFocusIn() { recomputeOverlay(); }
    function onFocusOut() { scheduleCheck(); }

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);

    const observer = new MutationObserver(scheduleCheck);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'aria-modal', 'aria-hidden', 'hidden', 'style', 'class'],
    });

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      observer.disconnect();
      scheduledRef.current = false;
    };
  }, [recomputeOverlay, scheduleCheck]);

  const handleMove = useCallback(() => {
    setSide((s) => (s === 'right' ? 'left' : 'right'));
    if (!reducedMotionRef.current) {
      setBubble(true);
      if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
      bubbleTimer.current = setTimeout(() => setBubble(false), BUBBLE_MS);
    }
  }, []);

  const handleHide = useCallback(() => {
    setVisible(false);
    setBubble(false);
  }, []);

  const handleShow = useCallback(() => {
    setVisible(true);
  }, []);

  const tabHidden = HIDDEN_ON.has(activeTab);
  if (tabHidden || overlayActive) return null;

  const isLeft = side === 'left';

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
          className="flex items-center gap-1.5 px-3 rounded-full bg-white shadow-md border border-violet-100 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2"
          style={{ minHeight: CONTROL_SIZE, height: CONTROL_SIZE }}
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

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isLeft ? 'flex-start' : 'flex-end', gap: 4, pointerEvents: 'none' }}>
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

        {/* Controls row — 44px hit targets, pointer events only here */}
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
            style={{ width: CONTROL_SIZE, height: CONTROL_SIZE, minHeight: CONTROL_SIZE }}
          >
            {isLeft ? <ChevronRight size={18} className="text-violet-400" /> : <ChevronLeft size={18} className="text-violet-400" />}
          </button>
          <button
            onClick={handleHide}
            aria-label="Hide Emma for now"
            className="flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 active:scale-90 transition-transform focus-visible:outline-none focus-visible:ring-2"
            style={{ width: CONTROL_SIZE, height: CONTROL_SIZE, minHeight: CONTROL_SIZE }}
          >
            <X size={16} className="text-gray-400" />
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
