import { Home, Calendar, Plus, ShoppingCart, MessageCircle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type TabName = 'home' | 'planner' | 'add' | 'grocery' | 'goals' | 'chat';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'home' as TabName, icon: Home, label: 'Home' },
    { id: 'planner' as TabName, icon: Calendar, label: 'Planner' },
    { id: 'add' as TabName, icon: Plus, label: '' },
    { id: 'grocery' as TabName, icon: ShoppingCart, label: 'Grocery' },
    { id: 'chat' as TabName, icon: MessageCircle, label: 'Chat' },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-rose-100 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isAdd = tab.id === 'add';
          const isActive = activeTab === tab.id;

          if (isAdd) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-4 flex items-center justify-center w-14 h-14 rounded-full bg-rose-400 shadow-lg shadow-rose-200 active:scale-95 transition-transform"
                aria-label="Add"
              >
                <Plus size={26} className="text-white" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[44px]"
              aria-label={tab.label}
            >
              <Icon
                size={22}
                className={isActive ? 'text-rose-400' : 'text-gray-400'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${isActive ? 'text-rose-400' : 'text-gray-400'}`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[44px] group"
          aria-label="Sign out"
        >
          <LogOut
            size={22}
            className="text-gray-300 group-hover:text-rose-300 transition-colors"
            strokeWidth={1.8}
          />
          <span className="text-[10px] font-medium text-gray-300 group-hover:text-rose-300 transition-colors">
            Out
          </span>
        </button>
      </div>
    </nav>
  );
}
