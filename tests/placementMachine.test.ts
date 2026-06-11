import { describe, it, expect } from 'vitest';
import {
  initialPlacement,
  reducePlacement,
  isComplete,
  placedSet,
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

  it('does nothing when 52 cards already placed even with HYDRATE-loaded state', () => {
    const fullSeq = Array.from({ length: 52 }, (_, i) => i);
    const full = reducePlacement(empty, { type: 'HYDRATE', placed: fullSeq });
    expect(full.placed.length).toBe(52);
    // Pop the last card, then attempt to place a different, fresh card to fill the slot.
    const popped = reducePlacement(full, { type: 'UNDO' });
    expect(popped.placed.length).toBe(51);
    // Now try to place a card that's already used elsewhere - should be no-op by duplicate guard.
    expect(reducePlacement(popped, { type: 'PLACE', card: 0 })).toBe(popped);
    // Refill with the missing card.
    const refilled = reducePlacement(popped, { type: 'PLACE', card: 51 });
    expect(refilled.placed.length).toBe(52);
    // Attempt to place any card while full - must fail by full-deck guard.
    // (All 52 cards are taken, so any in-range card is a duplicate too. Just confirm length stays 52.)
    expect(reducePlacement(refilled, { type: 'PLACE', card: 0 }).placed.length).toBe(52);
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

  it('is a no-op on empty state', () => {
    expect(reducePlacement(empty, { type: 'CLEAR' })).toBe(empty);
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

describe('placedSet', () => {
  it('returns a Set of placed cards', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    const set = placedSet(s);
    expect(set.has(5)).toBe(true);
    expect(set.has(8)).toBe(true);
    expect(set.has(0)).toBe(false);
    expect(set.size).toBe(2);
  });

  it('returns a snapshot, not a live view', () => {
    let s = reducePlacement(empty, { type: 'PLACE', card: 5 });
    const set = placedSet(s);
    s = reducePlacement(s, { type: 'PLACE', card: 8 });
    expect(set.size).toBe(1);
  });
});
