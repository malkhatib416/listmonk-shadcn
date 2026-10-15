import { useLayoutEffect, useRef } from 'react';
import { isErrorLine, type LogLine } from '@/lib/logs';
import { cn } from '@/lib/utils';

const STICKY_PX = 40;

export function LogView({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  // Follow new lines only while the reader is at the bottom; scrolling up pauses it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
      }}
      className="bg-muted/40 h-[calc(100svh-14rem)] min-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed"
      role="log"
      aria-live="off"
    >
      {lines.map((l, i) => (
        <div key={i} className="break-words">
          {l.timestamp ? <span className="text-muted-foreground">{l.timestamp} </span> : null}
          {l.file && l.file !== '*' ? (
            <span className="text-muted-foreground">{l.file}: </span>
          ) : null}
          <span className={cn(isErrorLine(l) && 'text-destructive')}>{l.message}</span>
        </div>
      ))}
    </div>
  );
}
