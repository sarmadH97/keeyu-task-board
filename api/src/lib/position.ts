export const POSITION_GAP = 1024n;

export interface PositionNeighbors {
  before?: bigint | null | undefined;
  after?: bigint | null | undefined;
}

export function getNextPosition(lastPosition: bigint | null | undefined): bigint {
  if (!lastPosition || lastPosition <= 0n) {
    return POSITION_GAP;
  }

  return lastPosition + POSITION_GAP;
}

/**
 * Returns null when there is no free integer between neighbors.
 *
 * Semantics:
 * - before: previous item position (smaller position in ascending lists)
 * - after: next item position (larger position in ascending lists)
 */
export function getGapPosition(neighbors: PositionNeighbors): bigint | null {
  const before = neighbors.before ?? null;
  const after = neighbors.after ?? null;

  if (before !== null && after !== null) {
    if (before >= after) {
      return null;
    }

    const distance = after - before;
    if (distance <= 1n) {
      return null;
    }

    return before + distance / 2n;
  }

  if (before !== null) {
    return before + POSITION_GAP;
  }

  if (after !== null) {
    if (after > POSITION_GAP) {
      return after - POSITION_GAP;
    }

    const middle = after / 2n;
    return middle > 0n ? middle : 1n;
  }

  return POSITION_GAP;
}

export function buildRebalanceUpdates(ids: string[]): Array<{ id: string; position: bigint }> {
  return ids.map((id, index) => ({
    id,
    position: POSITION_GAP * BigInt(index + 1),
  }));
}
