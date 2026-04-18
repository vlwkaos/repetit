import { describe, it, expect } from "bun:test";
import { htmlToText, hasCloze, renderCloze, clozeOrdinals } from "../../src/importers/anki-utils.js";

describe("htmlToText", () => {
  it("strips tags", () => {
    expect(htmlToText("<b>bold</b> and <i>italic</i>")).toBe("bold and italic");
  });

  it("converts <br> to newline", () => {
    expect(htmlToText("line1<br>line2")).toBe("line1\nline2");
    expect(htmlToText("line1<br/>line2")).toBe("line1\nline2");
  });

  it("decodes named entities", () => {
    expect(htmlToText("&amp;&lt;&gt;&quot;&#39;")).toBe('&<>"\'');
    expect(htmlToText("a&nbsp;b")).toBe("a b");
  });

  it("decodes numeric entities", () => {
    expect(htmlToText("&#65;&#x42;")).toBe("AB");
  });

  it("preserves unknown entities", () => {
    expect(htmlToText("&unknown;")).toBe("&unknown;");
  });

  it("strips pre/code tags, keeps text", () => {
    expect(htmlToText("<pre><code>int x = 1;</code></pre>")).toBe("int x = 1;");
  });

  it("trims result", () => {
    expect(htmlToText("  <b>hi</b>  ")).toBe("hi");
  });
});

describe("hasCloze", () => {
  it("detects cloze syntax", () => {
    expect(hasCloze("The capital is {{c1::Paris}}.")).toBe(true);
    expect(hasCloze("No cloze here.")).toBe(false);
  });
});

describe("clozeOrdinals", () => {
  it("returns sorted unique ordinals", () => {
    expect(clozeOrdinals("{{c2::B}} and {{c1::A}} and {{c2::again}}")).toEqual([1, 2]);
  });

  it("returns empty for no cloze", () => {
    expect(clozeOrdinals("plain text")).toEqual([]);
  });
});

describe("renderCloze", () => {
  it("hides active cloze with [...]", () => {
    const { front } = renderCloze("The answer is {{c1::Paris}}.", 1);
    expect(front).toBe("The answer is [...].");
  });

  it("shows hint when present", () => {
    const { front } = renderCloze("{{c1::Paris::capital}}", 1);
    expect(front).toBe("[capital]");
  });

  it("reveals answer on back", () => {
    const { back } = renderCloze("The answer is {{c1::Paris}}.", 1);
    expect(back).toBe("The answer is Paris.");
  });

  it("reveals other clozes on front", () => {
    const { front } = renderCloze("{{c1::A}} and {{c2::B}}", 1);
    expect(front).toBe("[...] and B");
  });

  it("all clozes revealed on back", () => {
    const { back } = renderCloze("{{c1::A}} and {{c2::B}}", 1);
    expect(back).toBe("A and B");
  });

  it("strips HTML in result", () => {
    const { front } = renderCloze("<b>{{c1::answer}}</b>", 1);
    expect(front).toBe("[...]");
  });
});
