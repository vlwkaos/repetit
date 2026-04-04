type Listener = () => void;

const listeners = new Set<Listener>();

export const state = new Proxy(
  {
    streakDays: 0,
    xpToday: 0,
    cardsToday: 0,
  },
  {
    set(target, prop, value) {
      (target as any)[prop as string] = value;
      listeners.forEach((fn) => fn());
      return true;
    },
  },
);

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
