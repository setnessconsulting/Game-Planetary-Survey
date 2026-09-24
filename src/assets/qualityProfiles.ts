/**
 * Quality profiles, held as DATA rather than scattered renderer constants
 * (docs/TECHNICAL_DESIGN.md §7, docs/RENDERING_QUALITY_STRATEGY.md §5).
 *
 * Invariance rule (release-blocking): a profile may change presentation cost
 * only. It may never change planetary truth, a measurement, an evidence record,
 * mission rules, scoring, learner conclusions, or accessible equivalents.
 *
 * Motion is deliberately a SEPARATE input from quality. Reduced motion reduces
 * animation density within whichever quality tier is selected; it does not force
 * a lower-fidelity tier, because a learner who prefers less motion should still
 * get a well-presented world.
 */

export type QualityProfileId = "high" | "standard" | "reduced";

export interface QualityProfile {
  readonly id: QualityProfileId;
  readonly label: string;
  readonly description: string;
  /** Hardware/render scale multiplier. */
  readonly renderScale: number;
  readonly shadows: boolean;
  readonly atmosphereQuality: "full" | "reduced" | "simplified";
  readonly postProcessing: boolean;
  /** Particle count multiplier, 0 disables particles entirely. */
  readonly particleDensity: number;
  /** Texture LOD bias; positive values favour smaller mips. */
  readonly textureLodBias: number;
  readonly animationDensity: "full" | "reduced" | "minimal";
}

export const QUALITY_PROFILES: Readonly<Record<QualityProfileId, QualityProfile>> = {
  high: {
    id: "high",
    label: "High",
    description: "Full presentation cost on capable hardware: full scattering, shadows, and post-processing.",
    renderScale: 1,
    shadows: true,
    atmosphereQuality: "full",
    postProcessing: true,
    particleDensity: 1,
    textureLodBias: 0,
    animationDensity: "full",
  },
  standard: {
    id: "standard",
    label: "Standard",
    description: "Balanced presentation cost. The default when the device is not clearly capable or clearly limited.",
    renderScale: 1,
    shadows: true,
    atmosphereQuality: "reduced",
    postProcessing: false,
    particleDensity: 0.5,
    textureLodBias: 0,
    animationDensity: "reduced",
  },
  reduced: {
    id: "reduced",
    label: "Reduced",
    description:
      "Lower presentation cost for school laptops and low-end devices. Every mission remains fully playable and every measurement remains identical.",
    renderScale: 0.75,
    shadows: false,
    atmosphereQuality: "simplified",
    postProcessing: false,
    particleDensity: 0,
    textureLodBias: 1,
    animationDensity: "minimal",
  },
};

export const QUALITY_PROFILE_IDS: readonly QualityProfileId[] = ["high", "standard", "reduced"];

export const DEFAULT_QUALITY_PROFILE: QualityProfileId = "standard";

export function qualityProfile(id: QualityProfileId): QualityProfile {
  return QUALITY_PROFILES[id];
}

export function isQualityProfileId(value: string): value is QualityProfileId {
  return (QUALITY_PROFILE_IDS as readonly string[]).includes(value);
}

export interface QualitySignals {
  /** Explicit learner choice, or `auto` to use the device heuristic. */
  readonly preference: QualityProfileId | "auto";
  /** Approximate device memory in GiB, when the browser exposes it. */
  readonly deviceMemoryGb: number | null;
  readonly hardwareConcurrency: number | null;
  /**
   * Whether WebGPU is CONFIRMED in use by the renderer, not merely whether the
   * browser exposes the API.
   *
   * The name is deliberate. An earlier version of this signal was fed straight
   * from `navigator.gpu` presence, which escalated a browser with no usable
   * WebGPU adapter to the `high` profile. Requiring the caller to pass a
   * confirmed value makes that mistake impossible to reintroduce silently.
   */
  readonly webgpuConfirmed: boolean;
}

/**
 * Resolve a profile from device signals. Pure, so the same device always gets the
 * same tier and the decision is unit-testable.
 *
 * Order: explicit preference -> clearly limited device -> clearly capable device
 * with CONFIRMED WebGPU -> standard default.
 */
export function resolveQualityProfile(signals: QualitySignals): QualityProfileId {
  if (signals.preference !== "auto") {
    return signals.preference;
  }

  const memory = signals.deviceMemoryGb;
  const cores = signals.hardwareConcurrency;

  // Chromebook-class and low-end laptops: 4 GB or fewer, or very few threads.
  if ((memory !== null && memory <= 4) || (cores !== null && cores <= 2)) {
    return "reduced";
  }

  // Mid-range: moderate memory or a modest core count.
  if ((memory !== null && memory <= 8) || (cores !== null && cores <= 4)) {
    return "standard";
  }

  if (signals.webgpuConfirmed) {
    return "high";
  }

  return DEFAULT_QUALITY_PROFILE;
}
