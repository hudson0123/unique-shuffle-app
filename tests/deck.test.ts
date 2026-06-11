import { describe, it, expect } from 'vitest';
import {
  encodeCard,
  decodeCard,
  isValidSequence,
  hashSequence,
  cardLabel,
  suitOf,
  rankOf,
  SUITS,
  RANKS,
} from '@/lib/deck';

describe('encodeCard / decodeCard', () => {
  it('encodes (suit, rank) to a single integer in [0, 51]', () => {
    expect(encodeCard(0, 0)).toBe(0); // Ace of clubs
    expect(encodeCard(3, 12)).toBe(51); // King of spades
    expect(encodeCard(2, 5)).toBe(31); // 6 of hearts (2 * 13 + 5)
  });

  it('decodes an integer back to (suit, rank)', () => {
    expect(decodeCard(0)).toEqual({ suit: 0, rank: 0 });
    expect(decodeCard(51)).toEqual({ suit: 3, rank: 12 });
    expect(decodeCard(31)).toEqual({ suit: 2, rank: 5 });
  });

  it('round-trips for every card', () => {
    for (let n = 0; n < 52; n++) {
      const { suit, rank } = decodeCard(n);
      expect(encodeCard(suit, rank)).toBe(n);
    }
  });
});

describe('suitOf / rankOf', () => {
  it('match decodeCard', () => {
    for (let n = 0; n < 52; n++) {
      const d = decodeCard(n);
      expect(suitOf(n)).toBe(d.suit);
      expect(rankOf(n)).toBe(d.rank);
    }
  });
});

describe('SUITS and RANKS', () => {
  it('SUITS has four entries in order ♣ ♦ ♥ ♠', () => {
    expect(SUITS).toHaveLength(4);
    expect(SUITS[0].symbol).toBe('♣');
    expect(SUITS[3].symbol).toBe('♠');
  });

  it('RANKS has 13 entries from A to K', () => {
    expect(RANKS).toHaveLength(13);
    expect(RANKS[0].label).toBe('A');
    expect(RANKS[12].label).toBe('K');
  });
});

describe('cardLabel', () => {
  it('formats a card as "<rank><suit>"', () => {
    expect(cardLabel(0)).toBe('A♣');
    expect(cardLabel(51)).toBe('K♠');
    expect(cardLabel(31)).toBe('6♥');
  });
});

describe('isValidSequence', () => {
  it('returns true for a valid 52-permutation', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(isValidSequence(seq)).toBe(true);
  });

  it('rejects wrong length', () => {
    expect(isValidSequence([0, 1, 2])).toBe(false);
    expect(isValidSequence(new Array(53).fill(0))).toBe(false);
  });

  it('rejects duplicates', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[51] = seq[0];
    expect(isValidSequence(seq)).toBe(false);
  });

  it('rejects values outside [0, 51]', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[0] = 52;
    expect(isValidSequence(seq)).toBe(false);
  });

  it('rejects non-integer values', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    seq[0] = 1.5;
    expect(isValidSequence(seq)).toBe(false);
  });
});

describe('hashSequence', () => {
  it('is deterministic for the same input', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(hashSequence(seq)).toBe(hashSequence(seq));
  });

  it('differs for different sequences', () => {
    const a = Array.from({ length: 52 }, (_, i) => i);
    const b = [...a];
    [b[0], b[1]] = [b[1], b[0]];
    expect(hashSequence(a)).not.toBe(hashSequence(b));
  });

  it('returns a 64-char hex string', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(hashSequence(seq)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the known SHA-256 for the sorted deck', () => {
    const seq = Array.from({ length: 52 }, (_, i) => i);
    expect(hashSequence(seq)).toBe(
      '47e8318fa73d6f32ce282fc87dd446c17298fb75c9ba6aca1262e8e9021b7914',
    );
  });
});
