import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, Calendar, Plus, ShoppingCart, MessageCircle,
  Activity, ListChecks, Settings, Heart, Target, MoreHorizontal,
} from 'lucide-react';
import type { ModuleId } from '../lib/supabase';
import {
  type TabName, MORE_TAB_IDS,
  resolveFourthSlot, resolveMoreDestinations, isMoreActive,
} from './navLogic';

export type { TabName } from './navLogic';
export const NAV_HEIGHT = 64;

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  enabledModules: Set<ModuleId>;
}

const THEME_PRIMARY     = 'var(--theme-primary)';
const THEME_PRIMARY_MID = 'var(--theme-primary-mid)';

export default function BottomNav({ activeTab, onTabChange, enabledModules }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const fourthTab = resolveFourthSlot(enabledModules);
  const fourthIcon = fourthTab === 'chat' ? MessageCircle : fourthTab === 'grocery' ? ShoppingCart : Heart;
  const fourthLabel = fourthTab === 'chat' ? 'Chat' : fourthTab === 'grocery' ? 'Grocery' : 'Bestie';
  const moreActive = isMoreActive(activeTab, fourthTab);
  const moreDestinations = resolveMoreDestinations(enabledModules);

  useEffect(() => {
    if (!MORE_TAB_IDS.has(activeTab) || activeTab === fourthTab) {
      setMoreOpen(false);
    }
  }, [activeTab, fourthTab]);

  const openMore = useCallback(() => {
    lastFocusedRef.current = moreButtonRef.current;
    setMoreOpen(true);
  }, []);

  const closeMore = useCallback(() => {
    setMoreOpen(false);
    requestAnimationFrame(() => {
      lastFocusedRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMore();
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusables = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    requestAnimationFrame(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>('button');
      first?.focus();
    });
    return () => document.removeEventListener('keydown', handleKey);
  }, [moreOpen, closeMore]);

  function handleMoreSelect(tab: TabName) {
    setMoreOpen(false);
    onTabChange(tab);
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
        style={{
          backgroundColor: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}
        aria-label="Primary navigation"
      >
        <div
          className="flex items-stretch justify-around max-w-2xl mx-auto px-1"
          style={{ paddingTop: 8, paddingBottom: 4, minHeight: NAV_HEIGHT }}
        >
          <NavButton icon={Home} label="Home" isActive={activeTab === 'home'} onClick={() => onTabChange('home')} />
          <NavButton icon={Calendar} label="Planner" isActive={activeTab === 'planner'} onClick={() => onTabChange('planner')} />

          {/* Add — labeled primary button inside its slot */}
          <button
            onClick={() => onTabChange('add')}
            aria-label="Add"
            className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-1 rounded-xl active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, backgroundColor: THEME_PRIMARY, boxShadow: `0 2px 8px ${THEME_PRIMARY_MID}` }}
            >
              <Plus size={20} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-medium leading-none text-slate-400">Add</span>
          </button>

          {/* 4th slot: Chat, Grocery, or Bestie fallback */}
          <NavButton
            icon={fourthIcon}
            label={fourthLabel}
            isActive={activeTab === fourthTab}
            onClick={() => onTabChange(fourthTab)}
          />

          {/* More */}
          <button
            ref={moreButtonRef}
            onClick={openMore}
            aria-label="More navigation options"
            aria-expanded={moreOpen}
            aria-current={moreActive ? 'page' : undefined}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-1 rounded-xl active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2"
          >
            <MoreHorizontal
              size={22}
              style={{ color: moreActive ? THEME_PRIMARY : undefined }}
              className={moreActive ? '' : 'text-slate-400'}
              strokeWidth={moreActive ? 2.2 : 1.8}
            />
            <span className="text-[11px] font-medium leading-none" style={{ color: moreActive ? THEME_PRIMARY : undefined }}>
              <span className={moreActive ? '' : 'text-slate-400'}>More</span>
            </span>
            {moreActive && <span className="block w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: THEME_PRIMARY }} />}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={closeMore}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl shadow-2xl max-w-2xl mx-auto w-full safe-bottom"
            style={{ animation: 'moreSheetIn 200ms ease-out' }}
          >
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">More</h2>
              <button
                onClick={closeMore}
                aria-label="Close more menu"
                className="flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2"
                style={{ width: 44, height: 44, minHeight: 44 }}
              >
                <span className="text-lg text-gray-400 leading-none">&times;</span>
              </button>
            </div>
            <div className="px-4 pb-6 grid grid-cols-3 gap-2">
              {moreDestinations.map((dest) => {
                const tab = dest.id;
                const Icon = tab === 'grocery' ? ShoppingCart : tab === 'movement' ? Activity : tab === 'routines' ? ListChecks : tab === 'goals' ? Target : tab === 'bestie' ? Heart : Settings;
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => handleMoreSelect(tab)}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex flex-col items-center gap-2 py-3 rounded-2xl transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2"
                    style={{ backgroundColor: isActive ? 'var(--theme-primary-light)' : 'transparent', minHeight: 56 }}
                  >
                    <Icon size={24} style={{ color: isActive ? THEME_PRIMARY : undefined }} className={isActive ? '' : 'text-slate-400'} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="text-[12px] font-medium leading-none" style={{ color: isActive ? THEME_PRIMARY : undefined }}>
                      <span className={isActive ? '' : 'text-slate-500'}>{dest.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <style>{`@keyframes moreSheetIn { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}
    </>
  );
}

function NavButton({
  icon: Icon, label, isActive, onClick,
}: {
  icon: typeof Home; label: string; isActive: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] px-1 rounded-xl active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2"
    >
      <Icon size={22} style={{ color: isActive ? THEME_PRIMARY : undefined }} className={isActive ? '' : 'text-slate-400'} strokeWidth={isActive ? 2.2 : 1.8} />
      <span className="text-[11px] font-medium leading-none" style={{ color: isActive ? THEME_PRIMARY : undefined }}>
        <span className={isActive ? '' : 'text-slate-400'}>{label}</span>
      </span>
      {isActive && <span className="block w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: THEME_PRIMARY }} />}
    </button>
  );
}
