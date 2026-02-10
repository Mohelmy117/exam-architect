import { cn } from '@/lib/utils';

interface HoloomsLogoProps {
  className?: string;
  iconOnly?: boolean;
}

export function HoloomsLogo({ className, iconOnly = false }: HoloomsLogoProps) {
  return (
    <svg
      viewBox={iconOnly ? '0 0 40 40' : '0 0 180 40'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('text-sidebar-foreground', className)}
    >
      {/* Brain/puzzle icon */}
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Head outline */}
        <path d="M12 8C8 8 5 11 5 15c0 3 1.5 5 4 6v5c0 1.5 1 3 3 3h4c2 0 3-1.5 3-3v-2" />
        {/* Top bump */}
        <path d="M16 8c0-3 2.5-5 5.5-5S27 5 27 8" />
        {/* Right side */}
        <path d="M27 8c3 1 5 3.5 5 7 0 3-1.5 5.5-4 7" />
        {/* Puzzle piece notch */}
        <path d="M19 15h5c1.5 0 2.5 1 2.5 2.5S25.5 20 24 20h-2" />
        {/* Cross/plus detail */}
        <path d="M15 14v6M12 17h6" />
      </g>

      {!iconOnly && (
        <text
          x="42"
          y="27"
          fill="currentColor"
          fontSize="20"
          fontWeight="600"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="-0.5"
        >
          holooms
        </text>
      )}
    </svg>
  );
}
