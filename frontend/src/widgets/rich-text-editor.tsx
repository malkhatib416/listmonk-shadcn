import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  ImageIcon,
  Indent,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Type,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import Squire from 'squire-rte';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from '@/components/app-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FLOAT_CLASSES,
  TRACK_SUFFIX,
  blockFromPath,
  buildLinkHref,
  imageAttrs,
  splitLinkHref,
  tableHtml,
  type Block,
} from '@/lib/richtext';
import { cn } from '@/lib/utils';
import { CodeEditor } from './code-editor';

const TRACK_KEY = 'trackLink';
const FONT_SIZES = ['10px', '11px', '12px', '14px', '15px', '16px', '18px', '24px', '36px'];
const BLOCKS: Block[] = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'];

const sanitizeToDOMFragment = (html: string) => {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  return document.importNode(tpl.content, true);
};

interface State {
  path: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sub: boolean;
  sup: boolean;
  ul: boolean;
  ol: boolean;
  link: boolean;
  image: boolean;
  color: boolean;
  highlight: boolean;
  align: string;
  canUndo: boolean;
  canRedo: boolean;
}

const INITIAL: State = {
  path: '',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  sub: false,
  sup: false,
  ul: false,
  ol: false,
  link: false,
  image: false,
  color: false,
  highlight: false,
  align: '',
  canUndo: false,
  canRedo: false,
};

// The element of the given selector at or around the current selection.
function closestInSelection(ed: Squire, root: HTMLElement, selector: string): Element | null {
  const range = ed.getSelection();
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  // A selection of just an image has the image as a child of the container.
  if (node instanceof Element) {
    const hit = node.closest(selector);
    if (hit && root.contains(hit)) return hit;
    const child = range.startContainer.childNodes[range.startOffset];
    if (child instanceof Element && child.matches(selector)) return child;
  }
  return null;
}

function alignOf(ed: Squire, root: HTMLElement): string {
  let node: Node | null = ed.getSelection().commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const block =
    node instanceof Element
      ? node.closest<HTMLElement>('p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, td, th')
      : null;
  if (!block || !root.contains(block)) return '';
  const v = block.style.textAlign;
  return v === 'start' ? 'left' : v === 'end' ? 'right' : v;
}

// Wrap each block in the fragment in the given tag, keeping style and direction.
function renameBlocks(node: Node, tag: string) {
  for (const child of [...node.childNodes]) {
    if (!/^(?:P|DIV|H[1-6]|BLOCKQUOTE|PRE)$/.test(child.nodeName)) {
      renameBlocks(child, tag);
      continue;
    }
    const src = child as HTMLElement;
    const el = document.createElement(tag);
    for (const attr of ['style', 'dir']) {
      if (src.hasAttribute(attr)) el.setAttribute(attr, src.getAttribute(attr)!);
    }
    el.append(...src.childNodes);
    src.replaceWith(el);
  }
}

function Tb({
  label,
  icon: Icon,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('size-8', active && 'bg-accent text-accent-foreground')}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Button>
  );
}

const Sep = () => <span className="bg-border mx-1 h-5 w-px" aria-hidden />;

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  // Opens the media picker; the editor passes the URL back through `done`.
  onBrowseMedia?: (done: (url: string) => void) => void;
  className?: string;
}

