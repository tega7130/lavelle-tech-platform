import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { markupToEditableHtml, renderMarkupToReact, markupToPlainTextPreview, isMarkupEmpty } from "@/lib/rich-text";

function renderToHtml(markup: string): string {
  return renderToStaticMarkup(renderMarkupToReact(markup) as never);
}

describe("markupToEditableHtml — markup -> HTML for hydrating the contentEditable", () => {
  it("wraps a plain paragraph in <p>", () => {
    expect(markupToEditableHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("renders bold and italic spans", () => {
    expect(markupToEditableHtml("**bold** and _italic_")).toBe("<p><strong>bold</strong> and <em>italic</em></p>");
  });

  it("renders combined bold+italic", () => {
    expect(markupToEditableHtml("**_both_**")).toBe("<p><strong><em>both</em></strong></p>");
  });

  it("renders a bullet list as <ul><li>", () => {
    expect(markupToEditableHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a numbered list as <ol><li>", () => {
    expect(markupToEditableHtml("1. one\n1. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("separates blocks with a blank line into distinct paragraphs", () => {
    expect(markupToEditableHtml("First\n\nSecond")).toBe("<p>First</p><p>Second</p>");
  });

  it("escapes HTML-significant characters in text runs", () => {
    expect(markupToEditableHtml("<script>alert(1)</script> & more")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; more</p>"
    );
  });

  it("unescapes a literal asterisk/underscore the candidate typed", () => {
    expect(markupToEditableHtml("5 \\* 3 = 15 and snake\\_case")).toBe("<p>5 * 3 = 15 and snake_case</p>");
  });

  it("empty markup still yields a focusable paragraph", () => {
    expect(markupToEditableHtml("")).toBe("<p><br></p>");
  });
});

describe("renderMarkupToReact — markup -> read-only React, no dangerouslySetInnerHTML anywhere", () => {
  it("renders plain text as-is", () => {
    expect(renderToHtml("Hello world")).toBe("<p>Hello world</p>");
  });

  it("renders bold/italic structurally, matching markupToEditableHtml", () => {
    expect(renderToHtml("**bold** and _italic_")).toBe("<p><strong>bold</strong> and <em>italic</em></p>");
  });

  it("renders lists structurally", () => {
    expect(renderToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("a candidate typing literal HTML never becomes a live element — it renders as inert text", () => {
    const html = renderToHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("returns null for empty markup", () => {
    expect(renderMarkupToReact("")).toBeNull();
  });
});

describe("markupToPlainTextPreview — Notes list snippet", () => {
  it("strips bold/italic markers and list bullets down to plain text", () => {
    expect(markupToPlainTextPreview("**Remember**: _always_ check\n\n- one\n- two")).toBe("Remember: always check one two");
  });

  it("truncates beyond maxLength with an ellipsis", () => {
    const long = "word ".repeat(50).trim();
    const preview = markupToPlainTextPreview(long, 20);
    expect(preview.length).toBeLessThanOrEqual(21);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("does not truncate short text", () => {
    expect(markupToPlainTextPreview("short note", 140)).toBe("short note");
  });
});

describe("isMarkupEmpty", () => {
  it("is true for an empty string", () => {
    expect(isMarkupEmpty("")).toBe(true);
  });

  it("is true for whitespace-only markup", () => {
    expect(isMarkupEmpty("   \n\n  ")).toBe(true);
  });

  it("is false once there is real content", () => {
    expect(isMarkupEmpty("a")).toBe(false);
  });
});
