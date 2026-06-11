import { DECK_SIZE } from './deck';

export type PlacementState = {
  placed: number[];
};

export type PlacementAction =
  | { type: 'PLACE'; card: number }
  | { type: 'REMOVE_AT'; index: number }
  | { type: 'UNDO' }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; placed: number[] };

export function initialPlacement(): PlacementState {
  return { placed: [] };
}

function snapshotIsValid(placed: number[]): boolean {
  if (placed.length > DECK_SIZE) return false;
  const seen = new Set<number>();
  for (const v of placed) {
    if (!Number.isInteger(v)) return false;
    if (v < 0 || v >= DECK_SIZE) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

export function reducePlacement(
  state: PlacementState,
  action: PlacementAction,
): PlacementState {
  switch (action.type) {
    case 'PLACE': {
      if (!Number.isInteger(action.card)) return state;
      if (action.card < 0 || action.card >= DECK_SIZE) return state;
      if (state.placed.length >= DECK_SIZE) return state;
      if (state.placed.includes(action.card)) return state;
      return { placed: [...state.placed, action.card] };
    }
    case 'REMOVE_AT': {
      if (action.index < 0 || action.index >= state.placed.length) return state;
      return {
        placed: state.placed.filter((_, i) => i !== action.index),
      };
    }
    case 'UNDO': {
      if (state.placed.length === 0) return state;
      return { placed: state.placed.slice(0, -1) };
    }
    case 'CLEAR': {
      if (state.placed.length === 0) return state;
      return { placed: [] };
    }
    case 'HYDRATE': {
      if (!snapshotIsValid(action.placed)) return state;
      return { placed: [...action.placed] };
    }
  }
}

export function isComplete(state: PlacementState): boolean {
  return state.placed.length === DECK_SIZE;
}

export function placedSet(state: PlacementState): Set<number> {
  return new Set(state.placed);
}
