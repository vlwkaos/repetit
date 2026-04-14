export type LearnerId = string;
export type ItemUid = string;

/** 1=Again 2=Hard 3=Good 4=Easy — ts-fsrs Rating enum values */
export type Rating = 1 | 2 | 3 | 4;

export interface Item {
  uid: ItemUid;
  tags: string[];
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Learner {
  id: LearnerId;
  displayName: string | null;
  createdAt: string;
}

export interface LearnerConfig {
  learnerId: LearnerId;
  dailyNewLimit: number;
  dailyReviewLimit: number;
  targetRetention: number;
  tzOffsetMinutes: number;
  fsrsWeights: number[] | null;
}

export interface ReviewResult {
  nextDueAt: string;
  stability: number;
  difficulty: number;
  state: number;
}

export interface DueCounts {
  newCount: number;
  dueCount: number;
}