// A Squire editor with a React toolbar. `value` is HTML; changes from outside replace the
// document without echoing back.
export function RichTextEditor({
  value,
  onChange,
  disabled,
  onBrowseMedia,
  className,
}: RichTextEditorProps) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const ed = useRef<Squire | null>(null);
  const muted = useRef(false);
  const changeRef = useRef(onChange);
  const [state, setState] = useState<State>(INITIAL);
  const [words, setWords] = useState(0);
  const [source, setSource] = useState(false);
  const [link, setLink] = useState<LinkInit | null>(null);
  const [image, setImage] = useState<ImageInit | null>(null);

  useEffect(() => {
    changeRef.current = onChange;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const editor = new Squire(el, { blockTag: 'P', sanitizeToDOMFragment });
    el.setAttribute('spellcheck', 'true');
    ed.current = editor;
    muted.current = true;
    editor.setHTML(value);
    muted.current = false;

    const refresh = () => {
      const font = editor.getFontInfo();
      setState((s) => ({
        ...s,
        path: editor.getPath() || '',
        bold: editor.hasFormat('B'),
        italic: editor.hasFormat('I'),
        underline: editor.hasFormat('U'),
        strike: editor.hasFormat('S'),
        sub: editor.hasFormat('SUB'),
        sup: editor.hasFormat('SUP'),
        ul: editor.hasFormat('UL'),
        ol: editor.hasFormat('OL'),
        link: !!closestInSelection(editor, el, 'a[href]'),
        image: !!closestInSelection(editor, el, 'img'),
        color: !!font.color,
        highlight: !!font.backgroundColor,
        align: alignOf(editor, el),
      }));
    };
    const count = () => {
      const text = (el.textContent ?? '').trim();
      setWords(text ? text.split(/\s+/).length : 0);
    };

    editor.addEventListener('input', () => {
      count();
      if (!muted.current) changeRef.current(editor.getHTML());
    });
    editor.addEventListener('pathChange', refresh);
    editor.addEventListener('select', refresh);
    editor.addEventListener('undoStateChange', (e) => {
      const { canUndo, canRedo } = (e as CustomEvent<{ canUndo: boolean; canRedo: boolean }>)
        .detail;
      setState((s) => ({ ...s, canUndo, canRedo }));
    });
    count();

    return () => {
      editor.destroy();
      ed.current = null;
    };
    // The editor is created once; later `value` changes are pushed by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = ed.current;
    if (!editor || value === editor.getHTML()) return;
    muted.current = true;
    editor.setHTML(value);
    muted.current = false;
  }, [value]);

  useEffect(() => {
    host.current?.setAttribute('contenteditable', disabled ? 'false' : 'true');
  }, [disabled]);

  const run = (fn: (e: Squire) => unknown) => {
    const e = ed.current;
    if (!e || disabled) return;
    e.focus();
    fn(e);
  };

  const toggle = (on: keyof Squire, off: keyof Squire, tag: string) =>
    run((e) => (e.hasFormat(tag) ? (e[off] as () => void)() : (e[on] as () => void)()));

  const setBlock = (tag: Block) =>
    run((e) => {
      if (tag === 'BLOCKQUOTE') {
        if (!e.hasFormat('BLOCKQUOTE')) e.increaseQuoteLevel();
      } else if (tag === 'PRE') {
        if (e.hasFormat('PRE')) e.removeCode();
        else e.code();
      } else {
        e.modifyBlocks((frag) => {
          renameBlocks(frag, tag);
          return frag;
        });
      }
    });

  const indent = (dir: 'increase' | 'decrease') =>
    run((e) => {
      const inList = /[OU]L>/.test(e.getPath()) || e.hasFormat('LI');
      e[`${dir}${inList ? 'List' : 'Quote'}Level`]();
    });

  const block = blockFromPath(state.path);
  const blockLabel =
    block === 'P'
      ? t('campaigns.editor.paragraph')
      : block === 'BLOCKQUOTE'
        ? t('campaigns.editor.blockquote')
        : block === 'PRE'
          ? t('campaigns.editor.code')
          : `${t('campaigns.editor.heading')} ${block[1]}`;

  return (
    <div
      className={cn('bg-card flex flex-col overflow-hidden rounded-lg border', className)}
      data-testid="richtext-editor"
    >
      {disabled ? null : (
        <div
          role="toolbar"
          aria-label={t('campaigns.editor.toolbar')}
          className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b p-1"
        >
          <Tb
            label={t('campaigns.editor.undo')}
            icon={Undo2}
            disabled={!state.canUndo}
            onClick={() => run((e) => e.undo())}
          />
          <Tb
            label={t('campaigns.editor.redo')}
            icon={Redo2}
            disabled={!state.canRedo}
            onClick={() => run((e) => e.redo())}
          />
          <Sep />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={t('campaigns.editor.blockFormat')}
                onMouseDown={(e) => e.preventDefault()}
                className="h-8 gap-1 px-2 font-normal"
              >
                {blockLabel}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
              {BLOCKS.map((b) => (
                <DropdownMenuItem key={b} onSelect={() => setBlock(b)}>
                  {b === 'P'
                    ? t('campaigns.editor.paragraph')
                    : b === 'BLOCKQUOTE'
                      ? t('campaigns.editor.blockquote')
                      : b === 'PRE'
                        ? t('campaigns.editor.code')
                        : `${t('campaigns.editor.heading')} ${b[1]}`}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={t('campaigns.editor.fontSize')}
                aria-label={t('campaigns.editor.fontSize')}
                onMouseDown={(e) => e.preventDefault()}
                className="h-8 gap-1 px-2"
              >
                <Type className="size-4" />
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
              {FONT_SIZES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => run((e) => e.setFontSize(s))}>
                  {parseInt(s, 10)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Sep />
          <Tb
            label={t('campaigns.editor.bold')}
            icon={Bold}
            active={state.bold}
            onClick={() => toggle('bold', 'removeBold', 'B')}
          />
          <Tb
            label={t('campaigns.editor.italic')}
            icon={Italic}
            active={state.italic}
            onClick={() => toggle('italic', 'removeItalic', 'I')}
          />
          <Tb
            label={t('campaigns.editor.underline')}
            icon={Underline}
            active={state.underline}
            onClick={() => toggle('underline', 'removeUnderline', 'U')}
          />
          <Tb
            label={t('campaigns.editor.strikethrough')}
            icon={Strikethrough}
            active={state.strike}
            onClick={() => toggle('strikethrough', 'removeStrikethrough', 'S')}
          />
          <Tb
            label={t('campaigns.editor.subscript')}
            icon={Subscript}
            active={state.sub}
            onClick={() => toggle('subscript', 'removeSubscript', 'SUB')}
          />
          <Tb
            label={t('campaigns.editor.superscript')}
            icon={Superscript}
            active={state.sup}
            onClick={() => toggle('superscript', 'removeSuperscript', 'SUP')}
          />
          <ColorButton
            label={t('campaigns.editor.textColor')}
            icon={Baseline}
            active={state.color}
            initial="#000000"
            onPick={(c) => run((e) => e.setTextColor(c))}
          />
          <ColorButton
            label={t('campaigns.editor.highlightColor')}
            icon={Highlighter}
            active={state.highlight}
            initial="#ffff00"
            onPick={(c) => run((e) => e.setHighlightColor(c))}
          />
          <Sep />
          {(
            [
              ['left', AlignLeft, 'alignLeft'],
              ['center', AlignCenter, 'alignCenter'],
              ['right', AlignRight, 'alignRight'],
              ['justify', AlignJustify, 'alignJustify'],
            ] as const
          ).map(([a, icon, key]) => (
            <Tb
              key={a}
              label={t(`campaigns.editor.${key}`)}
              icon={icon}
              active={state.align === a}
              onClick={() => run((e) => e.setTextAlignment(a))}
            />
          ))}
          <Sep />
          <Tb
            label={t('campaigns.editor.bulletList')}
            icon={List}
            active={state.ul}
            onClick={() => toggle('makeUnorderedList', 'removeList', 'UL')}
          />
          <Tb
            label={t('campaigns.editor.numberList')}
            icon={ListOrdered}
            active={state.ol}
            onClick={() => toggle('makeOrderedList', 'removeList', 'OL')}
          />
          <Tb
            label={t('campaigns.editor.outdent')}
            icon={Outdent}
            onClick={() => indent('decrease')}
          />
          <Tb
            label={t('campaigns.editor.indent')}
            icon={Indent}
            onClick={() => indent('increase')}
          />
          <Sep />
          <Tb
            label={t('campaigns.editor.image')}
            icon={ImageIcon}
            active={state.image}
            onClick={() =>
              run((e) =>
                setImage({
                  img: closestInSelection(e, host.current!, 'img') as HTMLImageElement | null,
                }),
              )
            }
          />
          <Tb
            label={t('campaigns.editor.link')}
            icon={Link2}
            active={state.link}
            onClick={() => run((e) => setLink(readLink(e, host.current!)))}
          />
          <TablePopover
            label={t('campaigns.editor.table')}
            onInsert={(r, c) => run((e) => e.insertHTML(tableHtml(r, c)))}
          />
          <Tb
            label={t('campaigns.editor.hr')}
            icon={Minus}
            onClick={() => run((e) => e.insertHTML('<hr>'))}
          />
          <Tb
            label={t('campaigns.editor.removeFormat')}
            icon={RemoveFormatting}
            onClick={() => run((e) => e.removeAllFormatting())}
          />
          <Sep />
          <Tb
            label={t('campaigns.editor.sourceCode')}
            icon={Code}
            active={source}
            onClick={() => setSource((s) => !s)}
          />
        </div>
      )}

      {/* Squire owns this node; it is hidden, not unmounted, in source mode. */}
      <div
        ref={host}
        className={cn('rte-content min-h-[360px] flex-1 p-4 outline-none', source && 'hidden')}
        aria-label={t('campaigns.content')}
        data-testid="richtext-content"
      />
      {source ? (
        <CodeEditor
          value={value}
          lang="html"
          onChange={onChange}
          className="min-h-[360px] flex-1"
          ariaLabel={t('campaigns.editor.sourceCode')}
        />
      ) : null}

      <div className="text-muted-foreground flex justify-between border-t px-3 py-1 text-xs">
        <span className="font-mono">
          {state.path
            .replace(/^(?:P|DIV)>?/, '')
            .replaceAll('>', ' › ')
            .toLowerCase()}
        </span>
        <span>{t.tc('campaigns.editor.words', words).replace('{num}', String(words))}</span>
      </div>

      <LinkDialog init={link} onClose={() => setLink(null)} editor={ed} />
      <ImageDialog
        init={image}
        onClose={() => setImage(null)}
        editor={ed}
        root={host}
        onBrowseMedia={onBrowseMedia}
      />
    </div>
  );
}

function ColorButton({
  label,
  icon: Icon,
  active,
  initial,
  onPick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  initial: string;
  onPick: (color: string) => void;
}) {
  return (
    <label
      title={label}
      className={cn(
        'hover:bg-accent focus-within:ring-ring relative inline-flex size-8 cursor-pointer items-center justify-center rounded-md focus-within:ring-2',
        active && 'bg-accent',
      )}
    >
      <Icon className="size-4" />
      <input
        type="color"
        aria-label={label}
        defaultValue={initial}
        onChange={(e) => onPick(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function TablePopover({
  label,
  onInsert,
}: {
  label: string;
  onInsert: (rows: number, cols: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Tb label={label} icon={Table2} />
      </PopoverTrigger>
      <PopoverContent className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInsert(rows, cols);
            setOpen(false);
          }}
        >
          <Label className="justify-between">
            Rows
            <Input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
              className="w-16"
            />
          </Label>
          <Label className="justify-between">
            Columns
            <Input
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
              className="w-16"
            />
          </Label>
          <Button type="submit" size="sm">
            {label}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// What the link dialog starts from, read from the editor when it is opened.
interface LinkInit {
  anchor: Element | null;
  selected: string;
  url: string;
  text: string;
  title: string;
  track: boolean;
}

function readLink(ed: Squire, root: HTMLElement): LinkInit {
  const anchor = closestInSelection(ed, root, 'a');
  const selected = ed.getSelectedText();
  const href = splitLinkHref(anchor?.getAttribute('href'));
  return {
    anchor,
    selected,
    url: href.url,
    text: anchor ? (anchor.textContent ?? '') : selected,
    title: anchor?.getAttribute('title') ?? '',
    track: anchor ? href.track : localStorage.getItem(TRACK_KEY) === 'true',
  };
}

function LinkDialog({
  init,
  onClose,
  editor,
}: {
  init: LinkInit | null;
  onClose: () => void;
  editor: { current: Squire | null };
}) {
  return (
    <Dialog open={init !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {init ? <LinkForm init={init} onClose={onClose} editor={editor} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function LinkForm({
  init,
  onClose,
  editor,
}: {
  init: LinkInit;
  onClose: () => void;
  editor: { current: Squire | null };
}) {
  const t = useT();
  const [url, setUrl] = useState(init.url);
  const [text, setText] = useState(init.text);
  const [title, setTitle] = useState(init.title);
  const [track, setTrack] = useState(init.track);

  const apply = () => {
    const ed = editor.current;
    onClose();
    if (!ed || !url.trim()) return;
    localStorage.setItem(TRACK_KEY, String(track));
    const href = buildLinkHref(url, track);
    const attrs: Record<string, string> = title.trim() ? { title: title.trim() } : {};
    ed.focus();
    if (init.anchor) {
      const range = document.createRange();
      range.selectNode(init.anchor);
      ed.setSelection(range);
      ed.makeLink(href, attrs);
    } else if (text.trim() && !init.selected) {
      // Nothing selected: insert a new labelled link.
      const el = Object.assign(document.createElement('a'), { textContent: text.trim() });
      el.setAttribute('href', href);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      ed.insertHTML(el.outerHTML);
    } else {
      ed.makeLink(href, attrs);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('campaigns.editor.link')}</DialogTitle>
      </DialogHeader>
      <form
        id="rte-link-form"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          apply();
        }}
      >
        <Field label={t('campaigns.editor.url')}>
          <Input
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
        <Field label={t('campaigns.editor.text')}>
          <Input name="text" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Field label={t('campaigns.editor.title')}>
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Label className="gap-2 font-normal">
          <Checkbox name="track" checked={track} onCheckedChange={(v) => setTrack(v === true)} />
          {t('campaigns.editor.trackLink')}
          <code className="text-muted-foreground text-xs">{TRACK_SUFFIX}</code>
        </Label>
      </form>
      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={!init.anchor}
          onClick={() => {
            editor.current?.focus();
            editor.current?.removeLink();
            onClose();
          }}
        >
          {t('campaigns.editor.removeLink')}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('globals.buttons.cancel')}
          </Button>
          <Button type="submit" form="rte-link-form">
            {t('globals.buttons.save')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

// What the image dialog starts from: the selected <img>, or nothing for a new image.
interface ImageInit {
  img: HTMLImageElement | null;
}

function ImageDialog({
  init,
  onClose,
  editor,
  root,
  onBrowseMedia,
}: {
  init: ImageInit | null;
  onClose: () => void;
  editor: { current: Squire | null };
  root: { current: HTMLDivElement | null };
  onBrowseMedia?: RichTextEditorProps['onBrowseMedia'];
}) {
  return (
    <Dialog open={init !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {init ? (
          <ImageForm
            img={init.img}
            onClose={onClose}
            editor={editor}
            root={root}
            onBrowseMedia={onBrowseMedia}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ImageForm({
  img,
  onClose,
  editor,
  root,
  onBrowseMedia,
}: {
  img: HTMLImageElement | null;
  onClose: () => void;
  editor: { current: Squire | null };
  root: { current: HTMLDivElement | null };
  onBrowseMedia?: RichTextEditorProps['onBrowseMedia'];
}) {
  const t = useT();
  const [src, setSrc] = useState(img?.getAttribute('src') ?? '');
  const [alt, setAlt] = useState(img?.getAttribute('alt') ?? '');
  const [width, setWidth] = useState(img?.getAttribute('width') ?? '');
  const [height, setHeight] = useState(img?.getAttribute('height') ?? '');
  const [float, setFloat] = useState(
    (img && FLOAT_CLASSES.find((c) => img.classList.contains(c))) || '',
  );
  const [embed, setEmbed] = useState(img?.hasAttribute('data-embed') ?? false);

  const apply = () => {
    const ed = editor.current;
    onClose();
    if (!ed || !src.trim()) return;
    const attrs = imageAttrs({ alt, width, height, float, embed });
    ed.focus();
    if (img) {
      ed.saveUndoState();
      img.setAttribute('src', src.trim());
      for (const k of ['alt', 'width', 'height', 'class', 'data-embed']) {
        if (attrs[k]) img.setAttribute(k, attrs[k]);
        else img.removeAttribute(k);
      }
      // Squire does not see direct DOM edits.
      root.current?.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      ed.insertImage(src.trim(), attrs);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('campaigns.editor.image')}</DialogTitle>
      </DialogHeader>
      <form
        id="rte-image-form"
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          apply();
        }}
      >
        <Field label={t('campaigns.editor.url')}>
          <div className="flex gap-2">
            <Input
              name="src"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="https://"
            />
            {onBrowseMedia ? (
              <Button
                type="button"
                variant="outline"
                data-testid="rte-browse"
                onClick={() => onBrowseMedia(setSrc)}
              >
                {t.tc('globals.terms.media', 1)}
              </Button>
            ) : null}
          </div>
        </Field>
        <Field label={t('campaigns.editor.altText')}>
          <Input name="alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('campaigns.editor.width')}>
            <Input name="width" value={width} onChange={(e) => setWidth(e.target.value)} />
          </Field>
          <Field label={t('campaigns.editor.height')}>
            <Input name="height" value={height} onChange={(e) => setHeight(e.target.value)} />
          </Field>
        </div>
        <Field label={t('campaigns.editor.float')}>
          <select
            name="float"
            value={float}
            onChange={(e) => setFloat(e.target.value)}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            <option value="">-</option>
            <option value="img-float-left">{t('campaigns.editor.floatLeft')}</option>
            <option value="img-float-right">{t('campaigns.editor.floatRight')}</option>
          </select>
        </Field>
        <Label className="gap-2 font-normal">
          <Checkbox name="embed" checked={embed} onCheckedChange={(v) => setEmbed(v === true)} />
          {t('campaigns.editor.embed')}
        </Label>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('globals.buttons.cancel')}
        </Button>
        <Button type="submit" form="rte-image-form">
          {t('globals.buttons.save')}
        </Button>
      </DialogFooter>
    </>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);
