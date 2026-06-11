import { describe, it, expect } from 'vitest';
import { findClosestMatch } from '@/lib/closest';

const sorted = Array.from({ length: 52 }, (_, i) => i);

function swap(seq: number[], i: number, j: number): number[] {
  const out = [...seq];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

describe('findClosestMatch', () => {
  it('returns null when there are no candidates', () => {
    expect(findClosestMatch(sorted, [])).toBeNull();
  });

  it('returns the candidate with the most matching positions', () => {
    const oneOff = swap(sorted, 0, 1);
    const twoOff = swap(swap(sorted, 0, 1), 2, 3);
    const candidates = [
      { id: 1, sequence: twoOff, createdAt: new Date('2026-06-01') },
      { id: 2, sequence: oneOff, createdAt: new Date('2026-06-02') },
    ];
    const result = findClosestMatch(sorted, candidates);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(2);
    expect(result!.matchCount).toBe(50);
  });

  it('breaks ties by lower id', () => {
    const a = swap(sorted, 0, 1);
    const b = swap(sorted, 2, 3);
    const candidates = [
      { id: 7, sequence: b, createdAt: new Date('2026-06-02') },
      { id: 3, sequence: a, createdAt: new Date('2026-06-01') },
    ];
    const result = findClosestMatch(sorted, candidates);
    expect(result!.id).toBe(3);
  });

  it('reports an exact match as 52', () => {
    const candidates = [
      { id: 1, sequence: [...sorted], createdAt: new Date() },
    ];
    expect(findClosestMatch(sorted, candidates)!.matchCount).toBe(52);
  });
});
