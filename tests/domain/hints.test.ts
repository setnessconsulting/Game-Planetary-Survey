/**
 * Progressive hints (GAME-372).
 *
 * Hints are revealed one at a time, in authored order, and asking for one has no
 * effect beyond the reveal. These tests pin the sequence and the clamping; the
 * "a hint never performs a required choice" property is pinned in
 * `tests/domain/mission.test.ts`, where `requestHint` only changes `hintsUsed`.
 */

import { describe, expect, it } from "vitest";

import { hintReveal } from "@/domain/hints";
import type { MissionHint } from "@/domain/catalog";

const HINTS: readonly MissionHint[] = [
  { order: 1, text: "Read the brief again." },
  { order: 2, text: "One instrument reports one number per world." },
  { order: 3, text: "Check your notebook before you submit." },
];

describe("hints are revealed progressively", () => {
  it("reveals nothing before a hint is requested", () => {
    const reveal = hintReveal(HINTS, 0);
    expect(reveal.revealed).toEqual([]);
    expect(reveal.latest).toBeNull();
    expect(reveal.remaining).toBe(3);
    expect(reveal.exhausted).toBe(false);
  });

  it("reveals one authored hint per request, in order", () => {
    expect(hintReveal(HINTS, 1).revealed.map((hint) => hint.order)).toEqual([1]);
    expect(hintReveal(HINTS, 2).revealed.map((hint) => hint.order)).toEqual([1, 2]);
    expect(hintReveal(HINTS, 2).latest?.order).toBe(2);
    expect(hintReveal(HINTS, 2).remaining).toBe(1);
  });

  it("reports exhaustion once every hint has been shown", () => {
    const reveal = hintReveal(HINTS, 3);
    expect(reveal.revealed).toHaveLength(3);
    expect(reveal.remaining).toBe(0);
    expect(reveal.exhausted).toBe(true);
  });

  it("clamps a request past the last hint instead of failing", () => {
    const reveal = hintReveal(HINTS, 99);
    expect(reveal.revealed).toHaveLength(3);
    expect(reveal.exhausted).toBe(true);
    expect(reveal.latest?.order).toBe(3);
  });

  it("clamps a negative or non-finite count to none", () => {
    expect(hintReveal(HINTS, -2).revealed).toEqual([]);
    expect(hintReveal(HINTS, Number.NaN).revealed).toEqual([]);
  });

  it("orders by authored order regardless of array order", () => {
    const shuffled = [HINTS[2]!, HINTS[0]!, HINTS[1]!];
    expect(hintReveal(shuffled, 2).revealed.map((hint) => hint.order)).toEqual([1, 2]);
  });

  it("handles a mission with no hints without failing", () => {
    const reveal = hintReveal([], 1);
    expect(reveal.total).toBe(0);
    expect(reveal.revealed).toEqual([]);
    expect(reveal.exhausted).toBe(true);
  });
});
