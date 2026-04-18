/** HTML entity map for common named + numeric entities */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ",
  apos: "'", ndash: "–", mdash: "—", hellip: "…", bull: "•",
};

/**
 * Convert Anki HTML field content to plain text for terminal display.
 * Preserves <br> as newlines; strips all other tags; decodes HTML entities.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (_, ref: string) => {
      if (ref.startsWith("#x")) return String.fromCodePoint(parseInt(ref.slice(2), 16));
      if (ref.startsWith("#"))  return String.fromCodePoint(parseInt(ref.slice(1), 10));
      return ENTITIES[ref] ?? `&${ref};`;
    })
    .trim();
}

/**
 * Detect if the HTML contains Anki cloze syntax ({{c1::...}}).
 */
export function hasCloze(html: string): boolean {
  return /\{\{c\d+::/.test(html);
}

/**
 * Render a cloze template for a specific cloze ordinal.
 * - Active cloze (cN where N === ord): replaced with "[...]" on front, revealed on back
 * - Other clozes: text revealed on both sides
 *
 * Returns { front, back } plain-text strings.
 */
export function renderCloze(html: string, ord: number): { front: string; back: string } {
  // {{cN::answer}} or {{cN::answer::hint}}
  const CLOZE_RE = /\{\{c(\d+)::([^:}]+?)(?:::([^}]+?))?\}\}/g;

  const front = html.replace(CLOZE_RE, (_, n, answer, hint) =>
    Number(n) === ord ? (hint ? `[${hint}]` : "[...]") : answer,
  );
  const back = html.replace(CLOZE_RE, (_, _n, answer) => answer);

  return { front: htmlToText(front), back: htmlToText(back) };
}

/**
 * Extract all cloze ordinals from an HTML string (e.g. {{c1::...}} {{c2::...}} → [1, 2]).
 */
export function clozeOrdinals(html: string): number[] {
  const ords = new Set<number>();
  for (const m of html.matchAll(/\{\{c(\d+)::/g)) ords.add(Number(m[1]));
  return [...ords].sort((a, b) => a - b);
}
