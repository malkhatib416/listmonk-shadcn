import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-info text-info-foreground',
  danger: 'bg-danger text-danger-foreground',
};

// A small pastel pill for statuses, types and tags.
export function StatusBadge({
  tone = 'neutral',
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}
