/**
 * Deterministic seeded randomness.
 *
 * Part of the pure domain layer. `Math.random` and `Date.now` are forbidden
 * here (see scripts/check-architecture.mjs): a mission variant must be exactly
 * reproducible from its seed on any device, any renderer, and any quality tier
 * (docs/TECHNICAL_DESIGN.md §3).
 *
 * IMPORTANT: seeds select *which* variant and *which* observation identity a
 * learner sees. A seed never perturbs a scientific value. Measurement output is
 * always the sourced value at the source's precision
 * (docs/SCIENCE_MODEL.md §5-6). See `measurement.ts`.
 */

/** A 32-bit unsigned integer seed. */
export type Seed = number;

export interface Rng {
  /** Next value in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Next element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
}

/**
 * Mulberry32: small, fast, and fully specified, so a golden fixture is stable
 * across engines and platforms.
 */
export function createRng(seed: Seed): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (maxExclusive: number): number => {
      if (!Number.isFinite(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError("nextInt requires a positive maxExclusive");
      }
      return Math.floor(next() * Math.trunc(maxExclusive));
    },
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new RangeError("pick requires a non-empty list");
      }
      const index = Math.floor(next() * items.length);
      const chosen = items[index];
      if (chosen === undefined) {
        throw new RangeError("pick produced an out-of-range index");
      }
      return chosen;
    },
  };
}

/**
 * FNV-1a over UTF-16 code units. Deterministic, dependency-free, and stable
 * across platforms — required because ids derive from it.
 */
export function hashToSeed(text: string): Seed {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Combine a base seed with labelled parts into a derived, stable seed. */
export function deriveSeed(base: Seed, ...parts: readonly (string | number)[]): Seed {
  return hashToSeed([String(base >>> 0), ...parts.map((part) => String(part))].join(":"));
}

/** A short, stable, human-readable identity token derived from a seed. */
export function seedToken(seed: Seed): string {
  return (seed >>> 0).toString(16).padStart(8, "0");
}
