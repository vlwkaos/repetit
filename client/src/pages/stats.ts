import { api } from "../api.js";

export async function statsPage(): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.className = "page page-stats";
  page.innerHTML = "<h1>Statistics</h1>";

  const [today, heatmap] = await Promise.all([
    api.stats.today(),
    api.stats.heatmap(),
  ]);

  // today's stats
  const todaySection = document.createElement("div");
  todaySection.className = "stats-today";
  todaySection.innerHTML = `
    <h2>Today</h2>
    <div class="summary-stats">
      <div class="stat-card"><div class="stat-value">${today.cardsReviewed}</div><div class="stat-label">cards</div></div>
      <div class="stat-card"><div class="stat-value">${today.xpEarned}</div><div class="stat-label">XP</div></div>
      <div class="stat-card"><div class="stat-value">${today.streakDays}</div><div class="stat-label">streak</div></div>
    </div>
  `;
  page.appendChild(todaySection);

  // heatmap
  const heatmapSection = document.createElement("div");
  heatmapSection.className = "stats-heatmap";
  heatmapSection.innerHTML = "<h2>Activity</h2>";

  const heatmapGrid = createHeatmap(heatmap);
  heatmapSection.appendChild(heatmapGrid);
  page.appendChild(heatmapSection);

  return page;
}

function createHeatmap(data: any[]): HTMLElement {
  const container = document.createElement("div");
  container.className = "heatmap";

  // build date->count lookup
  const countMap = new Map<string, number>();
  for (const row of data) {
    countMap.set(row.date, row.cards_reviewed);
  }

  // generate 365 days of cells
  const today = new Date();
  const grid = document.createElement("div");
  grid.className = "heatmap-grid";

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = countMap.get(dateStr) ?? 0;

    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.dataset.date = dateStr;
    cell.dataset.count = String(count);
    cell.title = `${dateStr}: ${count} cards`;

    // intensity levels
    if (count === 0) cell.classList.add("level-0");
    else if (count < 10) cell.classList.add("level-1");
    else if (count < 25) cell.classList.add("level-2");
    else if (count < 50) cell.classList.add("level-3");
    else cell.classList.add("level-4");

    grid.appendChild(cell);
  }

  container.appendChild(grid);
  return container;
}
