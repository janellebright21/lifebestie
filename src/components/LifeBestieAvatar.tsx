interface LifeBestieAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8',  inner: 'w-6 h-6',  text: 'text-sm' },
  md: { outer: 'w-11 h-11', inner: 'w-9 h-9',  text: 'text-lg' },
  lg: { outer: 'w-16 h-16', inner: 'w-13 h-13', text: 'text-2xl' },
};

export default function LifeBestieAvatar({ size = 'md', pulse = false, className = '' }: LifeBestieAvatarProps) {
  const s = SIZE_MAP[size];
  return (
    <div className={`relative shrink-0 ${s.outer} ${className}`}>
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-rose-200 via-amber-100 to-rose-100 ${pulse ? 'animate-pulse' : ''}`} />
      {/* Inner circle */}
      <div className={`absolute inset-[3px] rounded-full bg-gradient-to-br from-rose-300 to-amber-200 flex items-center justify-center shadow-inner`}>
        <span className={`${s.text} select-none leading-none`} role="img" aria-label="LifeBestie">
          💛
        </span>
      </div>
    </div>
  );
}
