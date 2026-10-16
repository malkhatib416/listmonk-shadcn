import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function Section({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-card flex flex-col gap-4 rounded-xl border p-5', className)}>
      {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
