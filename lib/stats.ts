import { rankOf, suitOf, DECK_SIZE } from './deck';

export function sortedDeck(): number[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

export function longestSameSuitRun(seq: number[]): number {
  let best = 0;
  let current = 0;
  let prevSuit = -1;
  for (const card of seq) {
    const s = suitOf(card);
    if (s === prevSuit) {
      current += 1;
    } else {
      current = 1;
      prevSuit = s;
    }
    if (current > best) best = current;
  }
  return best;
}

export function longestAscendingRun(seq: number[]): number {
  if (seq.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < seq.length; i++) {
    if (rankOf(seq[i]) > rankOf(seq[i - 1])) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function longestDescendingRun(seq: number[]): number {
  if (seq.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < seq.length; i++) {
    if (rankOf(seq[i]) < rankOf(seq[i - 1])) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export function naturalPositionCount(seq: number[]): number {
  let n = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === i) n += 1;
  }
  return n;
}

export function adjacentSameSuitPairs(seq: number[]): number {
  let n = 0;
  for (let i = 1; i < seq.length; i++) {
    if (suitOf(seq[i]) === suitOf(seq[i - 1])) n += 1;
  }
  return n;
}

export function inversionCount(seq: number[]): number {
  let n = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      if (seq[i] > seq[j]) n += 1;
    }
  }
  return n;
}

export type ShuffleStats = {
  longestSameSuitRun: number;
  longestAscendingRun: number;
  longestDescendingRun: number;
  naturalPositionCount: number;
  adjacentSameSuitPairs: number;
  inversionCount: number;
};

export function computeAllStats(seq: number[]): ShuffleStats {
  return {
    longestSameSuitRun: longestSameSuitRun(seq),
    longestAscendingRun: longestAscendingRun(seq),
    longestDescendingRun: longestDescendingRun(seq),
    naturalPositionCount: naturalPositionCount(seq),
    adjacentSameSuitPairs: adjacentSameSuitPairs(seq),
    inversionCount: inversionCount(seq),
  };
}
