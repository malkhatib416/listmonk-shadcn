import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { cleanTag } from '@/lib/lists';
import { cn } from '@/lib/utils';

// Free-form tags: Enter or comma adds, Backspace on an empty field removes the last.
export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [text, setText] = useState('');

  const add = (raw: string) => {
    const tag = cleanTag(raw);
    setText('');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        'border-input bg-background focus-within:ring-ring/40 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-2',
        disabled && 'opacity-50',
        className,
      )}
    >
      {value.map((tag) => (
        <StatusBadge key={tag} className="gap-1 pr-1">
          #{tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            disabled={disabled}
            className="hover:bg-foreground/10 rounded-full p-0.5"
            onClick={() => onChange(value.filter((t) => t !== tag))}
          >
            <X className="size-3" />
          </button>
        </StatusBadge>
      ))}
      <input
        id={id}
        value={text}
        disabled={disabled}
        maxLength={50}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => text && add(text)}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent text-sm outline-none"
        data-testid="tag-input"
      />
    </div>
  );
}
