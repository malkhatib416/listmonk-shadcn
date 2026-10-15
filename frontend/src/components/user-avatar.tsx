import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const TINTS = [
  'bg-info text-info-foreground',
  'bg-success text-success-foreground',
  'bg-warning text-warning-foreground',
  'bg-danger text-danger-foreground',
  'bg-secondary text-secondary-foreground',
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export const initials = (s: string): string =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

// An avatar image, or initials on a pastel tint picked from the name.
export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8', className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className={cn('text-xs font-medium', TINTS[hash(name) % TINTS.length])}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
