import { navigate } from "../router.js";

interface Tab {
  label: string;
  icon: string;
  path: string;
}

const TABS: Tab[] = [
  { label: "Home", icon: "&#127968;", path: "/" },
  { label: "Decks", icon: "&#128218;", path: "/decks" },
  { label: "Import", icon: "&#10133;", path: "/import" },
  { label: "Stats", icon: "&#128200;", path: "/stats" },
  { label: "Settings", icon: "&#9881;", path: "/settings" },
];

export function initNav(container: HTMLElement) {
  container.className = "tab-bar";

  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.className = "tab-btn";
    btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`;
    btn.addEventListener("click", () => navigate(tab.path));
    container.appendChild(btn);
  }

  // highlight active tab
  function updateActive() {
    const hash = window.location.hash.slice(1) || "/";
    container.querySelectorAll(".tab-btn").forEach((btn, i) => {
      btn.classList.toggle("active", hash === TABS[i].path || hash.startsWith(TABS[i].path + "/"));
    });
  }

  window.addEventListener("hashchange", updateActive);
  updateActive();
}
