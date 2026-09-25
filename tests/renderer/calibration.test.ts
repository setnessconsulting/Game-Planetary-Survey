/**
 * Renderer calibration (GAME-374, docs/RENDERING_QUALITY_STRATEGY.md §3).
 *
 * §3 approves a PBR workflow, HDR/prefiltered IBL, deliberate tone mapping, and
 * calibrated exposure, and it names the failure mode to avoid: "an HDR/IBL
 * environment that makes two measurably different bodies look measurably the
 * same."
 *
 * That last clause is the one worth testing, because it is the only requirement
 * in §3 that a human would otherwise have to judge by squinting at a screen. The
 * art is generated, so the colours are known, which means the separation can be
 * computed as a CIE76 delta-E and asserted as a number.
 *
 * What is deliberately NOT tested here: frame time, memory, or how any of this
 * looks on a real GPU. Those are PS-12's, and a software-rasterised run cannot
 * speak to them.
 */

import { describe, expect, it } from "vitest";

import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";

import {
  ATMOSPHERE_PRESENTATION,
  BODY_MATERIALS,
  EXPOSURE,
  FALLBACK_MATERIAL,
  TONE_MAPPING,
  materialForBody,
  perceptualDistance,
} from "@/renderer/calibration";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..", "..");

const BODIES = ["moon", "mars", "venus", "titan", "europa"];

/**
 * Minimum CIE76 delta-E between two bodies' albedos.
 *
 * Below roughly 10 the difference is hard to see side by side, which is
 * exactly the §3 failure. Europa and the Moon are the closest pair in the set
 * (both pale, one icy and one grey) so this is the binding constraint.
 */
const MINIMUM_BODY_SEPARATION = 10;

describe("tone mapping and exposure", () => {
  it("uses ACES, so bright regions roll off instead of clipping", () => {
    expect(TONE_MAPPING.enabled).toBe(true);
    expect(TONE_MAPPING.type).toBe(ImageProcessingConfiguration.TONEMAPPING_ACES);
    expect(TONE_MAPPING.label).toBe("ACES");
  });

  it("records why each calibration value is what it is", () => {
    expect(TONE_MAPPING.rationale.length).toBeGreaterThan(60);
    expect(EXPOSURE.rationale.length).toBeGreaterThan(60);
  });

  it("keeps exposure and environment intensity in a sane range", () => {
    expect(EXPOSURE.exposure).toBeGreaterThan(0.5);
    expect(EXPOSURE.exposure).toBeLessThan(2);
    expect(EXPOSURE.environmentIntensity).toBeGreaterThan(0);
    expect(EXPOSURE.environmentIntensity).toBeLessThanOrEqual(1);
    expect(EXPOSURE.contrast).toBeGreaterThan(1);
  });

  it("applies the calibration to the scene rather than re-declaring it", () => {
    // scene.ts used to inline the numbers. It must now read them, or a second
    // set of values can drift in again.
    const source = readFileSync(join(root, "src", "renderer", "scene.ts"), "utf8");
    expect(source).toContain("TONE_MAPPING.enabled");
    expect(source).toContain("TONE_MAPPING.type");
    expect(source).toContain("EXPOSURE.exposure");
    expect(source).toContain("EXPOSURE.environmentIntensity");
    expect(source).not.toMatch(/exposure\s*=\s*\d/);
    expect(source).not.toMatch(/environmentIntensity\s*=\s*\d/);
  });

  it("sets a real HDR environment instead of the old flat ambient stand-in", () => {
    const source = readFileSync(join(root, "src", "renderer", "assets.ts"), "utf8");
    expect(source).toContain("HDRCubeTexture");
    // Prefiltering is what gives roughness meaning; without it the per-body
    // roughness values would be decoration.
    expect(source).toContain("/* prefilterOnLoad */ true");
  });
});

