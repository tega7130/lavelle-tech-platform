"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { serializeEditableDom, markupToEditableHtml } from "@/lib/rich-text";

const TOOLBAR_ITEMS: { command: string; label: string; glyph: string; glyphClassName?: string }[] = [
  { command: "bold", label: "Bold", glyph: "B", glyphClassName: "font-bold" },
  { command: "italic", label: "Italic", glyph: "I", glyphClassName: "italic" },
  { command: "insertUnorderedList", label: "Bullets", glyph: "•" },
  { command: "insertOrderedList", label: "Numbered", glyph: "1." },
];

export interface RichTextEditorProps {
  /** Initial content only — this is an uncontrolled editor (contentEditable has no native controlled primitive). Callers switching context (e.g. a different lecture) should remount via a `key`. */
  value?: string;
  onChange: (markup: string) => void;
  placeholder?: string;
  className?: string;
  minHeightPx?: number;
}

/**
 * A small WYSIWYG editor (Bold/Italic/Bullet/Numbered) backed by
 * contentEditable + document.execCommand — the standard lightweight
 * approach for this without pulling in an editor framework. What the
 * candidate sees while typing IS the formatted text; what actually gets
 * stored is a constrained markup string (src/lib/rich-text.ts) derived by
 * walking the DOM and reading only tagName/textContent, never innerHTML —
 * see that file's header comment for why that's the entire security
 * story for this feature.
 */
export function RichTextEditor({ value, onChange, placeholder, className, minHeightPx = 96 }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = React.useState(!value);
  const [activeCommands, setActiveCommands] = React.useState<Record<string, boolean>>({});

  // Hydrate once on mount only — this is the uncontrolled half of the
  // contentEditable workaround described above. Remount (key by lectureId
  // in the caller) is how a genuinely new value gets loaded.
  React.useEffect(() => {
    if (ref.current) ref.current.innerHTML = markupToEditableHtml(value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflects the caret's current formatting on each toolbar button — so
  // typing inside bold text shows "Bold" pressed, and clicking it again
  // (execCommand toggles natively) turns both the formatting and the
  // indicator off. selectionchange is the only event that fires for a
  // caret move with no visible DOM mutation (e.g. arrowing out of bold
  // text), so it's the source of truth; mouseup/keyup on the editor just
  // catch the common cases sooner without waiting for that event to settle.
  const updateActiveStates = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    if (!anchor || !el.contains(anchor)) return;
    setActiveCommands({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    });
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", updateActiveStates);
    return () => document.removeEventListener("selectionchange", updateActiveStates);
  }, [updateActiveStates]);

  function emitChange() {
    if (!ref.current) return;
    const markup = serializeEditableDom(ref.current);
    setEmpty(markup.trim().length === 0);
    onChange(markup);
  }

  function runCommand(command: string) {
    return (e: React.MouseEvent) => {
      // preventDefault on mousedown, not click — click fires after the
      // contentEditable div has already lost focus/selection to the
      // toolbar button, which is too late for execCommand to know what
      // to apply the command to.
      e.preventDefault();
      ref.current?.focus();
      document.execCommand(command);
      emitChange();
      updateActiveStates();
    };
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Force plain text — a paste from Word/Google Docs otherwise carries
    // its own styling into the editor, and there is no path back from
    // that into our constrained markup vocabulary anyway (only
    // bold/italic/list survive serialization), so the pasted content
    // would visually lie about what's actually going to be saved.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emitChange();
    updateActiveStates();
  }

  return (
    <div className={cn("rounded-md border border-neutral-300 bg-bg", className)}>
      <div className="flex items-center gap-1 border-b border-neutral-200 px-2 py-1.5">
        {TOOLBAR_ITEMS.map((item, i) => {
          const isActive = !!activeCommands[item.command];
          return (
            <React.Fragment key={item.command}>
              {i === 2 && <div className="mx-1 h-4 w-px bg-neutral-200" />}
              <button
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
                onMouseDown={runCommand(item.command)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded px-2 text-[12px] hover:bg-neutral-100 active:bg-neutral-200",
                  isActive ? "bg-accent-100 text-accent-900" : "text-neutral-700"
                )}
              >
                <span aria-hidden="true" className={cn("text-[13px] font-semibold", item.glyphClassName)}>
                  {item.glyph}
                </span>
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <div className="relative">
        {empty && placeholder && (
          <div className="pointer-events-none absolute top-2 left-3 text-sm text-neutral-500">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emitChange}
          onPaste={handlePaste}
          onKeyUp={updateActiveStates}
          onMouseUp={updateActiveStates}
          onFocus={updateActiveStates}
          className="w-full box-border font-body text-sm text-text outline-none px-3 py-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          style={{ minHeight: minHeightPx }}
        />
      </div>
    </div>
  );
}
