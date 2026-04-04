import { api } from "../api.js";
import { navigate } from "../router.js";
import { showToast } from "../components/toast.js";

export function importPage(): HTMLElement {
  const page = document.createElement("div");
  page.className = "page page-import";

  page.innerHTML = `
    <h1>Import Deck</h1>

    <div class="import-section">
      <h2>From Markdown (anki-create)</h2>
      <p>Enter the path to a manifest.json file.</p>
      <div class="import-form">
        <input type="text" id="md-path" class="input" placeholder="/path/to/deck/manifest.json" />
        <button class="btn-primary" id="btn-import-md">Import</button>
      </div>
    </div>

    <div class="import-section">
      <h2>From .apkg File</h2>
      <p>Upload an Anki package file.</p>
      <div class="import-form">
        <input type="file" id="apkg-file" accept=".apkg" class="input-file" />
        <button class="btn-primary" id="btn-import-apkg" disabled>Import</button>
      </div>
      <p class="muted">Coming in Phase 2</p>
    </div>

    <div id="import-status" class="import-status hidden"></div>
  `;

  // markdown import
  const mdBtn = page.querySelector("#btn-import-md") as HTMLButtonElement;
  const mdInput = page.querySelector("#md-path") as HTMLInputElement;
  const statusEl = page.querySelector("#import-status") as HTMLElement;

  mdBtn.addEventListener("click", async () => {
    const path = mdInput.value.trim();
    if (!path) return;

    mdBtn.disabled = true;
    mdBtn.textContent = "Importing...";
    statusEl.classList.remove("hidden");
    statusEl.textContent = "Importing deck...";

    try {
      const result = await api.import.markdown(path);
      showToast("Deck imported successfully!");
      navigate(`/decks/${result.deckId}`);
    } catch (err: any) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.classList.add("error");
    } finally {
      mdBtn.disabled = false;
      mdBtn.textContent = "Import";
    }
  });

  return page;
}
