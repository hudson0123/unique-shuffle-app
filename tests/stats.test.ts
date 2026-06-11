import { describe, it, expect } from 'vitest';
import {
  longestSameSuitRun,
  longestAscendingRun,
  longestDescendingRun,
  naturalPositionCount,
  adjacentSameSuitPairs,
  inversionCount,
  computeAllStats,
  sortedDeck,
} from '@/lib/stats';

const SORTED = Array.from({ length: 52 }, (_, i) => i);

describe('sortedDeck', () => {
  it('returns 0..51 in order', () => {
    expect(sortedDeck()).toEqual(SORTED);
  });
});

describe('longestSameSuitRun', () => {
  it('returns 13 for the sorted deck (all clubs run, then diamonds, etc.)', () => {
    expect(longestSameSuitRun(SORTED)).toBe(13);
  });

  it('returns 1 when no two adjacent cards share a suit', () => {
    const seq: number[] = [];
    for (let i = 0; i < 13; i++) {
      seq.push(i, 13 + i, 26 + i, 39 + i);
    }
    expect(longestSameSuitRun(seq)).toBe(1);
  });
});

describe('longestAscendingRun', () => {
  it('returns 13 for an all-ascending suit run within sorted deck', () => {
    expect(longestAscendingRun(SORTED)).toBe(13);
  });

  it('returns 2 for a reversed deck (rank jumps at suit boundaries)', () => {
    const reversed = [...SORTED].reverse();
    expect(longestAscendingRun(reversed)).toBe(2);
  });

  it('counts based on rank only, regardless of suit', () => {
    const seq = [1, 28, 42, 0, 0, 0];
    expect(longestAscendingRun(seq.slice(0, 3))).toBe(3);
  });
});

describe('longestDescendingRun', () => {
  it('returns 13 for a fully descending deck', () => {
    const reversed = [...SORTED].reverse();
    expect(longestDescendingRun(reversed)).toBe(13);
  });

  it('returns 2 for the sorted deck (rank drops at suit boundaries)', () => {
    expect(longestDescendingRun(SORTED)).toBe(2);
  });
});

describe('naturalPositionCount', () => {
  it('returns 52 for the sorted deck', () => {
    expect(naturalPositionCount(SORTED)).toBe(52);
  });

  it('returns 0 when every card is offset', () => {
    const rotated = [...SORTED.slice(1), SORTED[0]];
    expect(naturalPositionCount(rotated)).toBe(0);
  });

  it('counts only positions where card matches index', () => {
    const seq = [...SORTED];
    [seq[0], seq[1]] = [seq[1], seq[0]];
    expect(naturalPositionCount(seq)).toBe(50);
  });
});

describe('adjacentSameSuitPairs', () => {
  it('returns 48 for the sorted deck (12 same-suit pairs per suit × 4 suits)', () => {
    expect(adjacentSameSuitPairs(SORTED)).toBe(48);
  });

  it('returns 0 when no two adjacent cards share a suit', () => {
    const seq: number[] = [];
    for (let i = 0; i < 13; i++) {
      seq.push(i, 13 + i, 26 + i, 39 + i);
    }
    expect(adjacentSameSuitPairs(seq)).toBe(0);
  });
});

describe('inversionCount', () => {
  it('returns 0 for the sorted deck', () => {
    expect(inversionCount(SORTED)).toBe(0);
  });

  it('returns 52*51/2 = 1326 for the fully reversed deck', () => {
    const reversed = [...SORTED].reverse();
    expect(inversionCount(reversed)).toBe(1326);
  });
});

describe('computeAllStats', () => {
  it('returns all six stats keyed by name', () => {
    const stats = computeAllStats(SORTED);
    expect(stats).toEqual({
      longestSameSuitRun: 13,
      longestAscendingRun: 13,
      longestDescendingRun: 2,
      naturalPositionCount: 52,
      adjacentSameSuitPairs: 48,
      inversionCount: 0,
    });
  });
});
