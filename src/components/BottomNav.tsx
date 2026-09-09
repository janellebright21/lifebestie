import { Home, Calendar, Plus, ShoppingCart, MessageCircle, Activity, ListChecks, Settings, Heart } from 'lucide-react';
import { ModuleId } from '../lib/supabase';

export type TabName = 'home' | 'planner' | 'add' | 'grocery' | 'movement' | 'routines' | 'goals' | 'chat' | 'bestie' | 'settings';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  enabledModules: Set<ModuleId>;
}

// Map from tab → module that gates it (undefined = always shown)
const TAB_MODULE: Partial<Record<TabName, ModuleId>> = {
  grocery:  'grocery',
  movement: 'movement',
  routines: 'routines',
  chat:     'ai-assistant',
};

const THEME_PRIMARY     = 'var(--theme-primary)';
const THEME_PRIMARY_MID = 'var(--theme-primary-mid)';

export default function BottomNav({ activeTab, onTabChange, enabledModules }: BottomNavProps) {
  const allTabs = [
    { id: 'home'     as TabName, icon: Home,          label: 'Home'     },
    { id: 'planner'  as TabName, icon: Calendar,      label: 'Planner'  },
    { id: 'add'      as TabName, icon: Plus,          label: ''         },
    { id: 'grocery'  as TabName, icon: ShoppingCart,  label: 'Grocery'  },
    { id: 'movement' as TabName, icon: Activity,      label: 'Move'     },
    { id: 'routines' as TabName, icon: ListChecks,    label: 'Routines' },
    { id: 'chat'     as TabName, icon: MessageCircle, label: 'Chat'     },
  ];

  const tabs = allTabs.filter((t) => {
    const module = TAB_MODULE[t.id];
    return !module || enabledModules.has(module);
  });

  return (
    // position: relative so the absolutely-positioned Plus button is anchored here.
    // The nav is fixed full-width, so left: 50% always equals the true screen center.
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Plus button — lifted out of the flex row and pinned to true screen center.
          left: 50% on a full-viewport-width element is always the horizontal midpoint,
          matching the max-w-md mx-auto content container on every screen size. */}
      <button
        onClick={() => onTabChange('add')}
        aria-label="Add"
        className="absolute left-1/2 -translate-x-1/2 -top-5 flex items-center justify-center w-12 h-12 rounded-full shadow-lg active:scale-95 transition-transform z-10"
        style={{
          backgroundColor: THEME_PRIMARY,
          boxShadow: `0 4px 16px ${THEME_PRIMARY_MID}`,
        }}
      >
        <Plus size={22} className="text-white" strokeWidth={2.5} />
      </button>

      <div className="flex items-center justify-around px-0.5 pt-3 pb-1 max-w-2xl mx-auto">
        {tabs.map((tab) => {
          // Replace the "add" slot with a same-width invisible spacer so the
          // surrounding tabs split evenly to either side of the floating button.
          if (tab.id === 'add') {
            return <div key="add-spacer" className="w-12 shrink-0" aria-hidden="true" />;
          }

          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[36px] min-h-[44px] px-1"
              aria-label={tab.label}
            >
              <Icon
                size={20}
                style={{ color: isActive ? THEME_PRIMARY : undefined }}
                className={isActive ? '' : 'text-slate-400'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={`text-[9px] font-medium leading-none ${isActive ? '' : 'text-slate-400'}`}
                style={{ color: isActive ? THEME_PRIMARY : undefined }}
              >
                {tab.label}
              </span>
              {isActive && (
                <span
                  className="block w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: THEME_PRIMARY }}
                />
              )}
            </button>
          );
        })}

        {/* My Bestie — always visible */}
        <button
          onClick={() => onTabChange('bestie')}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[36px] min-h-[44px] px-1"
          aria-label="My Bestie"
        >
          <Heart
            size={20}
            style={{ color: activeTab === 'bestie' ? THEME_PRIMARY : undefined }}
            className={activeTab === 'bestie' ? '' : 'text-slate-400'}
            strokeWidth={activeTab === 'bestie' ? 2.2 : 1.8}
          />
          <span
            className={`text-[9px] font-medium leading-none ${activeTab === 'bestie' ? '' : 'text-slate-400'}`}
            style={{ color: activeTab === 'bestie' ? THEME_PRIMARY : undefined }}
          >
            Bestie
          </span>
          {activeTab === 'bestie' && (
            <span className="block w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: THEME_PRIMARY }} />
          )}
        </button>

        {/* Settings gear — always visible */}
        <button
          onClick={() => onTabChange('settings')}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[36px] min-h-[44px] px-1"
          aria-label="Settings"
        >
          <Settings
            size={20}
            style={{ color: activeTab === 'settings' ? THEME_PRIMARY : undefined }}
            className={activeTab === 'settings' ? '' : 'text-slate-400'}
            strokeWidth={activeTab === 'settings' ? 2.2 : 1.8}
          />
          <span
            className={`text-[9px] font-medium leading-none ${activeTab === 'settings' ? '' : 'text-slate-400'}`}
            style={{ color: activeTab === 'settings' ? THEME_PRIMARY : undefined }}
          >
            Settings
          </span>
          {activeTab === 'settings' && (
            <span className="block w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: THEME_PRIMARY }} />
          )}
        </button>
      </div>
    </nav>
  );
}
