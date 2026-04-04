import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRSParameters, Rating, State } from "ts-fsrs";

export { Rating, State };
export type { Card };

export function createScheduler(weights?: number[], retention?: number) {
  const params = generatorParameters({
    enable_fuzz: true,
    w: weights,
    request_retention: retention ?? 0.9,
  });
  return fsrs(params);
}

export function newCard(now?: Date): Card {
  return createEmptyCard(now ?? new Date());
}

export function scheduleCard(
  scheduler: ReturnType<typeof createScheduler>,
  card: Card,
  rating: Rating,
  now?: Date,
) {
  const result = scheduler.repeat(card, now ?? new Date());
  return result[rating];
}

// XP per rating
const XP_MAP: Record<number, number> = {
  [Rating.Again]: 1,
  [Rating.Hard]: 2,
  [Rating.Good]: 3,
  [Rating.Easy]: 5,
};

export function xpForRating(rating: Rating): number {
  return XP_MAP[rating] ?? 0;
}
