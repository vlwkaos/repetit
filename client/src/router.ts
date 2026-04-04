type PageFn = (params: Record<string, string>) => HTMLElement | Promise<HTMLElement>;

interface RouteEntry {
  pattern: RegExp;
  paramNames: string[];
  page: PageFn;
}

const routes: RouteEntry[] = [];
let appEl: HTMLElement;

export function registerRoute(path: string, page: PageFn) {
  const paramNames: string[] = [];
  const pattern = path.replace(/:(\w+)/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  routes.push({ pattern: new RegExp(`^${pattern}$`), paramNames, page });
}

export function navigate(path: string) {
  window.location.hash = path;
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || "/";

  for (const r of routes) {
    const match = hash.match(r.pattern);
    if (match) {
      const params: Record<string, string> = {};
      r.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });
      const el = await r.page(params);
      appEl.innerHTML = "";
      appEl.appendChild(el);
      return;
    }
  }

  // 404 fallback
  appEl.innerHTML = `<div class="page-404"><h2>Page not found</h2></div>`;
}

export function initRouter(el: HTMLElement) {
  appEl = el;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}
