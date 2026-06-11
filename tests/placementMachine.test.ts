import { describe, it, expect } from 'vitest';
import {
  initialPlacement,
  reducePlacement,
  isComplete,
  type PlacementState,
} from '@/lib/placementMachine';

const empty: PlacementState = initialPlacement();

describe('initialPlacement', () => {
  it('starts empty', () => {
    expect(empty.placed).toEqual([]);
  });
});

describe('reducePlacement: PLACE', () => {
  it('appends a card', () => {
    const s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    expect(s.placed).toEqual([5]);
  });

  it('does nothing if the card is already placed', () => {
    const s1 = reducePlacement(empty, { type: 'PLACE', card: 5 });
    const s2 = reducePlacement(s1, { type: 'PLACE', card: 5 });
    expect(s2.placed).toEqual([5]);
  });

  it('does nothing if 52 cards are already placed', () => {
    let s: PlacementState = empty;
    for (let i = 0; i < 52; i++) {
      s = reducePlacement(s, { type: 'PLACE', card: i });
    }
    const overflow = reducePlacement(s, { type: 'PLACE', card: 0 });
    expect(overflow.placed.length).toBe(52);
  });

  it('does nothing if card is out of range', () => {
    expect(reducePlacement(empty, { type: 'PLACE', card: -1 })).toBe(empty);
    expect(reducePlacement(empty, { type: 'PLACE', card: 52 })).toBe(empty);
  });
});

describe('reducePlacement: REMOVE_AT', () => {
  it('removes the card at the given index and shifts following ones', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    s = reducePlacement(s, { type: 'PLACE', card: 3 });
    s = reducePlacement(s, { type: 'REMOVE_AT', index: 1 });
    expect(s.placed).toEqual([5, 3]);
  });

  it('does nothing for an out-of-range index', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    expect(reducePlacement(s, { type: 'REMOVE_AT', index: 7 })).toBe(s);
  });
});

describe('reducePlacement: UNDO', () => {
  it('removes the most recent placement', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    s = reducePlacement(s, { type: 'UNDO' });
    expect(s.placed).toEqual([5]);
  });

  it('is a no-op on empty state', () => {
    expect(reducePlacement(empty, { type: 'UNDO' })).toBe(empty);
  });
});

describe('reducePlacement: CLEAR', () => {
  it('returns to the empty state', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    const cleared = reducePlacement(s, { type: 'CLEAR' });
    expect(cleared.placed).toEqual([]);
  });
});

describe('reducePlacement: HYDRATE', () => {
  it('replaces state with a valid persisted snapshot', () => {
    const s = reducePlacement(empty, { type: 'HYDRATE', placed: [1, 2, 3] });
    expect(s.placed).toEqual([1, 2, 3]);
  });

  it('ignores hydrate with invalid data', () => {
    const s = reducePlacement(empty, {
      type: 'HYDRATE',
      placed: [1, 1] as number[],
    });
    expect(s.placed).toEqual([]);
  });
});

describe('isComplete', () => {
  it('returns true only when 52 unique cards are placed', () => {
    let s: PlacementState = empty;
    for (let i = 0; i < 51; i++) {
      s = reducePlacement(s, { type: 'PLACE', card: i });
    }
    expect(isComplete(s)).toBe(false);
    s = reducePlacement(s, { type: 'PLACE', card: 51 });
    expect(isComplete(s)).toBe(true);
  });
});
