import * as React from "react";

/**
 * A small, constrained plain-text markup format for candidate lecture
 * notes — never HTML. This is the entire security boundary for the
 * feature (see LectureNote's schema comment): nothing downstream of
 * storage ever interprets this string as markup that can carry an
 * element or attribute, only bold/italic/list structure and literal
 * text, so there is nothing here for a sanitizer to need to strip.
 *
 * Format:
 *  - Blocks are separated by a blank line ("\n\n").
 *  - A block is a LIST block if every one of its non-empty lines starts
 *    with "- " (bullet) or "<digits>. " (numbered) — otherwise it's a
 *    paragraph block, whose lines are soft line breaks within it.
 *  - Inline marks within a line: **bold**, _italic_ (bold+italic nests
 *    either order). A literal "*", "_" or "\" typed by the candidate is
 *    escaped to "\*", "\_", "\\" by escapeMarkupText before it's placed
 *    in a line — every literal char written by serializeEditableDom goes
 *    through that function first, so any UNESCAPED "*"/"_" surviving in
 *    stored markup is unambiguously one of these markers, never
 *    candidate-typed text (this is what makes the inline parser
 *    unambiguous without a real markdown grammar).
 */

const BOLD_ITALIC_TAGS = { bold: new Set(["B", "STRONG"]), italic: new Set(["I", "EM"]) };

function escapeMarkupText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_");
}

/** DOM walk — reads only tagName/textContent per node, never innerHTML, so pasted HTML can only ever contribute its visible text. Client-only (needs a live HTMLElement). */
export function serializeEditableDom(root: HTMLElement): string {
  function serializeInline(node: ChildNode, bold: boolean, italic: boolean): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeMarkupText(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    if (el.tagName === "BR") return "\n";
    const nextBold = bold || BOLD_ITALIC_TAGS.bold.has(el.tagName);
    const nextItalic = italic || BOLD_ITALIC_TAGS.italic.has(el.tagName);
    let inner = "";
    for (const child of Array.from(el.childNodes)) inner += serializeInline(child, nextBold, nextItalic);
    if (!inner) return "";
    if (nextBold && nextItalic) return `**_${inner}_**`;
    if (nextBold) return `**${inner}**`;
    if (nextItalic) return `_${inner}_`;
    return inner;
  }

  function lineFromListItem(li: HTMLElement, marker: string): string {
    let text = "";
    for (const child of Array.from(li.childNodes)) text += serializeInline(child, false, false);
    // Only return a line if there's actual text — empty list items are discarded
    return text.length > 0 ? `${marker}${text}` : "";
  }

  const blocks: string[] = [];
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = escapeMarkupText(node.textContent ?? "").trim();
      if (text) blocks.push(text);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    if (el.tagName === "UL" || el.tagName === "OL") {
      const marker = el.tagName === "UL" ? "- " : "1. ";
      const lines = Array.from(el.children)
        .filter((c) => c.tagName === "LI")
        .map((li) => lineFromListItem(li as HTMLElement, marker))
        .filter((line) => line.length > 0); // Skip empty list items
      if (lines.length) blocks.push(lines.join("\n"));
      continue;
    }
    if (el.tagName === "BR") continue; // stray top-level break between blocks — the blank-line separator already carries that
    let text = "";
    for (const child of Array.from(el.childNodes)) text += serializeInline(child, false, false);
    text = text.trim();
    if (text) blocks.push(text);
  }
  return blocks.join("\n\n");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isListBlock(block: string): "ul" | "ol" | null {
  const lines = block.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return null;
  if (lines.every((l) => l.startsWith("- "))) return "ul";
  if (lines.every((l) => /^\d+\.\s/.test(l))) return "ol";
  return null;
}

function stripListMarker(line: string, kind: "ul" | "ol"): string {
  return kind === "ul" ? line.slice(2) : line.replace(/^\d+\.\s/, "");
}

/** Inline markup -> a small span-tree, shared by markupToEditableHtml and renderMarkupToReact so both stay in lockstep. */
type InlineSpan = { text: string; bold: boolean; italic: boolean };

