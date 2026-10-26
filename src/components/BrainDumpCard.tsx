import { Brain } from 'lucide-react';

interface BrainDumpCardProps {
  onClick: () => void;
}

export default function BrainDumpCard({ onClick }: BrainDumpCardProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Brain dump — what's on your mind?"
      className="w-full text-left rounded-2xl px-4 py-4 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
      style={{
        background: 'linear-gradient(135deg, #f5f0ff 0%, #ede4ff 100%)',
        border: '1px solid #e0d4f7',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#d8c8f0' }}>
          <Brain size={18} style={{ color: '#7c5fd6' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-violet-700">What's on your mind?</p>
          <p className="text-xs text-violet-400 leading-snug mt-0.5">
            Dump your thoughts — Emma will organize them into tasks and groceries.
          </p>
        </div>
      </div>
    </button>
  );
}
