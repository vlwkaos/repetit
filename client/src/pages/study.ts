import { api } from "../api.js";
import { navigate } from "../router.js";
import { renderCard, renderCloze } from "../components/card-renderer.js";
import { createRatingButtons } from "../components/rating-buttons.js";

interface StudySession {
  cards: any[];
  current: number;
  startTime: number;
  cardStartTime: number;
  results: Array<{ cardId: number; rating: number; elapsedMs: number }>;
  revealed: boolean;
}

export async function studyPage(params: Record<string, string>): Promise<HTMLElement> {
  const deckId = Number(params.deckId);
  const page = document.createElement("div");
  page.className = "page page-study";

  const queue = await api.study.queue(deckId);

  if (queue.cards.length === 0) {
    page.innerHTML = `
      <div class="study-done">
        <div class="study-done-icon">&#10003;</div>
        <h2>All caught up!</h2>
        <p>No cards due right now.</p>
        <button class="btn-primary" onclick="location.hash='#/'">Home</button>
      </div>
    `;
    return page;
  }

  const session: StudySession = {
    cards: queue.cards,
    current: 0,
    startTime: Date.now(),
    cardStartTime: Date.now(),
    results: [],
    revealed: false,
  };

  // progress bar
  const progressBar = document.createElement("div");
  progressBar.className = "study-progress";
  progressBar.innerHTML = `
    <div class="progress-bar"><div class="progress-fill"></div></div>
    <div class="progress-text">0 / ${session.cards.length}</div>
  `;
  page.appendChild(progressBar);

  // card container
  const cardContainer = document.createElement("div");
  cardContainer.className = "study-card-container";
  page.appendChild(cardContainer);

  // rating area (hidden until revealed)
  const ratingArea = document.createElement("div");
  ratingArea.className = "study-rating-area hidden";
  page.appendChild(ratingArea);

  function updateProgress() {
    const fill = progressBar.querySelector(".progress-fill") as HTMLElement;
    const text = progressBar.querySelector(".progress-text") as HTMLElement;
    const pct = (session.current / session.cards.length) * 100;
    fill.style.width = `${pct}%`;
    text.textContent = `${session.current} / ${session.cards.length}`;
  }

  function showCard() {
    const card = session.cards[session.current];
    session.cardStartTime = Date.now();
    session.revealed = false;

    cardContainer.innerHTML = "";
    ratingArea.classList.add("hidden");

    const cardEl = document.createElement("div");
    cardEl.className = "study-card";

    // card type badge
    const badge = document.createElement("div");
    badge.className = `card-type-badge badge-${card.type}`;
    badge.textContent = card.type;
    cardEl.appendChild(badge);

    // front content
    const frontEl = card.type === "cloze"
      ? renderCloze(card.front, deckId, false)
      : renderCard(card.front, deckId);
    frontEl.className += " card-front";
    cardEl.appendChild(frontEl);

    // back content (hidden)
    const backEl = card.type === "cloze"
      ? renderCloze(card.front, deckId, true)
      : renderCard(card.back, deckId);
    backEl.className += " card-back hidden";
    cardEl.appendChild(backEl);

    // tap to reveal
    const tapHint = document.createElement("div");
    tapHint.className = "tap-hint";
    tapHint.textContent = "Tap to reveal";
    cardEl.appendChild(tapHint);

    cardEl.addEventListener("click", () => {
      if (session.revealed) return;
      session.revealed = true;
      backEl.classList.remove("hidden");
      tapHint.classList.add("hidden");
      cardEl.classList.add("revealed");
      ratingArea.classList.remove("hidden");
    });

    cardContainer.appendChild(cardEl);
  }

  async function onRate(rating: number) {
    const card = session.cards[session.current];
    const elapsedMs = Date.now() - session.cardStartTime;

    session.results.push({ cardId: card.id, rating, elapsedMs });

    // submit to server (don't block UI)
    api.study.review(card.id, rating, elapsedMs).catch(console.error);

    session.current++;
    updateProgress();

    if (session.current >= session.cards.length) {
      showSummary();
    } else {
      showCard();
    }
  }

  function showSummary() {
    const totalTime = Date.now() - session.startTime;
    const avgTime = totalTime / session.results.length;

    const again = session.results.filter((r) => r.rating === 1).length;
    const hard = session.results.filter((r) => r.rating === 2).length;
    const good = session.results.filter((r) => r.rating === 3).length;
    const easy = session.results.filter((r) => r.rating === 4).length;

    page.innerHTML = "";
    page.innerHTML = `
      <div class="study-summary">
        <h2>Session Complete</h2>
        <div class="summary-stats">
          <div class="stat-card"><div class="stat-value">${session.results.length}</div><div class="stat-label">cards</div></div>
          <div class="stat-card"><div class="stat-value">${Math.round(totalTime / 1000)}s</div><div class="stat-label">total time</div></div>
          <div class="stat-card"><div class="stat-value">${Math.round(avgTime / 1000)}s</div><div class="stat-label">avg/card</div></div>
        </div>
        <div class="rating-breakdown">
          <div class="rating-bar rating-again"><span class="rating-label">Again</span><span class="rating-count">${again}</span></div>
          <div class="rating-bar rating-hard"><span class="rating-label">Hard</span><span class="rating-count">${hard}</span></div>
          <div class="rating-bar rating-good"><span class="rating-label">Good</span><span class="rating-count">${good}</span></div>
          <div class="rating-bar rating-easy"><span class="rating-label">Easy</span><span class="rating-count">${easy}</span></div>
        </div>
        <div class="summary-actions">
          <button class="btn-primary" id="btn-home">Home</button>
        </div>
      </div>
    `;
    page.querySelector("#btn-home")?.addEventListener("click", () => navigate("/"));
  }

  // rating buttons
  ratingArea.appendChild(createRatingButtons(onRate));

  // start
  updateProgress();
  showCard();

  return page;
}
