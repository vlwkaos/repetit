export function renderCard(html: string, deckId: number): HTMLElement {
  const el = document.createElement("div");
  el.className = "card-content";

  // rewrite media paths and handle [sound:] tags
  let processed = html.replace(
    /\[sound:([^\]]+)\]/g,
    (_, file) => `<button class="audio-btn" data-src="/media/${deckId}/${file}">&#9654; Play</button>`,
  );
  processed = processed.replace(
    /src="([^"]+)"/g,
    (match, src) => {
      if (src.startsWith("http") || src.startsWith("/")) return match;
      return `src="/media/${deckId}/${src}"`;
    },
  );

  el.innerHTML = processed;

  // attach audio button handlers
  el.querySelectorAll<HTMLButtonElement>(".audio-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const audio = new Audio(btn.dataset.src!);
      audio.play();
    });
  });

  return el;
}

export function renderCloze(html: string, deckId: number, showAnswer: boolean): HTMLElement {
  let processed = html;
  if (!showAnswer) {
    // hide cloze content: {{c1::answer}} -> [...]
    processed = processed.replace(/\{\{c\d+::([^}]+)\}\}/g, '<span class="cloze-blank">[...]</span>');
  } else {
    // reveal cloze: {{c1::answer}} -> <b>answer</b>
    processed = processed.replace(/\{\{c\d+::([^}]+)\}\}/g, '<span class="cloze-reveal">$1</span>');
  }
  return renderCard(processed, deckId);
}
