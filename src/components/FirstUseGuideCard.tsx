import { CalendarPlus, MessageCircleHeart, UtensilsCrossed, ArrowRight } from 'lucide-react';
import type { TabName } from './BottomNav';

interface FirstUseGuideCardProps {
  bestieName: string;
  onTabChange: (tab: TabName) => void;
}

const ACTIONS: Array<{
  title: string;
  description: string;
  tab: TabName;
  icon: typeof CalendarPlus;
}> = [
  {
    title: "Add today's plan",
    description: 'Start with one or two things that matter today.',
    tab: 'planner',
    icon: CalendarPlus,
  },
  {
    title: 'Plan a meal',
    description: 'Choose something simple so dinner is one less decision.',
    tab: 'planner',
    icon: UtensilsCrossed,
  },
  {
    title: 'Talk to my Bestie',
    description: 'Ask for help, sort out your day, or just check in.',
    tab: 'chat',
    icon: MessageCircleHeart,
  },
];

export default function FirstUseGuideCard({ bestieName, onTabChange }: FirstUseGuideCardProps) {
  return (
    <section
      className="rounded-3xl bg-white border shadow-sm overflow-hidden"
      style={{ borderColor: 'var(--theme-primary-mid)' }}
      aria-label="Start here"
    >
      <div className="px-4 pt-4 pb-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: 'var(--theme-primary)' }}
        >
          Start here
        </p>
        <h2 className="text-base font-bold text-gray-800 mt-1">Three easy ways to begin</h2>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          You do not need to set up everything at once. {bestieName} can help you build it as you go.
        </p>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {ACTIONS.map(({ title, description, tab, icon: Icon }) => (
          <button
            key={title}
            type="button"
            onClick={() => onTabChange(tab)}
            className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3 text-left active:scale-[0.99] transition-all hover:border-gray-200"
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--theme-primary-light)' }}
            >
              <Icon size={18} style={{ color: 'var(--theme-primary)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{description}</p>
            </div>
            <ArrowRight size={14} className="text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
