import { Settings, CheckCircle2, Circle, Lock, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MODULE_DEFS, ModuleId } from '../lib/supabase';

interface SettingsPageProps {
  isEnabled: (id: ModuleId) => boolean;
  onSetEnabled: (id: ModuleId, enabled: boolean) => Promise<void>;
}

export default function SettingsPage({ isEnabled, onSetEnabled }: SettingsPageProps) {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  const available = MODULE_DEFS.filter((m) => m.available);
  const comingSoon = MODULE_DEFS.filter((m) => !m.available);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Settings size={18} className="text-gray-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-none">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Customize your experience</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-6">

        {/* Modules section */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Modules
          </h2>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Only enabled modules appear in navigation and dashboards.
          </p>
          <div className="space-y-2">
            {available.map((mod) => {
              const enabled = isEnabled(mod.id);
              return (
                <button
                  key={mod.id}
                  onClick={() => onSetEnabled(mod.id, !enabled)}
                  className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform shadow-sm"
                >
                  <div className={`shrink-0 transition-colors ${enabled ? 'text-rose-400' : 'text-gray-300'}`}>
                    {enabled
                      ? <CheckCircle2 size={20} />
                      : <Circle size={20} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {mod.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    enabled ? 'bg-rose-50 text-rose-500' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {enabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coming soon */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Coming Soon
          </h2>
          <div className="space-y-2">
            {comingSoon.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 opacity-60"
              >
                <Lock size={18} className="text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-500">{mod.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-snug">{mod.description}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">
                  Soon
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-500 active:scale-[0.98] transition-transform shadow-sm"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
