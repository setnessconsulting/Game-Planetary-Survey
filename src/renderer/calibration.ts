/**
 * Renderer calibration record.
 *
 * docs/RENDERING_QUALITY_STRATEGY.md §3 requires:
 *  - a PBR / OpenPBR-compatible material workflow (Babylon's PBRMaterial is);
 *  - HDR / prefiltered image-based lighting where physically sensible;
 *  - "deliberate tone mapping and calibrated exposure — chosen and reviewed,
 *    not left at defaults by accident";
 *  - "calibrated color handling so that a displayed color is intentional and
 *    reproducible";
 *  - an environment that does NOT make two measurably different bodies look
 *    measurably the same.
 *
 * PS-05 set a tone map and an exposure as bare literals in `scene.ts` with no
 * record of why. This module is that record: the values live in data, each one
 * says what it is for, and a test fails if the scene and this record disagree.
 *
 * WHY THE ENVIRONMENT IS DELIBERATELY DIM
 * The prefiltered environment is a dark cool field with one warm key aligned to
 * the renderer's key light. If it were bright and even, every body would be lit
 * identically from every direction and the only remaining difference between
 * two worlds would be their albedo — which is precisely the failure §3 names.
 * Keeping the environment dark and directional lets the key light do the
 * modelling, so bodies separate by their material response under a common
 * light rather than by a per-body ambient fudge.
 *
 * NOTHING HERE IS A SCIENTIFIC VALUE. These are presentation constants. The
 * numbers a learner compares live in the domain layer and the source register
 * and are never read by the renderer.
 */

import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";

export interface ToneMappingCalibration {
  readonly enabled: boolean;
  readonly type: number;
  readonly label: string;
  readonly rationale: string;
}

export interface ExposureCalibration {
  readonly exposure: number;
  readonly contrast: number;
  readonly environmentIntensity: number;
  readonly rationale: string;
}

export const TONE_MAPPING: ToneMappingCalibration = {
  enabled: true,
  type: ImageProcessingConfiguration.TONEMAPPING_ACES,
  label: "ACES",
  rationale:
    "ACES rolls highlights off smoothly, so the bright key lobe in the prefiltered " +
    "environment compresses instead of clipping to white. A clipped highlight " +
    "destroys the difference between a bright cloud band and a bright rocky " +
    "surface, which is the kind of false similarity §3 forbids.",
};

export const EXPOSURE: ExposureCalibration = {
  exposure: 1.05,
  contrast: 1.12,
  environmentIntensity: 0.85,
  rationale:
    "Chosen against the generated environment's measured luminance (mean ~0.18, key " +
    "lobe peak ~2.0) so that a mid-albedo body lands in the middle of the range " +
    "rather than near black. This is a reviewed value, not a default: raising or " +
    "lowering it is a visible change and must be re-argued, which is why it lives " +
    "here with a rationale instead of inline in the scene.",
};

/**
 * Per-body PBR parameters.
 *
 * These mirror the art direction in `scripts/generate-production-assets.mjs`.
 * They are kept as data so the material response is inspectable and testable
 * without booting WebGL, and so the generator and the renderer cannot quietly
 * disagree about what a body looks like.
 *
 * `albedoTint` is the body's mid-tone, mirroring the generated art. The body's
 * actual colour comes from its shipped albedo texture; this is what a body looks
 * like if that texture fails to load, which is exactly why it has to agree with
 * the art rather than being an independent choice.
 */
export interface BodyMaterialCalibration {
  readonly roughness: number;
  readonly metallic: number;
  readonly albedoTint: readonly [number, number, number];
  readonly note: string;
}

export const BODY_MATERIALS: Readonly<Record<string, BodyMaterialCalibration>> = {
  moon: {
    roughness: 0.94,
    metallic: 0,
    albedoTint: [0.6, 0.59, 0.56],
    note: "Bright, very rough regolith: almost all diffuse response, no specular highlight.",
  },
  mars: {
    roughness: 0.88,
    metallic: 0,
    albedoTint: [0.72, 0.42, 0.25],
    note: "Iron-oxide dust. Rough, with a faint broad sheen at grazing angles.",
  },
  venus: {
    roughness: 0.8,
    metallic: 0,
    albedoTint: [0.9, 0.82, 0.62],
    note: "Thick cloud deck: smoother than rock, so it picks up more environment light.",
  },
  titan: {
    roughness: 0.7,
    metallic: 0,
    albedoTint: [0.86, 0.68, 0.32],
    note: "Organic haze: the smoothest surface here, so it reads as hazy rather than solid.",
  },
  europa: {
    roughness: 0.42,
    metallic: 0.02,
    albedoTint: [0.92, 0.9, 0.85],
    note: "Ice: markedly smoother than every other body, with a low metallic term for the faint sheen.",
  },
};

/** Fallback when a body's art direction is somehow missing. */
export const FALLBACK_MATERIAL: BodyMaterialCalibration = {
  roughness: 0.85,
  metallic: 0,
  albedoTint: [0.5, 0.5, 0.5],
  note: "Neutral fallback. Never a body's real appearance.",
};

export function materialForBody(bodyId: string): BodyMaterialCalibration {
  return BODY_MATERIALS[bodyId] ?? FALLBACK_MATERIAL;
}

/**
 * Atmosphere presentation policy.
 *
 * §4 requires an atmospheric shell whose depth is *derived from the sourced
 * attribute*, and equally requires that the game must not "render a
 * plausible-looking shell that implies a measurement" where a body's depth is
 * not authoritatively known.
 *
 * In v1 exactly one body has a sourced atmosphere attribute, and that value is
 * a **lower bound on the altitude at which the atmosphere was detected**, not a
 * measured top of atmosphere — the source register says so explicitly. Scaling
 * a shell by that number would draw a precise-looking boundary the data does
 * not contain, which is the exact failure §4 names. So PS-10 takes the
 * alternative §4 offers: a **neutral, explicitly labelled representation** whose
 * presence says "an atmosphere is sourced for this world" and nothing more
 * about its depth.
 *
 * Deriving a real depth stays open for PS-11/PS-12, when a register entry
 * carrying an actual measured depth would let the shell be honest. Recorded as
 * a decision rather than left as an undocumented constant.
 */
export const ATMOSPHERE_PRESENTATION = {
  representation: "neutral-labelled",
  shellScale: 1.09,
  label:
    "This world has a sourced atmosphere. The haze shown is a labelled representation, " +
    "not a measurement of how deep the atmosphere is.",
  rationale:
    "The only sourced atmosphere value in v1 is a lower bound on detection altitude, so " +
    "no shell thickness can be derived from it without implying a measurement the register " +
    "does not contain.",
} as const;

/**
 * Perceptual distance between two sRGB colours (0 = identical, ~1+ = distinct).
 *
 * Uses the CIE76 delta-E in Lab space, which tracks human colour difference far
 * better than an RGB euclidean distance. Exists so §3's "an HDR/IBL environment
 * that makes two measurably different bodies look measurably the same" can be
 * checked as a number in a test rather than left to a squint.
 */
export function perceptualDistance(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(rgb: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb.map(srgbToLinear) as [number, number, number];
  // sRGB -> XYZ (D65), then XYZ -> Lab with the D65 white point.
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
