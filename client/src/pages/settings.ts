import { api } from "../api.js";
import { showToast } from "../components/toast.js";

export async function settingsPage(): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.className = "page page-settings";

  const [user, config] = await Promise.all([
    api.user.get(),
    api.config.get(),
  ]);

  page.innerHTML = `
    <h1>Settings</h1>

    <div class="settings-section">
      <h2>Profile</h2>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="username" class="input" value="${user.username}" />
      </div>
      <button class="btn-primary" id="btn-save-profile">Save</button>
    </div>

    <div class="settings-section">
      <h2>Learning</h2>
      <div class="form-group">
        <label>Daily new cards</label>
        <input type="number" id="daily-new" class="input" value="${config.daily_new_limit}" min="0" max="999" />
      </div>
      <div class="form-group">
        <label>Daily review limit</label>
        <input type="number" id="daily-review" class="input" value="${config.daily_review_limit}" min="0" max="9999" />
      </div>
      <div class="form-group">
        <label>Target retention</label>
        <input type="number" id="target-retention" class="input" value="${config.target_retention}" min="0.7" max="0.99" step="0.01" />
      </div>
      <button class="btn-primary" id="btn-save-config">Save</button>
    </div>
  `;

  page.querySelector("#btn-save-profile")?.addEventListener("click", async () => {
    const username = (page.querySelector("#username") as HTMLInputElement).value;
    await api.user.update({ username });
    showToast("Profile saved");
  });

  page.querySelector("#btn-save-config")?.addEventListener("click", async () => {
    const daily_new_limit = Number((page.querySelector("#daily-new") as HTMLInputElement).value);
    const daily_review_limit = Number((page.querySelector("#daily-review") as HTMLInputElement).value);
    const target_retention = Number((page.querySelector("#target-retention") as HTMLInputElement).value);
    await api.config.update({ daily_new_limit, daily_review_limit, target_retention });
    showToast("Config saved");
  });

  return page;
}
