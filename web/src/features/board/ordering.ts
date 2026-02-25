import { DEFAULT_POSITION, POSITION_GAP } from "@/features/board/constants";
import type { Task } from "@/features/board/types";

export function sortByPosition<T extends { position: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareBigInt(a.position, b.position));
}

export function compareBigInt(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);

  if (leftValue < rightValue) {
    return -1;
  }

  if (leftValue > rightValue) {
    return 1;
  }

  return 0;
}

export function positionBetween(prevPosition?: string, nextPosition?: string): string | null {
  if (!prevPosition && !nextPosition) {
    return DEFAULT_POSITION.toString();
  }

  if (prevPosition && !nextPosition) {
    return (BigInt(prevPosition) + POSITION_GAP).toString();
  }

  if (!prevPosition && nextPosition) {
    const nextValue = BigInt(nextPosition);

    if (nextValue <= 1n) {
      return null;
    }

    return (nextValue / 2n).toString();
  }

  const prevValue = BigInt(prevPosition!);
  const nextValue = BigInt(nextPosition!);
  const gap = nextValue - prevValue;

  if (gap <= 1n) {
    return null;
  }

  return (prevValue + gap / 2n).toString();
}

export function rebalancePositions(tasks: readonly Task[]): Task[] {
  return tasks.map((task, index) => ({
    ...task,
    position: ((BigInt(index) + 1n) * POSITION_GAP).toString(),
  }));
}
