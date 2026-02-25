import assert from "node:assert/strict";
import test from "node:test";

import { POSITION_GAP, buildRebalanceUpdates, getGapPosition, getNextPosition } from "../lib/position";

test("getNextPosition returns first gap when no previous position exists", () => {
  assert.equal(getNextPosition(undefined), POSITION_GAP);
  assert.equal(getNextPosition(null), POSITION_GAP);
});

test("getNextPosition appends by gap", () => {
  assert.equal(getNextPosition(2048n), 3072n);
});

test("getGapPosition can place an item between neighbors", () => {
  const middle = getGapPosition({ before: 1024n, after: 2048n });
  assert.equal(middle, 1536n);
});

test("getGapPosition returns null when there is no available integer between adjacent neighbors", () => {
  const middle = getGapPosition({ before: 100n, after: 101n });
  assert.equal(middle, null);
});

test("getGapPosition appends after before-neighbor when only before is provided", () => {
  const position = getGapPosition({ before: 2048n });
  assert.equal(position, 3072n);
});

test("getGapPosition prepends before after-neighbor when only after is provided", () => {
  const position = getGapPosition({ after: 2048n });
  assert.equal(position, 1024n);
});

test("buildRebalanceUpdates generates deterministic BIGINT positions", () => {
  const updates = buildRebalanceUpdates(["a", "b", "c"]);
  assert.deepEqual(updates, [
    { id: "a", position: 1024n },
    { id: "b", position: 2048n },
    { id: "c", position: 3072n },
  ]);
});
