import { describe, expect, it } from "vitest";

import { createRng, deriveSeed, hashToSeed, seedToken } from "@/domain/random";

describe("createRng", () => {
  it("produces an identical sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const first = [a.next(), a.next(), a.next(), a.next()];
    const second = [b.next(), b.next(), b.next(), b.next()];
    expect(first).toEqual(second);
  });

  it("produces a different sequence for a different seed", () => {
    const a = createRng(42).next();
    const b = createRng(43).next();
    expect(a).not.toBe(b);
  });

  it("stays inside [0, 1)", () => {
    const rng = createRng(7);
    for (let index = 0; index < 500; index += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("bounds nextInt to [0, maxExclusive)", () => {
    const rng = createRng(1);
    for (let index = 0; index < 500; index += 1) {
      const value = rng.nextInt(3);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(3);
    }
  });

  it("rejects a non-positive nextInt bound", () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(0)).toThrow(RangeError);
    expect(() => rng.nextInt(-5)).toThrow(RangeError);
  });

  it("picks deterministically and rejects an empty list", () => {
    const a = createRng(9).pick(["x", "y", "z"]);
    const b = createRng(9).pick(["x", "y", "z"]);
    expect(a).toBe(b);
    expect(() => createRng(9).pick([])).toThrow(RangeError);
  });
});

describe("seed derivation", () => {
  it("hashes text to a stable 32-bit seed", () => {
    expect(hashToSeed("planetary-survey")).toBe(hashToSeed("planetary-survey"));
    expect(hashToSeed("a")).not.toBe(hashToSeed("b"));
    expect(hashToSeed("planetary-survey")).toBeLessThanOrEqual(0xffffffff);
    expect(hashToSeed("planetary-survey")).toBeGreaterThanOrEqual(0);
  });

  it("derives different seeds for different parts", () => {
    expect(deriveSeed(1, "a")).not.toBe(deriveSeed(1, "b"));
    expect(deriveSeed(1, "a")).not.toBe(deriveSeed(2, "a"));
    expect(deriveSeed(1, "a", "b")).toBe(deriveSeed(1, "a", "b"));
  });

  it("formats a stable, fixed-width token", () => {
    expect(seedToken(0)).toBe("00000000");
    expect(seedToken(255)).toBe("000000ff");
  });
});
