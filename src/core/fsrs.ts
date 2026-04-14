// ts-fsrs docs: https://github.com/open-spaced-repetition/ts-fsrs
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card,
  type FSRSParameters,
  Rating,
  State,
} from "ts-fsrs";

export { Rating, State };
export type { Card, FSRSParameters };

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

/** Returns the scheduled card+log for the chosen rating. */
export function scheduleCard(
  scheduler: ReturnType<typeof createScheduler>,
  card: Card,
  rating: Rating,
  now?: Date,
) {
  const result = scheduler.repeat(card, now ?? new Date());
  return result[rating];
}

/** Rehydrate a ts-fsrs Card from a JSON-parsed object (Date fields are strings after JSON.parse). */
export function hydrateCard(raw: Record<string, unknown>): Card {
  const card = { ...raw } as Record<string, unknown>;
  if (card.due) card.due = new Date(card.due as string);
  if (card.last_review) card.last_review = new Date(card.last_review as string);
  return card as unknown as Card;
}
