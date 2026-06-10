import { Home, Calendar, Plus, ShoppingCart, MessageCircle, Activity, ListChecks, Settings } from 'lucide-react';
import { ModuleId } from '../lib/supabase';

export type TabName = 'home' | 'planner' | 'add' | 'grocery' | 'movement' | 'routines' | 'goals' | 'chat' | 'settings';

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
    { id: 'add'      as TabName, icon: Plus,           label: ''         },
    { id: 'grocery'  as TabName, icon: ShoppingCart,  label: 'Grocery'  },
    { id: 'movement' as TabName, icon: Activity,       label: 'Move'     },
    { id: 'routines' as TabName, icon: ListChecks,     label: 'Routines' },
    { id: 'chat'     as TabName, icon: MessageCircle,  label: 'Chat'     },
  ];

  const tabs = allTabs.filter((t) => {
    const module = TAB_MODULE[t.id];
    return !module || enabledModules.has(module);
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white safe-bottom"
      style={{ borderTop: `1px solid ${THEME_PRIMARY_MID}` }}
    >
      <div className="flex items-center justify-around px-1 py-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isAdd    = tab.id === 'add';
          const isActive = activeTab === tab.id;

          if (isAdd) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-3 flex items-center justify-center w-11 h-11 rounded-full shadow-lg active:scale-95 transition-transform"
                style={{ backgroundColor: THEME_PRIMARY, boxShadow: `0 4px 14px ${THEME_PRIMARY_MID}` }}
                aria-label="Add"
              >
                <Plus size={20} className="text-white" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-0.5 px-1 py-1 min-w-[32px]"
              aria-label={tab.label}
            >
              <Icon
                size={18}
                style={{ color: isActive ? THEME_PRIMARY : undefined }}
                className={isActive ? '' : 'text-gray-400'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={`text-[8px] font-medium leading-none ${isActive ? '' : 'text-gray-400'}`}
                style={{ color: isActive ? THEME_PRIMARY : undefined }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Settings gear — always visible */}
        <button
          onClick={() => onTabChange('settings')}
          className="flex flex-col items-center gap-0.5 px-1 py-1 min-w-[32px]"
          aria-label="Settings"
        >
          <Settings
            size={18}
            style={{ color: activeTab === 'settings' ? THEME_PRIMARY : undefined }}
            className={activeTab === 'settings' ? '' : 'text-gray-400'}
            strokeWidth={activeTab === 'settings' ? 2.2 : 1.8}
          />
          <span
            className={`text-[8px] font-medium leading-none ${activeTab === 'settings' ? '' : 'text-gray-400'}`}
            style={{ color: activeTab === 'settings' ? THEME_PRIMARY : undefined }}
          >
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
}
