import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pb-6">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1.5 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
