import { api } from "../api.js";
import { navigate } from "../router.js";

export async function deckListPage(): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.className = "page page-decks";
  page.innerHTML = "<h1>Decks</h1>";

  const decks = await api.decks.list();

  if (decks.length === 0) {
    page.innerHTML += `
      <div class="empty-state">
        <p>No decks imported yet.</p>
        <button class="btn-primary" onclick="location.hash='#/import'">Import</button>
      </div>
    `;
    return page;
  }

  const list = document.createElement("div");
  list.className = "deck-list";

  for (const deck of decks) {
    const el = document.createElement("div");
    el.className = "deck-card";

    const { newCount, dueCount, totalCount } = deck.counts;

    el.innerHTML = `
      <div class="deck-card-header">
        <h3>${deck.name}</h3>
        <span class="deck-total">${totalCount} cards</span>
      </div>
      <div class="deck-card-counts">
        <span class="count-new">${newCount} new</span>
        <span class="count-due">${dueCount} due</span>
      </div>
      <div class="deck-card-actions">
        <button class="btn-primary btn-study" ${newCount + dueCount === 0 ? "disabled" : ""}>Study</button>
      </div>
    `;

    el.querySelector(".btn-study")?.addEventListener("click", (e) => {
      e.stopPropagation();
      navigate(`/study/${deck.id}`);
    });

    el.addEventListener("click", () => navigate(`/decks/${deck.id}`));
    list.appendChild(el);
  }

  page.appendChild(list);
  return page;
}

export async function deckDetailPage(params: Record<string, string>): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.className = "page page-deck-detail";

  const deck = await api.decks.get(Number(params.id));
  const { newCount, dueCount, totalCount } = deck.counts;

  page.innerHTML = `
    <button class="btn-back" onclick="location.hash='#/decks'">&larr; Back</button>
    <h1>${deck.name}</h1>
    <p class="deck-description">${deck.description || ""}</p>
    <div class="deck-detail-stats">
      <div class="stat-card"><div class="stat-value">${totalCount}</div><div class="stat-label">total</div></div>
      <div class="stat-card"><div class="stat-value">${newCount}</div><div class="stat-label">new</div></div>
      <div class="stat-card"><div class="stat-value">${dueCount}</div><div class="stat-label">due</div></div>
    </div>
    <div class="deck-detail-actions">
      <button class="btn-primary btn-study-lg" ${newCount + dueCount === 0 ? "disabled" : ""}>Study Now</button>
    </div>
    <div class="deck-meta">
      <small>Source: ${deck.source} | Imported: ${new Date(deck.created_at).toLocaleDateString()}</small>
    </div>
  `;

  page.querySelector(".btn-study-lg")?.addEventListener("click", () => {
    navigate(`/study/${deck.id}`);
  });

  return page;
}
