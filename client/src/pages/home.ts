import { api } from "../api.js";
import { state } from "../state.js";
import { navigate } from "../router.js";

export async function homePage(): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.className = "page page-home";

  const [stats, decks] = await Promise.all([
    api.stats.today(),
    api.decks.list(),
  ]);

  state.streakDays = stats.streakDays;
  state.xpToday = stats.xpEarned;
  state.cardsToday = stats.cardsReviewed;

  // streak display
  const streakSection = document.createElement("div");
  streakSection.className = "streak-section";
  streakSection.innerHTML = `
    <div class="streak-flame">${stats.streakDays > 0 ? "&#128293;" : "&#9898;"}</div>
    <div class="streak-count">${stats.streakDays}</div>
    <div class="streak-label">day streak</div>
    <div class="xp-today">${stats.xpEarned} XP today</div>
  `;
  page.appendChild(streakSection);

  // today's summary
  const summarySection = document.createElement("div");
  summarySection.className = "today-summary";
  summarySection.innerHTML = `
    <h2>Today</h2>
    <div class="summary-stats">
      <div class="stat-card">
        <div class="stat-value">${stats.cardsReviewed}</div>
        <div class="stat-label">reviewed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalReviewsToday}</div>
        <div class="stat-label">total reviews</div>
      </div>
    </div>
  `;
  page.appendChild(summarySection);

  // deck quick-access
  if (decks.length > 0) {
    const deckSection = document.createElement("div");
    deckSection.className = "deck-quick-list";
    deckSection.innerHTML = "<h2>Decks</h2>";

    for (const deck of decks) {
      const card = document.createElement("div");
      card.className = "deck-quick-card";
      const dueTotal = deck.counts.dueCount + deck.counts.newCount;
      card.innerHTML = `
        <div class="deck-name">${deck.name}</div>
        <div class="deck-due">${dueTotal > 0 ? `${dueTotal} due` : "all caught up"}</div>
      `;
      card.addEventListener("click", () => {
        if (dueTotal > 0) navigate(`/study/${deck.id}`);
        else navigate(`/decks/${deck.id}`);
      });
      deckSection.appendChild(card);
    }
    page.appendChild(deckSection);
  } else {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <p>No decks yet.</p>
      <button class="btn-primary" onclick="location.hash='#/import'">Import a deck</button>
    `;
    page.appendChild(empty);
  }

  return page;
}
