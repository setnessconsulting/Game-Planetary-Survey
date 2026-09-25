import { describe, expect, it } from "vitest";

import {
  ASSET_MANIFEST,
  assetsOfKind,
  findAsset,
  isSafeShippingPath,
  resolveAssetUrl,
  type AssetEntry,
} from "@/assets/assetManifest";
import {
  DEFAULT_QUALITY_PROFILE,
  isQualityProfileId,
  QUALITY_PROFILE_IDS,
  QUALITY_PROFILES,
  qualityProfile,
  resolveQualityProfile,
} from "@/assets/qualityProfiles";

describe("quality profiles", () => {
  it("defines exactly the three named profiles the contract promises", () => {
    expect(QUALITY_PROFILE_IDS).toEqual(["high", "standard", "reduced"]);
    for (const id of QUALITY_PROFILE_IDS) {
      expect(QUALITY_PROFILES[id].id).toBe(id);
      expect(QUALITY_PROFILES[id].description.length).toBeGreaterThan(20);
    }
  });

  it("varies only presentation cost", () => {
    // These are the knobs a profile may touch. Anything else would breach the
    // invariance rule, so the key set is asserted explicitly.
    const keys = Object.keys(QUALITY_PROFILES.standard).sort();
    expect(keys).toEqual([
      "animationDensity",
      "atmosphereQuality",
      "description",
      "id",
      "label",
      "particleDensity",
      "postProcessing",
      "renderScale",
      "shadows",
      "textureLodBias",
    ]);
  });

  it("keeps the reduced tier genuinely cheaper but still complete", () => {
    const reduced = qualityProfile("reduced");
    const high = qualityProfile("high");
    expect(reduced.renderScale).toBeLessThan(high.renderScale);
    expect(reduced.shadows).toBe(false);
    expect(high.shadows).toBe(true);
    // Reduced must remain a supported configuration, not a broken one.
    expect(reduced.animationDensity).toBe("minimal");
  });

  it("recognises only real profile ids", () => {
    expect(isQualityProfileId("standard")).toBe(true);
    expect(isQualityProfileId("ultra")).toBe(false);
  });
});

describe("resolveQualityProfile", () => {
  const capable = { deviceMemoryGb: 16, hardwareConcurrency: 16, webgpuConfirmed: true };
  const midRange = { deviceMemoryGb: 8, hardwareConcurrency: 8, webgpuConfirmed: false };
  const limited = { deviceMemoryGb: 4, hardwareConcurrency: 4, webgpuConfirmed: false };

  it("honours an explicit learner preference over device signals", () => {
    expect(resolveQualityProfile({ ...limited, preference: "high" })).toBe("high");
    expect(resolveQualityProfile({ ...capable, preference: "reduced" })).toBe("reduced");
  });

  it("selects reduced for a school-laptop-class device", () => {
    expect(resolveQualityProfile({ ...limited, preference: "auto" })).toBe("reduced");
    expect(
      resolveQualityProfile({
        preference: "auto",
        deviceMemoryGb: null,
        hardwareConcurrency: 2,
        webgpuConfirmed: false,
      }),
    ).toBe("reduced");
  });

  it("selects standard for a mid-range device", () => {
    expect(resolveQualityProfile({ ...midRange, preference: "auto" })).toBe("standard");
  });

  it("selects high on a clearly capable device with CONFIRMED WebGPU", () => {
    expect(resolveQualityProfile({ ...capable, preference: "auto" })).toBe("high");
  });

  it("does not select high merely because the WebGPU API is exposed", () => {
    // The bug this guards: a browser that exposes `navigator.gpu` but cannot
    // provide a usable adapter was escalated to the most expensive tier. Only a
    // backend the renderer confirmed may escalate quality.
    expect(resolveQualityProfile({ ...capable, webgpuConfirmed: false, preference: "auto" })).toBe(
      DEFAULT_QUALITY_PROFILE,
    );
  });

  it("defaults to standard when nothing is known", () => {
    expect(
      resolveQualityProfile({
        preference: "auto",
        deviceMemoryGb: null,
        hardwareConcurrency: null,
        webgpuConfirmed: false,
      }),
    ).toBe(DEFAULT_QUALITY_PROFILE);
  });

  it("is pure: the same device always resolves to the same tier", () => {
    expect(resolveQualityProfile({ ...limited, preference: "auto" })).toBe(
      resolveQualityProfile({ ...limited, preference: "auto" }),
    );
  });
});

describe("asset manifest contract", () => {
  it("registers the PS-05 placeholder body pipeline", () => {
    expect(ASSET_MANIFEST.assets.length).toBeGreaterThan(0);
    expect(ASSET_MANIFEST.generatedFrom).toContain("PS-05");
    expect(findAsset("body.placeholder.mesh")?.provenanceId).toMatch(/^generated\./);
    expect(findAsset("body.placeholder.albedo")?.shippingPath).toContain(".ktx2");
    expect(assetsOfKind("mesh").length).toBeGreaterThan(0);
  });

  it("rejects an unsafe shipping path", () => {
    expect(isSafeShippingPath("assets/probe.glb")).toBe(true);
    expect(isSafeShippingPath("/assets/probe.glb")).toBe(false);
    expect(isSafeShippingPath("../secrets.env")).toBe(false);
    expect(isSafeShippingPath("assets\\probe.glb")).toBe(false);
    expect(isSafeShippingPath("")).toBe(false);
    expect(isSafeShippingPath("assets/./probe.glb")).toBe(false);
  });

  it("resolves an asset URL beneath a nested version base", () => {
    const asset: AssetEntry = {
      logicalId: "probe",
      kind: "mesh",
      shippingPath: "assets/probe.glb",
      bytes: 1234,
      lodVariants: [],
      minimumQuality: null,
      provenanceId: "generated.test-probe",
    };
    expect(resolveAssetUrl(asset, "/game-assets/planetary-survey/0.1.0/")).toBe(
      "/game-assets/planetary-survey/0.1.0/assets/probe.glb",
    );
    expect(resolveAssetUrl(asset, "/game-assets/planetary-survey/0.1.0")).toBe(
      "/game-assets/planetary-survey/0.1.0/assets/probe.glb",
    );
    expect(resolveAssetUrl({ ...asset, shippingPath: "/assets/probe.glb" }, "/nested/")).toBe(
      "/nested/assets/probe.glb",
    );
  });
});
