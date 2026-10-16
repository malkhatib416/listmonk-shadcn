import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { EditorState, type Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { editorExtensions } from './editor-theme';

const LANGS: Record<string, () => Extension> = { html, css, javascript, markdown };

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  lang?: keyof typeof LANGS;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

// A CodeMirror 6 editor. `value` is controlled: edits call onChange, outside changes
// replace the document (without echoing back).
export function CodeEditor({
  value,
  onChange,
  lang = 'html',
  disabled,
  className,
  ariaLabel,
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          (LANGS[lang] ?? html)(),
          history(),
          highlightActiveLine(),
          bracketMatching(),
          highlightSelectionMatches(),
          lineNumbers(),
          highlightActiveLineGutter(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          EditorState.readOnly.of(!!disabled),
          EditorView.editable.of(!disabled),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          EditorView.lineWrapping,
          editorExtensions,
          search({ top: true }),
          EditorView.contentAttributes.of(ariaLabel ? { 'aria-label': ariaLabel } : {}),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is rebuilt only when the language or read-only state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, disabled, ariaLabel]);

  // An outside change (loading a record, a content-type conversion) replaces the document.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={host}
      className={cn(
        'bg-card overflow-hidden rounded-lg border text-sm [&_.cm-editor]:min-h-64 [&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:ring-2 [&_.cm-editor.cm-focused]:ring-ring/40',
        className,
      )}
      data-testid="code-editor"
    />
  );
}
