import { createContext, useContext, useId, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { SearchMatch, SettingsForm } from '@/lib/settings';
import { cn } from '@/lib/utils';

export interface SettingsCtx {
  form: SettingsForm;
  set: <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => void;
  // Edit a nested part of the form in place (on a copy).
  update: (fn: (draft: SettingsForm) => void) => void;
  // Set while the search box has matches: only matching blocks are shown.
  match: SearchMatch | null;
  canManage: boolean;
}

const Ctx = createContext<SettingsCtx | null>(null);
export const SettingsProvider = Ctx.Provider;

export function useSettings(): SettingsCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSettings must be used inside <SettingsProvider>');
  return c;
}

// Value and change handler for a top-level form key.
export function useBind() {
  const { form, set } = useSettings();
  return <K extends keyof SettingsForm>(key: K) => ({
    name: key as string,
    value: form[key],
    onChange: (v: SettingsForm[K]) => set(key, v),
  });
}

// A titled group of settings. `block` ties it to the search index.
export function SettingsCard({
  block,
  title,
  disabled,
  className,
  children,
}: {
  block: string;
  title?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { match } = useSettings();
  if (match && !match.blocks.has(block)) return null;
  return (
    <fieldset
      disabled={disabled}
      className={cn('bg-card min-w-0 rounded-xl border p-5', className)}
      data-block={block}
    >
      {title ? (
        <legend className="float-left mb-4 w-full text-sm font-semibold">{title}</legend>
      ) : null}
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

// A group nested in a card, without its own search block.
export function SubCard({
  title,
  disabled,
  children,
  className,
}: {
  title?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset disabled={disabled} className={cn('min-w-0 rounded-lg border p-4', className)}>
      {title ? (
        <legend className="float-left mb-3 w-full text-sm font-medium">{title}</legend>
      ) : null}
      <div className="clear-both flex flex-col gap-4">{children}</div>
    </fieldset>
  );
}

function Hint({ id, children }: { id: string; children?: ReactNode }) {
  return children ? (
    <p id={id} className="text-muted-foreground text-xs">
      {children}
    </p>
  ) : null;
}

interface BaseProps {
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function FieldText({
  label,
  hint,
  value,
  onChange,
  className,
  ...rest
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  pattern?: string;
  readOnly?: boolean;
  inputClassName?: string;
  // Overrides the generated id, so the field can be focused from outside.
  id?: string;
}) {
  const generated = useId();
  const { inputClassName, id: given, ...input } = rest;
  const id = given ?? generated;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClassName}
        {...input}
      />
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export function FieldNumber({
  label,
  hint,
  value,
  onChange,
  className,
  ...rest
}: BaseProps & {
  value: number;
  onChange: (v: number) => void;
  name?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        required
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...rest}
      />
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export function FieldArea({
  label,
  hint,
  value,
  onChange,
  className,
  ...rest
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  name?: string;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  const id = useId();
  const { mono, ...area } = rest;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(mono && 'font-mono')}
        {...area}
      />
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export function FieldSwitch({
  label,
  hint,
  value,
  onChange,
  disabled,
  className,
  testId,
}: BaseProps & {
  value: boolean;
  onChange: (v: boolean) => void;
  name?: string;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className="gap-3 font-normal">
        <Switch
          checked={!!value}
          onCheckedChange={onChange}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          data-testid={testId}
        />
        {label}
      </Label>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export function FieldSelect({
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
  className,
  testId,
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Hint id={`${id}-hint`}>{hint}</Hint>
    </div>
  );
}

export const Row = ({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) => (
  <div className={cn('grid gap-4', cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
    {children}
  </div>
);
