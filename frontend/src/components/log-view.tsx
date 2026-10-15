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
      className="bg-card h-[calc(100svh-16rem)] min-h-64 overflow-auto rounded-xl border py-2 font-mono text-[13px] leading-6"
      role="log"
      aria-live="off"
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            'hover:bg-muted/60 px-4 break-words',
            isErrorLine(l) && 'bg-danger text-danger-foreground hover:bg-danger',
          )}
        >
          {l.timestamp ? <span className="text-muted-foreground/80">{l.timestamp} </span> : null}
          {l.file && l.file !== '*' ? (
            <span className="text-muted-foreground">{l.file}: </span>
          ) : null}
          <span>{l.message}</span>
        </div>
      ))}
    </div>
  );
}
