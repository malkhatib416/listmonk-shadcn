import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 pb-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1.5 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