describe("bodies stay distinguishable (§3)", () => {
  it("separates every pair of bodies beyond the visibility threshold", () => {
    const pairs: string[] = [];
    for (let i = 0; i < BODIES.length; i += 1) {
      for (let j = i + 1; j < BODIES.length; j += 1) {
        const a = BODIES[i] as string;
        const b = BODIES[j] as string;
        const distance = perceptualDistance(
          BODY_MATERIALS[a]?.albedoTint ?? FALLBACK_MATERIAL.albedoTint,
          BODY_MATERIALS[b]?.albedoTint ?? FALLBACK_MATERIAL.albedoTint,
        );
        pairs.push(`${a}/${b}=${distance.toFixed(1)}`);
        expect(distance, `${a} vs ${b} (deltaE ${distance.toFixed(1)})`).toBeGreaterThanOrEqual(
          MINIMUM_BODY_SEPARATION,
        );
      }
    }
    expect(pairs).toHaveLength(10);
  });

  it("measures a known distance correctly, so the threshold means something", () => {
    expect(perceptualDistance([0, 0, 0], [0, 0, 0])).toBe(0);
    expect(perceptualDistance([1, 1, 1], [0, 0, 0])).toBeGreaterThan(99);
    // Perceptual distance must be symmetric; an asymmetric metric would let a
    // body look distinct from one neighbour and identical to another.
    expect(perceptualDistance([0.6, 0.4, 0.2], [0.2, 0.6, 0.9])).toBeCloseTo(
      perceptualDistance([0.2, 0.6, 0.9], [0.6, 0.4, 0.2]),
      6,
    );
  });

  it("keeps roughness and metallic in the ranges PBR expects", () => {
    for (const body of BODIES) {
      const material = BODY_MATERIALS[body];
      expect(material, body).toBeDefined();
      if (!material) continue;
      expect(material.roughness, `${body} roughness`).toBeGreaterThanOrEqual(0);
      expect(material.roughness, `${body} roughness`).toBeLessThanOrEqual(1);
      expect(material.metallic, `${body} metallic`).toBeGreaterThanOrEqual(0);
      expect(material.metallic, `${body} metallic`).toBeLessThanOrEqual(1);
      expect(material.note.length, `${body} note`).toBeGreaterThan(20);
    }
  });

  it("varies roughness across bodies, so the ice and the regolith differ materially", () => {
    const roughnesses = new Set(BODIES.map((body) => BODY_MATERIALS[body]?.roughness));
    expect(roughnesses.size).toBe(BODIES.length);
    // Europa's ice is the smoothest surface in the survey; the Moon's regolith
    // is the roughest. If that ever inverts, the art is not saying anything.
    expect(BODY_MATERIALS["europa"]?.roughness).toBeLessThan(BODY_MATERIALS["moon"]?.roughness ?? 0);
  });

  it("falls back to a neutral, low-chroma material for an unknown body", () => {
    const fallback = materialForBody("not-a-body");
    expect(fallback).toBe(FALLBACK_MATERIAL);
    // A fallback must not invent a colour the art does not have.
    const [r, g, b] = fallback.albedoTint;
    expect(Math.max(r ?? 0, g ?? 0, b ?? 0) - Math.min(r ?? 0, g ?? 0, b ?? 0)).toBeLessThan(0.01);
  });
});

describe("atmosphere representation", () => {
  it("is labelled rather than derived, because the sourced value is a lower bound", () => {
    // §4 requires a shell depth derived from a sourced attribute, and equally
    // forbids implying a measurement the data does not contain. The only
    // sourced atmosphere value in v1 is a lower bound on detection altitude, so
    // scaling a shell from it would draw a precision the register does not have.
    expect(ATMOSPHERE_PRESENTATION.representation).toBe("neutral-labelled");
    expect(ATMOSPHERE_PRESENTATION.label.toLowerCase()).toContain("not a measurement");
    expect(ATMOSPHERE_PRESENTATION.rationale.toLowerCase()).toContain("lower bound");
  });

  it("keeps the shell small enough not to read as a measured boundary", () => {
    expect(ATMOSPHERE_PRESENTATION.shellScale).toBeGreaterThan(1);
    expect(ATMOSPHERE_PRESENTATION.shellScale).toBeLessThan(1.15);
  });

  it("still gates the shell on a sourced atmosphere attribute", () => {
    const source = readFileSync(join(root, "src", "renderer", "scene.ts"), "utf8");
    expect(source).toContain('bodyAvailableAttributes.includes("atmosphereDepth")');
  });
});

describe("calibration carries no scientific value", () => {
  it("contains no planetary number the domain already owns", () => {
    // Radii, orbital radii, and relief are compared as text from the register.
    // If any of them appeared in the renderer, there would be a second,
    // unchecked source of truth for a value learners are graded on.
    const source = readFileSync(join(root, "src", "renderer", "calibration.ts"), "utf8");
    for (const forbidden of ["meanRadius", "orbitalRadius", "surfaceRelief", "atmosphereDepth"]) {
      expect(source, `calibration must not read ${forbidden}`).not.toContain(forbidden);
    }
  });
});
