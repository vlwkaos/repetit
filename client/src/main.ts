import { initRouter, registerRoute } from "./router.js";
import { initNav } from "./components/nav.js";
import { homePage } from "./pages/home.js";
import { deckListPage, deckDetailPage } from "./pages/deck-list.js";
import { studyPage } from "./pages/study.js";
import { importPage } from "./pages/import.js";
import { statsPage } from "./pages/stats.js";
import { settingsPage } from "./pages/settings.js";

// register routes
registerRoute("/", () => homePage());
registerRoute("/decks", () => deckListPage());
registerRoute("/decks/:id", (p) => deckDetailPage(p));
registerRoute("/study/:deckId", (p) => studyPage(p));
registerRoute("/import", () => importPage());
registerRoute("/stats", () => statsPage());
registerRoute("/settings", () => settingsPage());

// init
const app = document.getElementById("app")!;
const tabBar = document.getElementById("tab-bar")!;

initRouter(app);
initNav(tabBar);