function parseInline(line: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let buf = "";
  let bold = false;
  let italic = false;
  let i = 0;

  function flush() {
    if (buf !== "") spans.push({ text: buf, bold, italic });
    buf = "";
  }

  while (i < line.length) {
    const ch = line[i];
    if (ch === "\\" && i + 1 < line.length && "*_\\".includes(line[i + 1]!)) {
      buf += line[i + 1];
      i += 2;
      continue;
    }
    if (ch === "*" && line[i + 1] === "*") {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (ch === "_") {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  flush();
  return spans;
}

/** markup -> HTML string, for hydrating the contentEditable on load. Every text run passed through escapeHtml — this is the only place markup is ever turned into HTML. */
export function markupToEditableHtml(markup: string): string {
  const blocks = markup.split(/\n{2,}/).filter((b) => b.length > 0);
  if (blocks.length === 0) return "<p><br></p>";

  return blocks
    .map((block) => {
      const listKind = isListBlock(block);
      if (listKind) {
        const items = block
          .split("\n")
          .filter((l) => l.length > 0)
          .map((line) => spansToHtml(parseInline(stripListMarker(line, listKind))))
          .map((html) => `<li>${html}</li>`)
          .join("");
        return listKind === "ul" ? `<ul>${items}</ul>` : `<ol>${items}</ol>`;
      }
      const lines = block.split("\n");
      const html = lines.map((line) => spansToHtml(parseInline(line))).join("<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}

function spansToHtml(spans: InlineSpan[]): string {
  return spans
    .map((s) => {
      let html = escapeHtml(s.text);
      if (s.italic) html = `<em>${html}</em>`;
      if (s.bold) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

let reactKeySeq = 0;
function spansToReact(spans: InlineSpan[]): React.ReactNode[] {
  return spans.map((s) => {
    let node: React.ReactNode = s.text;
    if (s.italic) node = React.createElement("em", { key: `i-${reactKeySeq++}` }, node);
    if (s.bold) node = React.createElement("strong", { key: `b-${reactKeySeq++}` }, node);
    return React.createElement(React.Fragment, { key: `s-${reactKeySeq++}` }, node);
  });
}

/** markup -> read-only React elements (Notes list, saved-note preview). Never dangerouslySetInnerHTML — text always flows through as React children, which React escapes on its own. */
export function renderMarkupToReact(markup: string): React.ReactNode {
  const blocks = markup.split(/\n{2,}/).filter((b) => b.length > 0);
  if (blocks.length === 0) return null;

  return React.createElement(
    React.Fragment,
    null,
    blocks.map((block, blockIndex) => {
      const listKind = isListBlock(block);
      if (listKind) {
        const items = block
          .split("\n")
          .filter((l) => l.length > 0)
          .map((line, lineIndex) =>
            React.createElement("li", { key: lineIndex }, spansToReact(parseInline(stripListMarker(line, listKind))))
          );
        return React.createElement(listKind === "ul" ? "ul" : "ol", { key: blockIndex }, items);
      }
      const lines = block.split("\n");
      const content: React.ReactNode[] = [];
      lines.forEach((line, i) => {
        if (i > 0) content.push(React.createElement("br", { key: `br-${i}` }));
        content.push(...spansToReact(parseInline(line)));
      });
      return React.createElement("p", { key: blockIndex }, content);
    })
  );
}

/** Plain-text preview for the Notes list — strips markers and list bullets, collapses to a single line, truncated. */
export function markupToPlainTextPreview(markup: string, maxLength = 140): string {
  const blocks = markup.split(/\n{2,}/).filter((b) => b.length > 0);
  const plain = blocks
    .map((block) => {
      const listKind = isListBlock(block);
      const lines = block.split("\n").filter((l) => l.length > 0);
      return lines
        .map((line) => {
          const stripped = listKind ? stripListMarker(line, listKind) : line;
          return parseInline(stripped)
            .map((s) => s.text)
            .join("");
        })
        .join(" ");
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}…` : plain;
}

export function isMarkupEmpty(markup: string): boolean {
  return markupToPlainTextPreview(markup, 1).length === 0;
}
