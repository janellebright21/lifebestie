import { AVATAR_THEMES, AvatarThemeId } from '../lib/supabase';

interface LifeBestieAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
  avatarTheme?: AvatarThemeId;
}

const SIZE_MAP = {
  sm: { outer: 'w-8 h-8',   text: 'text-sm'  },
  md: { outer: 'w-11 h-11', text: 'text-lg'  },
  lg: { outer: 'w-16 h-16', text: 'text-2xl' },
};

export default function LifeBestieAvatar({
  size = 'md',
  pulse = false,
  className = '',
  avatarTheme = 'classic',
}: LifeBestieAvatarProps) {
  const s = SIZE_MAP[size];
  const theme = AVATAR_THEMES.find((t) => t.id === avatarTheme) ?? AVATAR_THEMES[0]!;

  return (
    <div className={`relative shrink-0 ${s.outer} ${className}`}>
      {/* Outer glow ring */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${theme.ringGradient} ${pulse ? 'animate-pulse' : ''}`} />
      {/* Inner circle */}
      <div className={`absolute inset-[3px] rounded-full bg-gradient-to-br ${theme.innerGradient} flex items-center justify-center shadow-inner`}>
        <span className={`${s.text} select-none leading-none`} role="img" aria-label="LifeBestie">
          {theme.emoji}
        </span>
      </div>
    </div>
  );
}
