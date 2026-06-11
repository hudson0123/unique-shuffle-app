export type Candidate = {
  id: number;
  sequence: number[];
  createdAt: Date;
};

export type ClosestMatch = {
  id: number;
  createdAt: Date;
  matchCount: number;
  sequence: number[];
};

export function findClosestMatch(
  target: number[],
  candidates: Iterable<Candidate>,
): ClosestMatch | null {
  let best: ClosestMatch | null = null;

  for (const c of candidates) {
    if (c.sequence.length !== target.length) {
      throw new Error(
        `Candidate id=${c.id} sequence length ${c.sequence.length} does not match target length ${target.length}`,
      );
    }
    let matches = 0;
    for (let i = 0; i < target.length; i++) {
      if (target[i] === c.sequence[i]) matches += 1;
    }

    if (
      best === null ||
      matches > best.matchCount ||
      (matches === best.matchCount && c.id < best.id)
    ) {
      best = {
        id: c.id,
        createdAt: c.createdAt,
        matchCount: matches,
        sequence: c.sequence,
      };
    }
  }

  return best;
}
