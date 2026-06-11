import { createHash } from 'node:crypto';

export const SUITS = [
  { id: 0, symbol: '♣', name: 'clubs', color: 'black' },
  { id: 1, symbol: '♦', name: 'diamonds', color: 'red' },
  { id: 2, symbol: '♥', name: 'hearts', color: 'red' },
  { id: 3, symbol: '♠', name: 'spades', color: 'black' },
] as const;

export const RANKS = [
  { id: 0, label: 'A', name: 'Ace' },
  { id: 1, label: '2', name: 'Two' },
  { id: 2, label: '3', name: 'Three' },
  { id: 3, label: '4', name: 'Four' },
  { id: 4, label: '5', name: 'Five' },
  { id: 5, label: '6', name: 'Six' },
  { id: 6, label: '7', name: 'Seven' },
  { id: 7, label: '8', name: 'Eight' },
  { id: 8, label: '9', name: 'Nine' },
  { id: 9, label: '10', name: 'Ten' },
  { id: 10, label: 'J', name: 'Jack' },
  { id: 11, label: 'Q', name: 'Queen' },
  { id: 12, label: 'K', name: 'King' },
] as const;

export const DECK_SIZE = 52;

export function encodeCard(suit: number, rank: number): number {
  return suit * 13 + rank;
}

export function decodeCard(card: number): { suit: number; rank: number } {
  return { suit: Math.floor(card / 13), rank: card % 13 };
}

export function suitOf(card: number): number {
  return Math.floor(card / 13);
}

export function rankOf(card: number): number {
  return card % 13;
}

export function cardLabel(card: number): string {
  const { suit, rank } = decodeCard(card);
  return `${RANKS[rank].label}${SUITS[suit].symbol}`;
}

export function isValidSequence(seq: unknown): seq is number[] {
  if (!Array.isArray(seq)) return false;
  if (seq.length !== DECK_SIZE) return false;
  const seen = new Set<number>();
  for (const v of seq) {
    if (!Number.isInteger(v)) return false;
    if (v < 0 || v >= DECK_SIZE) return false;
    if (seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

export function hashSequence(seq: number[]): string {
  return createHash('sha256').update(seq.join(',')).digest('hex');
}
