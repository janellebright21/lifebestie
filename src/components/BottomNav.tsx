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

export default function BottomNav({ activeTab, onTabChange, enabledModules }: BottomNavProps) {
  const allTabs = [
    { id: 'home'     as TabName, icon: Home,         label: 'Home'     },
    { id: 'planner'  as TabName, icon: Calendar,     label: 'Planner'  },
    { id: 'add'      as TabName, icon: Plus,         label: ''         },
    { id: 'grocery'  as TabName, icon: ShoppingCart, label: 'Grocery'  },
    { id: 'movement' as TabName, icon: Activity,     label: 'Move'     },
    { id: 'routines' as TabName, icon: ListChecks,   label: 'Routines' },
    { id: 'chat'     as TabName, icon: MessageCircle,label: 'Chat'     },
  ];

  // Keep a tab if it has no gating module, or its module is enabled
  const tabs = allTabs.filter((t) => {
    const module = TAB_MODULE[t.id];
    return !module || enabledModules.has(module);
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-rose-100 safe-bottom">
      <div className="flex items-center justify-around px-1 py-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isAdd = tab.id === 'add';
          const isActive = activeTab === tab.id;

          if (isAdd) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-3 flex items-center justify-center w-11 h-11 rounded-full bg-rose-400 shadow-lg shadow-rose-200 active:scale-95 transition-transform"
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
                className={isActive ? 'text-rose-400' : 'text-gray-400'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={`text-[8px] font-medium leading-none ${isActive ? 'text-rose-400' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Settings gear — always visible, not module-gated */}
        <button
          onClick={() => onTabChange('settings')}
          className="flex flex-col items-center gap-0.5 px-1 py-1 min-w-[32px]"
          aria-label="Settings"
        >
          <Settings
            size={18}
            className={activeTab === 'settings' ? 'text-rose-400' : 'text-gray-400'}
            strokeWidth={activeTab === 'settings' ? 2.2 : 1.8}
          />
          <span className={`text-[8px] font-medium leading-none ${activeTab === 'settings' ? 'text-rose-400' : 'text-gray-400'}`}>
            Settings
          </span>
        </button>
      </div>
    </nav>
  );
}
